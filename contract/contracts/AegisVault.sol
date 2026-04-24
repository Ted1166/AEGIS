// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAegisVault.sol";
import "./interfaces/IYieldSource.sol";
import "./oracles/YieldOracle.sol";
import "./libraries/YieldScorer.sol";

contract AegisVault is IAegisVault, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using YieldScorer for uint256;

    address public owner;
    address public guard;
    address public treasury;

    IERC20 public immutable usdc;
    YieldOracle public immutable oracle;

    uint256 public totalShares;

    mapping(address => uint256) public shares;

    address[] public yieldSources;
    mapping(address => bool) public isYieldSource;
    mapping(address => bool) public sourceInEmergency;

    uint256 public bufferBalance;

    uint256 public bufferCap = 1_000e6;

    uint256 public minDeposit = 1e6; 

    uint256 public rebalanceCooldown = 10 minutes;
    uint256 public lastRebalanceAt;


    modifier onlyOwner() {
        require(msg.sender == owner, "AegisVault: not owner");
        _;
    }

    modifier onlyGuard() {
        require(msg.sender == guard, "AegisVault: not guard");
        _;
    }


    constructor(address _usdc, address _oracle, address _guard, address _treasury) {
        require(
            _usdc != address(0) && _oracle != address(0) &&
            _guard != address(0) && _treasury != address(0),
            "AegisVault: zero address"
        );
        owner = msg.sender;
        usdc = IERC20(_usdc);
        oracle = YieldOracle(_oracle);
        guard = _guard;
        treasury = _treasury;
    }


    function addYieldSource(address source) external onlyOwner {
        require(!isYieldSource[source], "AegisVault: already added");
        isYieldSource[source] = true;
        yieldSources.push(source);
        emit YieldSourceAdded(source, IYieldSource(source).name());
    }

    function removeYieldSource(address source) external onlyOwner {
        require(isYieldSource[source], "AegisVault: not a source");
        isYieldSource[source] = false;
        emit YieldSourceRemoved(source);
    }

    function setBufferCap(uint256 cap) external onlyOwner { bufferCap = cap; }
    function setMinDeposit(uint256 min) external onlyOwner { minDeposit = min; }
    function setRebalanceCooldown(uint256 cd) external onlyOwner { rebalanceCooldown = cd; }

    function deposit(uint256 amount) external override nonReentrant returns (uint256 mintedShares) {
        require(amount >= minDeposit, "AegisVault: below minimum deposit");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        mintedShares = _computeShares(amount);

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;
        bufferBalance += amount;

        if (bufferBalance >= bufferCap) {
            _routeBufferToYieldSources();
        }

        emit Deposited(msg.sender, amount, mintedShares);
    }

    function withdraw(uint256 sharesToBurn) external override nonReentrant returns (uint256 amount) {
        require(shares[msg.sender] >= sharesToBurn, "AegisVault: insufficient shares");

        amount = sharesToAssets(sharesToBurn);
        require(amount > 0, "AegisVault: zero withdrawal");

        shares[msg.sender] -= sharesToBurn;
        totalShares -= sharesToBurn;

        amount = _fulfillWithdrawal(msg.sender, amount);

        emit Withdrawn(msg.sender, sharesToBurn, amount);
    }

    function rebalance() external override {
        require(
            block.timestamp >= lastRebalanceAt + rebalanceCooldown,
            "AegisVault: cooldown active"
        );
        lastRebalanceAt = block.timestamp;

        _pullAllFromYieldSources();
        _routeBufferToYieldSources();

        emit Rebalanced(msg.sender, block.timestamp);
    }

    function emergencyWithdraw(address protocol) external override onlyGuard {
        require(isYieldSource[protocol], "AegisVault: unknown source");
        require(!sourceInEmergency[protocol], "AegisVault: already in emergency");

        sourceInEmergency[protocol] = true;

        uint256 balanceBefore = usdc.balanceOf(address(this));
        IYieldSource(protocol).withdrawAll();
        uint256 recovered = usdc.balanceOf(address(this)) - balanceBefore;

        if (recovered > 0) {
            usdc.safeTransfer(treasury, recovered);
        }
    }

    function _computeShares(uint256 amount) internal view returns (uint256) {
        if (totalShares == 0 || totalAssets() == 0) {
            return amount; 
        }
        return (amount * totalShares) / totalAssets();
    }

    function _routeBufferToYieldSources() internal {
        if (bufferBalance == 0) return;

        uint256[] memory weights = _computeAllocationWeights();
        uint256 totalToRoute = bufferBalance;
        bufferBalance = 0;

        for (uint256 i = 0; i < yieldSources.length; i++) {
            if (!isYieldSource[yieldSources[i]] || sourceInEmergency[yieldSources[i]]) continue;
            if (weights[i] == 0) continue;

            uint256 allocation = (totalToRoute * weights[i]) / 10_000;
            if (allocation == 0) continue;

            usdc.forceApprove(yieldSources[i], allocation);
            IYieldSource(yieldSources[i]).deposit(allocation);
        }
    }

    function _pullAllFromYieldSources() internal {
        for (uint256 i = 0; i < yieldSources.length; i++) {
            address src = yieldSources[i];
            if (!isYieldSource[src] || sourceInEmergency[src]) continue;

            uint256 bal = IYieldSource(src).balanceOf();
            if (bal > 0) {
                IYieldSource(src).withdrawAll();
            }
        }
        bufferBalance = usdc.balanceOf(address(this));
    }

    function _computeAllocationWeights() internal view returns (uint256[] memory weights) {
        weights = new uint256[](yieldSources.length);
        uint256 totalEligibleScore;

        uint256[] memory eligibleScores = new uint256[](yieldSources.length);
        for (uint256 i = 0; i < yieldSources.length; i++) {
            address src = yieldSources[i];
            if (!isYieldSource[src] || sourceInEmergency[src]) continue;

            try oracle.getScore(src) returns (YieldOracle.ScoreEntry memory entry) {
                if (entry.score >= 40) {
                    eligibleScores[i] = entry.score;
                    totalEligibleScore += entry.score;
                }
            } catch {
                eligibleScores[i] = 0;
            }
        }

        if (totalEligibleScore == 0) {
            uint256 activeSources;
            for (uint256 i = 0; i < yieldSources.length; i++) {
                if (isYieldSource[yieldSources[i]] && !sourceInEmergency[yieldSources[i]]) {
                    activeSources++;
                }
            }
            if (activeSources > 0) {
                uint256 equalWeight = 10_000 / activeSources;
                for (uint256 i = 0; i < yieldSources.length; i++) {
                    if (isYieldSource[yieldSources[i]] && !sourceInEmergency[yieldSources[i]]) {
                        weights[i] = equalWeight;
                    }
                }
            }
            return weights;
        }

        for (uint256 i = 0; i < yieldSources.length; i++) {
            weights[i] = YieldScorer.allocationWeight(eligibleScores[i], totalEligibleScore);
        }
    }

    function _fulfillWithdrawal(address user, uint256 amount) internal returns (uint256 fulfilled) {
        if (bufferBalance >= amount) {
            bufferBalance -= amount;
            usdc.safeTransfer(user, amount);
            return amount;
        }

        uint256 fromBuffer = bufferBalance;
        bufferBalance = 0;
        uint256 remaining = amount - fromBuffer;

        for (uint256 i = 0; i < yieldSources.length && remaining > 0; i++) {
            address src = yieldSources[i];
            if (!isYieldSource[src] || sourceInEmergency[src]) continue;

            uint256 available = IYieldSource(src).balanceOf();
            if (available == 0) continue;

            uint256 toWithdraw = available >= remaining ? remaining : available;
            IYieldSource(src).withdraw(toWithdraw);
            remaining -= toWithdraw;
        }

        fulfilled = usdc.balanceOf(address(this));
        require(fulfilled >= amount - remaining, "AegisVault: insufficient liquidity");
        usdc.safeTransfer(user, fulfilled);
        bufferBalance = 0;
    }

    function totalAssets() public view override returns (uint256 total) {
        total = bufferBalance;
        for (uint256 i = 0; i < yieldSources.length; i++) {
            if (!isYieldSource[yieldSources[i]] || sourceInEmergency[yieldSources[i]]) continue;
            total += IYieldSource(yieldSources[i]).balanceOf();
        }
    }

    function sharesToAssets(uint256 _shares) public view override returns (uint256) {
        if (totalShares == 0) return 0;
        return (_shares * totalAssets()) / totalShares;
    }

    function assetsToShares(uint256 amount) public view override returns (uint256) {
        if (totalShares == 0 || totalAssets() == 0) return amount;
        return (amount * totalShares) / totalAssets();
    }

    function balanceOf(address user) external view override returns (uint256) {
        return sharesToAssets(shares[user]);
    }

    function getYieldSources() external view returns (address[] memory) {
        return yieldSources;
    }

    function getUserShares(address user) external view returns (uint256) {
        return shares[user];
    }

    function setGuard(address _guard) external onlyOwner {
        guard = _guard;
    }
}
