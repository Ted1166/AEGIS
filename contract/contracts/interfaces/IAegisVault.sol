// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


interface IAegisVault {
    event Deposited(address indexed user, uint256 amount, uint256 shares);

    event Withdrawn(address indexed user, uint256 shares, uint256 amount);

    event Rebalanced(address indexed caller, uint256 timestamp);

    event YieldSourceAdded(address indexed source, string name);

    event YieldSourceRemoved(address indexed source);


    function deposit(uint256 amount) external returns (uint256 shares);

    function withdraw(uint256 shares) external returns (uint256 amount);

    function rebalance() external;

    function emergencyWithdraw(address protocol) external;

    function sharesToAssets(uint256 shares) external view returns (uint256);

    function assetsToShares(uint256 amount) external view returns (uint256);

    function totalAssets() external view returns (uint256);

    function balanceOf(address user) external view returns (uint256);
}
