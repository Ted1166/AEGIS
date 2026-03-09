// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/YieldScorer.sol";


contract YieldOracle {
    using YieldScorer for uint256;


    struct ScoreEntry {
        uint256 score;    
        uint256 realYieldBps;
        uint256 emissionsYieldBps;
        uint256 totalAPYBps;
        uint256 tvl;
        uint256 updatedAt;
        uint8 tier;
        bool active;
    }


    address public owner;
    address public vault;

    uint256 public maxScoreAge = 1 hours;

    mapping(address => bool) public isWriter;
    mapping(address => ScoreEntry) public scores;

    address[] public trackedProtocols;


    event ScoreUpdated(
        address indexed protocol,
        uint256 score,
        uint256 realYieldBps,
        uint256 totalAPYBps,
        uint256 tvl,
        uint8 tier
    );
    event WriterAdded(address indexed writer);
    event WriterRemoved(address indexed writer);
    event ProtocolAdded(address indexed protocol);
    event ProtocolRemoved(address indexed protocol);
    event VaultSet(address indexed vault);


    modifier onlyOwner() {
        require(msg.sender == owner, "YieldOracle: not owner");
        _;
    }

    modifier onlyWriter() {
        require(isWriter[msg.sender] || msg.sender == owner, "YieldOracle: not authorized writer");
        _;
    }

    constructor() {
        owner = msg.sender;
        isWriter[msg.sender] = true;
    }


    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "YieldOracle: zero address");
        vault = _vault;
        emit VaultSet(_vault);
    }

    function addWriter(address writer) external onlyOwner {
        isWriter[writer] = true;
        emit WriterAdded(writer);
    }

    function removeWriter(address writer) external onlyOwner {
        isWriter[writer] = false;
        emit WriterRemoved(writer);
    }

    function setMaxScoreAge(uint256 age) external onlyOwner {
        maxScoreAge = age;
    }

    function addProtocol(address protocol) external onlyOwner {
        require(!scores[protocol].active, "YieldOracle: already tracked");
        scores[protocol].active = true;
        trackedProtocols.push(protocol);
        emit ProtocolAdded(protocol);
    }

    function removeProtocol(address protocol) external onlyOwner {
        scores[protocol].active = false;
        emit ProtocolRemoved(protocol);
    }

    function writeScore(
        address protocol,
        uint256 realYieldBps,
        uint256 emissionsYieldBps,
        uint256 totalAPYBps,
        uint256 tvl,
        uint256 tvlFloor
    ) external onlyWriter {
        require(scores[protocol].active, "YieldOracle: protocol not tracked");

        uint256 score = YieldScorer.computeScore(realYieldBps, totalAPYBps, tvl, tvlFloor);
        uint8 tier = YieldScorer.scoreTier(score);

        scores[protocol] = ScoreEntry({
            score: score,
            realYieldBps: realYieldBps,
            emissionsYieldBps: emissionsYieldBps,
            totalAPYBps: totalAPYBps,
            tvl: tvl,
            updatedAt: block.timestamp,
            tier: tier,
            active: true
        });

        emit ScoreUpdated(protocol, score, realYieldBps, totalAPYBps, tvl, tier);
    }

    function getScore(address protocol) external view returns (ScoreEntry memory entry) {
        entry = scores[protocol];
        require(entry.active, "YieldOracle: protocol not tracked");
        require(
            block.timestamp - entry.updatedAt <= maxScoreAge,
            "YieldOracle: score stale"
        );
    }

    function getScoreUnchecked(address protocol) external view returns (ScoreEntry memory) {
        return scores[protocol];
    }

    function isScoreFresh(address protocol) external view returns (bool) {
        ScoreEntry memory e = scores[protocol];
        return e.active && (block.timestamp - e.updatedAt <= maxScoreAge);
    }

    function getTrackedProtocols() external view returns (address[] memory) {
        return trackedProtocols;
    }

    function activeProtocolCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < trackedProtocols.length; i++) {
            if (scores[trackedProtocols[i]].active) count++;
        }
    }
}
