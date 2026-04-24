// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IYieldSource.sol";


contract MockYieldSource is IYieldSource {
    using SafeERC20 for IERC20;

    address public owner;
    IERC20  public immutable usdc;

    string  private _name;
    uint256 private _currentAPY;
    uint256 private _protocolTVL;
    address private _protocolAddress;

    uint256 public depositedBalance;
    uint256 public accruedYield;
    uint256 public lastAccrualAt;

    event APYUpdated(uint256 newAPY);
    event TVLUpdated(uint256 newTVL);
    event YieldAccrued(uint256 amount);


    modifier onlyOwner() {
        require(msg.sender == owner, "MockYieldSource: not owner");
        _;
    }


    constructor(
        address _usdc,
        string memory name_,
        uint256 initialAPY,
        uint256 initialTVL
    ) {
        require(_usdc != address(0), "MockYieldSource: zero address");
        owner            = msg.sender;
        usdc             = IERC20(_usdc);
        _name            = name_;
        _currentAPY      = initialAPY;
        _protocolTVL     = initialTVL;
        _protocolAddress = address(this);
        lastAccrualAt    = block.timestamp;
    }


    function deposit(uint256 amount) external override {
        require(amount > 0, "MockYieldSource: zero amount");
        _accrueYield();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        depositedBalance += amount;
        _protocolTVL     += amount;
    }

    function withdraw(uint256 amount) external override {
        _accrueYield();
        require(amount <= balanceOf(), "MockYieldSource: insufficient balance");

        if (amount <= accruedYield) {
            accruedYield -= amount;
        } else {
            uint256 fromPrincipal = amount - accruedYield;
            accruedYield  = 0;
            depositedBalance -= fromPrincipal;
            if (_protocolTVL >= fromPrincipal) _protocolTVL -= fromPrincipal;
        }

        uint256 actual = usdc.balanceOf(address(this));
        usdc.safeTransfer(msg.sender, actual < amount ? actual : amount);
    }

    function withdrawAll() external override {
        _accrueYield();
        uint256 total = balanceOf();
        if (total == 0) return;

        depositedBalance = 0;
        accruedYield     = 0;
        if (_protocolTVL >= total) _protocolTVL -= total;

        uint256 actual = usdc.balanceOf(address(this));
        usdc.safeTransfer(msg.sender, actual < total ? actual : total);
    }

    function balanceOf() public view override returns (uint256) {
        return depositedBalance + accruedYield;
    }

    function currentAPY()     external view override returns (uint256) { return _currentAPY; }
    function protocolTVL()    external view override returns (uint256) { return _protocolTVL; }
    function name()           external view override returns (string memory) { return _name; }
    function protocolAddress() external view override returns (address) { return _protocolAddress; }

    function setAPY(uint256 newAPY) external onlyOwner {
        _accrueYield();
        _currentAPY = newAPY;
        emit APYUpdated(newAPY);
    }

    function crashTVL(uint256 newTVL) external onlyOwner {
        _protocolTVL = newTVL;
        emit TVLUpdated(newTVL);
    }

    function simulateFlashLoan() external onlyOwner {
        uint256 original = _protocolTVL;
        _protocolTVL = original * 20;
        emit TVLUpdated(_protocolTVL);
        // Note: sentinel reads this at the block level. Restore in next tx.
        _protocolTVL = original;
    }

    function injectYield(uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        accruedYield += amount;
        emit YieldAccrued(amount);
    }

    function setProtocolAddress(address addr) external onlyOwner {
        _protocolAddress = addr;
    }

    function _accrueYield() internal {
        uint256 pending = _pendingYield();
        if (pending > 0) {
            accruedYield += pending;
            emit YieldAccrued(pending);
        }
        lastAccrualAt = block.timestamp;
    }

    function _pendingYield() internal view returns (uint256) {
        if (depositedBalance == 0 || _currentAPY == 0) return 0;
        uint256 elapsed = block.timestamp - lastAccrualAt;
        // yield = principal × APY_bps / 10_000 × elapsed / 365_days
        return (depositedBalance * _currentAPY * elapsed) / (10_000 * 365 days);
    }
}
