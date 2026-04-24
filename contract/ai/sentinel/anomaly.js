import { ethers } from "ethers";

const YIELD_SOURCE_ABI = [
  "function protocolTVL() external view returns (uint256)",
  "function currentAPY() external view returns (uint256)",
  "function protocolAddress() external view returns (address)",
];

const ACCESS_CONTROL_TOPICS = [
  ethers.id("OwnershipTransferred(address,address)"),
  ethers.id("RoleGranted(bytes32,address,address)"),
  ethers.id("RoleRevoked(bytes32,address,address)"),
  ethers.id("AdminChanged(address,address)"),
  ethers.id("ProxyUpgraded(address)"),
];


const protocolState = new Map();

const VOLUME_HISTORY_WINDOW = 20;
const TVL_HISTORY_WINDOW    = 5;


const SignalType = {
  TVL_DRAINAGE:           0,
  ORACLE_DEVIATION:       1,
  FLASH_LOAN_SPIKE:       2,
  ACCESS_CONTROL_ANOMALY: 3,
};


async function computeSignals(provider, protocol, blockNumber) {
  const source = new ethers.Contract(protocol, YIELD_SOURCE_ABI, provider);

  const [tvlSignal, oracleSignal, flashSignal, accessSignal] = await Promise.all([
    _computeTVLDrainage(provider, source, protocol, blockNumber),
    _computeOracleDeviation(provider, source, protocol),
    _computeFlashLoanSpike(provider, source, protocol, blockNumber),
    _computeAccessControlAnomaly(provider, source, protocol, blockNumber),
  ]);

  return [
    { signalType: SignalType.TVL_DRAINAGE,           value: tvlSignal   },
    { signalType: SignalType.ORACLE_DEVIATION,        value: oracleSignal },
    { signalType: SignalType.FLASH_LOAN_SPIKE,        value: flashSignal  },
    { signalType: SignalType.ACCESS_CONTROL_ANOMALY,  value: accessSignal },
  ];
}

async function _computeTVLDrainage(provider, source, protocol, blockNumber) {
  try {
    const currentTVL = await source.protocolTVL();
    const state      = _getState(protocol);

    state.tvlHistory.push(currentTVL);
    if (state.tvlHistory.length > TVL_HISTORY_WINDOW) {
      state.tvlHistory.shift();
    }

    if (state.tvlHistory.length < 2) {
      state.lastTVL = currentTVL;
      return 0n;
    }

    const oldest = state.tvlHistory[0];
    if (oldest === 0n) {
      state.lastTVL = currentTVL;
      return 0n;
    }

    if (currentTVL >= oldest) {
      state.lastTVL = currentTVL;
      return 0n;
    }

    const dropped        = oldest - currentTVL;
    const blocksElapsed  = BigInt(state.tvlHistory.length - 1) || 1n;
    const drainagePerBlock = (dropped * 10_000n) / oldest / blocksElapsed;

    state.lastTVL = currentTVL;

    console.log(
      `[Sentinel] TVL Drainage | ${_short(protocol)} | ` +
      `${currentTVL} USDC | ${drainagePerBlock} bps/block`
    );

    return drainagePerBlock;
  } catch (err) {
    console.warn(`[Sentinel] TVL drainage read failed for ${_short(protocol)}: ${err.message}`);
    return 0n;
  }
}

async function _computeOracleDeviation(provider, source, protocol) {
  try {
    const currentAPY = await source.currentAPY();
    const state      = _getState(protocol);

    if (state.referenceAPY === 0n && currentAPY > 0n) {
      state.referenceAPY = currentAPY;
      return 0n;
    }

    if (state.referenceAPY === 0n) return 0n;

    const diff       = currentAPY > state.referenceAPY
      ? currentAPY - state.referenceAPY
      : state.referenceAPY - currentAPY;

    const deviationBps = (diff * 10_000n) / state.referenceAPY;

    state.referenceAPY = (state.referenceAPY * 19n + currentAPY) / 20n;

    console.log(
      `[Sentinel] Oracle Deviation | ${_short(protocol)} | ` +
      `APY: ${currentAPY} bps | deviation: ${deviationBps} bps`
    );

    return deviationBps;
  } catch (err) {
    console.warn(`[Sentinel] Oracle deviation read failed for ${_short(protocol)}: ${err.message}`);
    return 0n;
  }
}

async function _computeFlashLoanSpike(provider, source, protocol, blockNumber) {
  try {
    const protocolAddr = await source.protocolAddress();
    const state        = _getState(protocol);

    const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock:   blockNumber,
      topics:    [TRANSFER_TOPIC],
    });

    let blockVolume = 0n;
    const protocolLower = protocolAddr.toLowerCase();

    for (const log of logs) {
      const from = "0x" + log.topics[1]?.slice(26);
      const to   = "0x" + log.topics[2]?.slice(26);

      if (from.toLowerCase() === protocolLower || to.toLowerCase() === protocolLower) {
        try {
          blockVolume += ethers.AbiCoder.defaultAbiCoder()
            .decode(["uint256"], log.data)[0];
        } catch { /* malformed log — skip */ }
      }
    }

    state.volumeHistory.push(blockVolume);
    if (state.volumeHistory.length > VOLUME_HISTORY_WINDOW) {
      state.volumeHistory.shift();
    }

    if (state.volumeHistory.length < 3) return 0n;

    const historicalVolumes = state.volumeHistory.slice(0, -1);
    const avgVolume = historicalVolumes.reduce((a, b) => a + b, 0n)
      / BigInt(historicalVolumes.length);

    if (avgVolume === 0n) return 0n;

    const multiplierScaled = (blockVolume * BigInt(1e18)) / avgVolume;

    console.log(
      `[Sentinel] Flash Loan | ${_short(protocol)} | ` +
      `block vol: ${blockVolume} | avg: ${avgVolume} | ` +
      `multiplier: ${(multiplierScaled / BigInt(1e15))}e-3 × avg`
    );

    return multiplierScaled;
  } catch (err) {
    console.warn(`[Sentinel] Flash loan read failed for ${_short(protocol)}: ${err.message}`);
    return 0n;
  }
}

async function _computeAccessControlAnomaly(provider, source, protocol, blockNumber) {
  try {
    const protocolAddr = await source.protocolAddress();

    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock:   blockNumber,
      address:   protocolAddr,
      topics:    [ACCESS_CONTROL_TOPICS], 
    });

    if (logs.length > 0) {
      console.warn(
        `[Sentinel] ⚠️  Access Control Event | ${_short(protocol)} | ` +
        `topic: ${logs[0].topics[0].slice(0, 10)}... | ` +
        `block: ${blockNumber}`
      );
      return 1n;
    }

    return 0n;
  } catch (err) {
    console.warn(`[Sentinel] Access control scan failed for ${_short(protocol)}: ${err.message}`);
    return 0n;
  }
}


function _getState(protocol) {
  if (!protocolState.has(protocol)) {
    protocolState.set(protocol, {
      lastTVL:       0n,
      tvlHistory:    [],
      volumeHistory: [],
      referenceAPY:  0n,
    });
  }
  return protocolState.get(protocol);
}

function _short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function resetState(protocol) {
  protocolState.delete(protocol);
}


export {
  computeSignals,
  resetState,
  SignalType,
};