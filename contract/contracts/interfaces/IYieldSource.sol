// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


interface IYieldSource {
    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function withdrawAll() external;

    function balanceOf() external view returns (uint256);

    function currentAPY() external view returns (uint256);

    function protocolTVL() external view returns (uint256);

    function name() external view returns (string memory);

    function protocolAddress() external view returns (address);
}
