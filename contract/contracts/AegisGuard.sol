// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IAegisGuard.sol";
import "./interfaces/IAegisVault.sol";
import "./libraries/RiskMath.sol";

contract AegisGuard is IAegisGuard {
    using RiskMath for uint256;

    uint256 public constant EMERGENCY_THRESHOLD = 2;
    uint256 public constant CHECK_COOLDOWN = 10;

    address public owner;
    address public vault;
    address public treasury;

    mapping(address => bool) public isSignalWriter;
    mapping(address => mapping(IAegisGuard.SignalType => uint256)) public signalValues;
    mapping(address => mapping(IAegisGuard.SignalType => bool)) public signalActive;
    mapping(address => uint256) public override activeSignalCount;
    mapping(address => bool) public override isEmergency;
    mapping(address => uint256) public lastCheckBlock;
    mapping(address => uint256) public emergencyTriggeredAt;

    uint256 public tvlDrainageThresholdBps = 100;
    uint256 public oracleDeviationThresholdBps = 300;
    uint256 public flashLoanThresholdMultiplier = 10 * 1e18;
    uint256 public bridgeAnomalyThreshold = 1;
    uint256 public override bountyAmount = 10e6;

    event ThresholdsUpdated(uint256 tvlBps, uint256 oracleBps, uint256 flashMultiplier, uint256 bridgeThreshold);
    event SignalCleared(address indexed protocol, IAegisGuard.SignalType signal);
    event EmergencyStateReset(address indexed protocol);

    modifier onlyOwner() {
        require(msg.sender == owner, "AegisGuard: not owner");
        _;
    }

    modifier onlySignalWriter() {
        require(isSignalWriter[msg.sender] || msg.sender == owner, "AegisGuard: not authorized");
        _;
    }

    constructor(address _vault, address _treasury) {
        require(_vault != address(0) && _treasury != address(0), "AegisGuard: zero address");
        owner = msg.sender;
        vault = _vault;
        treasury = _treasury;
        isSignalWriter[msg.sender] = true;
    }

    function addSignalWriter(address writer) external onlyOwner {
        isSignalWriter[writer] = true;
    }

    function removeSignalWriter(address writer) external onlyOwner {
        isSignalWriter[writer] = false;
    }

    function setThresholds(
        uint256 tvlBps,
        uint256 oracleBps,
        uint256 flashMultiplier,
        uint256 bridgeThreshold
    ) external onlyOwner {
        tvlDrainageThresholdBps = tvlBps;
        oracleDeviationThresholdBps = oracleBps;
        flashLoanThresholdMultiplier = flashMultiplier;
        bridgeAnomalyThreshold = bridgeThreshold;
        emit ThresholdsUpdated(tvlBps, oracleBps, flashMultiplier, bridgeThreshold);
    }

    function setBountyAmount(uint256 amount) external onlyOwner {
        bountyAmount = amount;
    }

    function resetEmergency(address protocol) external onlyOwner {
        isEmergency[protocol] = false;
        emit EmergencyStateReset(protocol);
    }

    function recordSignal(
        address protocol,
        IAegisGuard.SignalType signal,
        uint256 value
    ) external override onlySignalWriter {
        _recordSignalInternal(protocol, signal, value);
    }

    function recordSignals(
        address protocol,
        IAegisGuard.SignalType[] calldata signals,
        uint256[] calldata values
    ) external onlySignalWriter {
        require(signals.length == values.length, "AegisGuard: length mismatch");
        for (uint256 i = 0; i < signals.length; i++) {
            _recordSignalInternal(protocol, signals[i], values[i]);
        }
    }

    function checkAndExecute(address protocol) external override returns (bool triggered) {
        require(
            block.number >= lastCheckBlock[protocol] + CHECK_COOLDOWN,
            "AegisGuard: cooldown active"
        );
        lastCheckBlock[protocol] = block.number;

        if (isEmergency[protocol]) return false;
        if (activeSignalCount[protocol] < EMERGENCY_THRESHOLD) return false;

        isEmergency[protocol] = true;
        emergencyTriggeredAt[protocol] = block.number;

        IAegisVault(vault).emergencyWithdraw(protocol);

        _payBounty(msg.sender);

        emit EmergencyTriggered(msg.sender, protocol, bountyAmount);
        triggered = true;
    }

    function _recordSignalInternal(
        address protocol,
        IAegisGuard.SignalType signal,
        uint256 value
    ) internal {
        signalValues[protocol][signal] = value;

        bool wasActive = signalActive[protocol][signal];
        bool nowActive = _isSignalBreached(signal, value);

        if (nowActive && !wasActive) {
            signalActive[protocol][signal] = true;
            activeSignalCount[protocol]++;
            emit SignalRecorded(protocol, signal, value, block.timestamp);
        } else if (!nowActive && wasActive) {
            signalActive[protocol][signal] = false;
            activeSignalCount[protocol]--;
            emit SignalCleared(protocol, signal);
        }
    }

    function _isSignalBreached(
        IAegisGuard.SignalType signal,
        uint256 value
    ) internal view returns (bool) {
        if (signal == IAegisGuard.SignalType.TVL_DRAINAGE) {
            return value >= tvlDrainageThresholdBps;
        }
        if (signal == IAegisGuard.SignalType.ORACLE_DEVIATION) {
            return value >= oracleDeviationThresholdBps;
        }
        if (signal == IAegisGuard.SignalType.FLASH_LOAN_SPIKE) {
            return value >= flashLoanThresholdMultiplier;
        }
        if (signal == IAegisGuard.SignalType.ACCESS_CONTROL_ANOMALY) {
            return value >= 1;
        }
        if (signal == IAegisGuard.SignalType.BRIDGE_ANOMALY) {
            return value >= bridgeAnomalyThreshold;
        }
        return false;
    }

    function _payBounty(address caller) internal {
        (bool success, ) = treasury.call(
            abi.encodeWithSignature("payBounty(address)", caller)
        );
        if (!success) {
            emit EmergencyTriggered(caller, address(0), 0);
        }
    }

    function getSignalState(address protocol) external view returns (
        bool tvlDrainage,
        bool oracleDeviation,
        bool flashLoan,
        bool accessControl,
        bool bridgeAnomaly,
        uint256 totalActive
    ) {
        tvlDrainage    = signalActive[protocol][IAegisGuard.SignalType.TVL_DRAINAGE];
        oracleDeviation = signalActive[protocol][IAegisGuard.SignalType.ORACLE_DEVIATION];
        flashLoan      = signalActive[protocol][IAegisGuard.SignalType.FLASH_LOAN_SPIKE];
        accessControl  = signalActive[protocol][IAegisGuard.SignalType.ACCESS_CONTROL_ANOMALY];
        bridgeAnomaly  = signalActive[protocol][IAegisGuard.SignalType.BRIDGE_ANOMALY];
        totalActive    = activeSignalCount[protocol];
    }

    function isCheckable(address protocol) external view returns (bool) {
        return !isEmergency[protocol] &&
               block.number >= lastCheckBlock[protocol] + CHECK_COOLDOWN;
    }
}
