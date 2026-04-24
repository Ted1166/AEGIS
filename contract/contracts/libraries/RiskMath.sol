// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


library RiskMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BPS = 10_000;


    function tvlDrainageRate(
        uint256 tvlBefore,
        uint256 tvlNow,
        uint256 blocksDelta
    ) internal pure returns (uint256 drainageBps) {
        if (tvlNow >= tvlBefore || blocksDelta == 0) return 0;
        uint256 lost = tvlBefore - tvlNow;
        drainageBps = (lost * BPS) / tvlBefore / blocksDelta;
    }

    function isDrainageAnomaly(
        uint256 drainageBps,
        uint256 thresholdBps
    ) internal pure returns (bool) {
        return drainageBps >= thresholdBps;
    }

    function oracleDeviationBps(
        uint256 expectedPrice,
        uint256 reportedPrice
    ) internal pure returns (uint256 deviationBps) {
        if (expectedPrice == 0) return 0;
        uint256 diff = reportedPrice > expectedPrice
            ? reportedPrice - expectedPrice
            : expectedPrice - reportedPrice;
        deviationBps = (diff * BPS) / expectedPrice;
    }

    function isOracleAnomaly(
        uint256 deviationBps,
        uint256 thresholdBps
    ) internal pure returns (bool) {
        return deviationBps >= thresholdBps;
    }

    function flashLoanSpikeMultiplier(
        uint256 rollingAvgVolume,
        uint256 currentBlockVolume
    ) internal pure returns (uint256 spikeMultiplier) {
        if (rollingAvgVolume == 0) return 0;
        spikeMultiplier = (currentBlockVolume * PRECISION) / rollingAvgVolume;
    }

    function isFlashLoanAnomaly(
        uint256 spikeMultiplier,
        uint256 thresholdMultiplier
    ) internal pure returns (bool) {
        return spikeMultiplier >= thresholdMultiplier;
    }

    function activeSignals(
        bool drainage,
        bool oracle,
        bool flashLoan,
        bool accessControl
    ) internal pure returns (uint256 count) {
        if (drainage) count++;
        if (oracle) count++;
        if (flashLoan) count++;
        if (accessControl) count++;
    }
}
