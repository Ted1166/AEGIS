import { ethers } from "ethers";

const BRIDGE_ABI = [
  "event SendToIBC(address indexed sender, string receiver, address indexed token, uint256 amount)",
  "event AcknowledgePacket(bytes32 indexed channelId, uint64 sequence, bool success)",
  "event TimeoutPacket(bytes32 indexed channelId, uint64 sequence)",
];

const BRIDGE_TRANSFER_TOPIC    = ethers.id("SendToIBC(address,string,address,uint256)");
const BRIDGE_ACK_TOPIC         = ethers.id("AcknowledgePacket(bytes32,uint64,bool)");
const BRIDGE_TIMEOUT_TOPIC     = ethers.id("TimeoutPacket(bytes32,uint64)");

const VOLUME_HISTORY_WINDOW    = 20;
const TIMEOUT_THRESHOLD        = 3;
const VOLUME_SPIKE_MULTIPLIER  = 8n;

const bridgeState = new Map();

async function computeBridgeSignal(provider, bridgeAddress, blockNumber) {
  if (!bridgeAddress) return 0n;

  try {
    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock:   blockNumber,
      address:   bridgeAddress,
      topics:    [[BRIDGE_TRANSFER_TOPIC, BRIDGE_ACK_TOPIC, BRIDGE_TIMEOUT_TOPIC]],
    });

    const state = _getState(bridgeAddress);

    let blockVolume    = 0n;
    let timeoutCount   = 0;
    let failedAckCount = 0;

    for (const log of logs) {
      const topic = log.topics[0];

      if (topic === BRIDGE_TRANSFER_TOPIC) {
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256"],
            log.data
          );
          blockVolume += decoded[0];
        } catch { }
      }

      if (topic === BRIDGE_TIMEOUT_TOPIC) {
        timeoutCount++;
      }

      if (topic === BRIDGE_ACK_TOPIC) {
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint64", "bool"],
            log.data
          );
          if (!decoded[1]) failedAckCount++;
        } catch { }
      }
    }

    state.volumeHistory.push(blockVolume);
    if (state.volumeHistory.length > VOLUME_HISTORY_WINDOW) {
      state.volumeHistory.shift();
    }

    if (timeoutCount >= TIMEOUT_THRESHOLD) {
      console.warn(
        `[BridgeMonitor] Timeout spike | bridge: ${_short(bridgeAddress)} | ` +
        `timeouts: ${timeoutCount} | block: ${blockNumber}`
      );
      return 1n;
    }

    if (failedAckCount >= 2) {
      console.warn(
        `[BridgeMonitor] Failed ACKs | bridge: ${_short(bridgeAddress)} | ` +
        `failed: ${failedAckCount} | block: ${blockNumber}`
      );
      return 1n;
    }

    if (state.volumeHistory.length >= 5) {
      const historical = state.volumeHistory.slice(0, -1);
      const avg = historical.reduce((a, b) => a + b, 0n) / BigInt(historical.length);

      if (avg > 0n && blockVolume > avg * VOLUME_SPIKE_MULTIPLIER) {
        console.warn(
          `[BridgeMonitor] Volume spike | bridge: ${_short(bridgeAddress)} | ` +
          `vol: ${blockVolume} | avg: ${avg} | block: ${blockNumber}`
        );
        return 1n;
      }
    }

    return 0n;

  } catch (err) {
    console.warn(`[BridgeMonitor] Read failed for ${_short(bridgeAddress)}: ${err.message}`);
    return 0n;
  }
}

function _getState(address) {
  if (!bridgeState.has(address)) {
    bridgeState.set(address, {
      volumeHistory: [],
    });
  }
  return bridgeState.get(address);
}

function _short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function resetBridgeState(address) {
  bridgeState.delete(address);
}

export { computeBridgeSignal, resetBridgeState };