// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


interface IAegisGuard {

    enum SignalType {
        TVL_DRAINAGE,
        ORACLE_DEVIATION,
        FLASH_LOAN_SPIKE,
        ACCESS_CONTROL_ANOMALY
    }

    event SignalRecorded(address indexed protocol, SignalType signal, uint256 value, uint256 timestamp);

    event EmergencyTriggered(address indexed caller, address indexed protocol, uint256 bountyPaid);

    event EmergencyResolved(address indexed protocol);
    

    function recordSignal(address protocol, SignalType signal, uint256 value) external;

    function checkAndExecute(address protocol) external returns (bool triggered);

    function activeSignalCount(address protocol) external view returns (uint256);

    function isEmergency(address protocol) external view returns (bool);

    function bountyAmount() external view returns (uint256);
}
