// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library YieldScorer {
    uint256 internal constant MAX_SCORE = 100;
    uint256 internal constant BPS = 10_000;


    function computeScore(
        uint256 realYieldBps,
        uint256 totalAPYBps,
        uint256 tvl,
        uint256 tvlFloor
    ) internal pure returns (uint256 score) {
        if (totalAPYBps == 0) return 0;

        uint256 realRatio = (realYieldBps * BPS) / totalAPYBps; 
        uint256 realComponent = (realRatio * 70) / BPS;

        uint256 tvlComponent;
        if (tvl >= tvlFloor) {
            tvlComponent = 30;
        } else {
            tvlComponent = (tvl * 30) / tvlFloor;
        }

        score = realComponent + tvlComponent;
        if (score > MAX_SCORE) score = MAX_SCORE;
    }

    function scoreTier(uint256 score) internal pure returns (uint8 tier) {
        if (score >= 70) return 2;
        if (score >= 40) return 1;
        return 0;
    }

    function allocationWeight(
        uint256 score,
        uint256 totalScoreOfEligible
    ) internal pure returns (uint256 weightBps) {
        if (score < 40 || totalScoreOfEligible == 0) return 0;
        weightBps = (score * BPS) / totalScoreOfEligible;
    }
}
