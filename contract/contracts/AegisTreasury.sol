// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract AegisTreasury {
    using SafeERC20 for IERC20;

    address public owner;
    address public vault;
    address public guard;

    IERC20 public immutable usdc;

    uint256 public bountyAmount = 10e6; 

    mapping(address => uint256) public safeHarborBalances;

    uint256 public totalSafeHarbor;

    event EmergencyFundsReceived(address indexed protocol, uint256 amount, uint256 timestamp);
    event SafeHarborClaimed(address indexed user, uint256 amount);
    event BountyPaid(address indexed caller, uint256 amount);
    event BountyAmountUpdated(uint256 newAmount);
    event VaultSet(address indexed vault);
    event GuardSet(address indexed guard);

    modifier onlyOwner() {
        require(msg.sender == owner, "AegisTreasury: not owner");
        _;
    }

    modifier onlyVaultOrGuard() {
        require(
            msg.sender == vault || msg.sender == guard,
            "AegisTreasury: not vault or guard"
        );
        _;
    }


    constructor(address _usdc) {
        require(_usdc != address(0), "AegisTreasury: zero address");
        owner = msg.sender;
        usdc = IERC20(_usdc);
    }


    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "AegisTreasury: zero address");
        vault = _vault;
        emit VaultSet(_vault);
    }

    function setGuard(address _guard) external onlyOwner {
        require(_guard != address(0), "AegisTreasury: zero address");
        guard = _guard;
        emit GuardSet(_guard);
    }

    function setBountyAmount(uint256 amount) external onlyOwner {
        bountyAmount = amount;
        emit BountyAmountUpdated(amount);
    }

    function receiveEmergencyFunds(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyVaultOrGuard {
        require(users.length == amounts.length, "AegisTreasury: length mismatch");

        uint256 total;
        for (uint256 i = 0; i < users.length; i++) {
            safeHarborBalances[users[i]] += amounts[i];
            total += amounts[i];
        }
        totalSafeHarbor += total;

        emit EmergencyFundsReceived(address(0), total, block.timestamp);
    }

    function receiveEmergencyLump(address protocol, uint256 amount) external onlyVaultOrGuard {
        totalSafeHarbor += amount;
        emit EmergencyFundsReceived(protocol, amount, block.timestamp);
    }

    function payBounty(address caller) external onlyVaultOrGuard {
        require(caller != address(0), "AegisTreasury: zero caller");
        uint256 balance = usdc.balanceOf(address(this));
        uint256 payout = bountyAmount;

        uint256 available = balance > totalSafeHarbor ? balance - totalSafeHarbor : 0;
        if (available < payout) payout = available;

        if (payout > 0) {
            usdc.safeTransfer(caller, payout);
            emit BountyPaid(caller, payout);
        }
    }

    function claim() external {
        uint256 amount = safeHarborBalances[msg.sender];
        require(amount > 0, "AegisTreasury: nothing to claim");

        safeHarborBalances[msg.sender] = 0;
        totalSafeHarbor -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit SafeHarborClaimed(msg.sender, amount);
    }

    function claimableBalance(address user) external view returns (uint256) {
        return safeHarborBalances[user];
    }

    function bountyPool() external view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > totalSafeHarbor ? balance - totalSafeHarbor : 0;
    }
}
