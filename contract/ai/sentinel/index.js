import "dotenv/config";
import { ethers } from "ethers";
import { computeSignals, resetState } from "./anomaly.js";


const VAULT_ABI = [
  "function getYieldSources() external view returns (address[])",
];

const GUARD_ABI = [
  "function recordSignals(address protocol, uint8[] calldata signals, uint256[] calldata values) external",
  "function checkAndExecute(address protocol) external returns (bool triggered)",
  "function isCheckable(address protocol) external view returns (bool)",
  "function isEmergency(address protocol) external view returns (bool)",
  "function getSignalState(address protocol) external view returns (bool tvlDrainage, bool oracleDeviation, bool flashLoan, bool accessControl, uint256 totalActive)",
  "event EmergencyTriggered(address indexed caller, address indexed protocol, uint256 bountyPaid)",
  "event SignalRecorded(address indexed protocol, uint8 signal, uint256 value, uint256 timestamp)",
];


const CONFIG = {
  rpcUrl:      process.env.POLKADOT_HUB_RPC_URL,
  privateKey:    process.env.SENTINEL_PRIVATE_KEY,
  vaultAddress:  process.env.AEGIS_VAULT_ADDRESS,
  guardAddress:  process.env.AEGIS_GUARD_ADDRESS,

  signalSubmitInterval: parseInt(process.env.SENTINEL_SUBMIT_INTERVAL || "1"),

  maxConcurrency: parseInt(process.env.SENTINEL_MAX_CONCURRENCY || "5"),

  reconnectDelay: parseInt(process.env.SENTINEL_RECONNECT_DELAY || "3000"),
};


function validateConfig() {
  const required = ["rpcUrl", "privateKey", "vaultAddress", "guardAddress"];
  for (const key of required) {
    if (!CONFIG[key]) {
      throw new Error(`[Sentinel] Missing env var for config.${key}`);
    }
  }
  // if (!CONFIG.rpcUrl.startsWith("ws")) {
  //   throw new Error("[Sentinel] POLKADOT_HUB_WS_URL must be a WebSocket URL (ws:// or wss://)");
  // }
}


let provider;
let signer;
let vault;
let guard;

let blockCount     = 0;
let isProcessing   = false; 
let lastBlockTime  = Date.now();
const blockTimes   = [];

const lastSubmitBlock = new Map();


async function bootstrap() {
  validateConfig();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        🛡️  Aegis Safety Sentinel             ║");
  console.log("║     Watching every block. Protecting all.    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`[Sentinel] Guard:  ${CONFIG.guardAddress}`);
  console.log(`[Sentinel] Vault:  ${CONFIG.vaultAddress}`);
  console.log(`[Sentinel] RPC:    ${CONFIG.rpcUrl.slice(0, 30)}...`);
  console.log("");

  await connect();
}


async function connect() {
  try {
    provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    signer   = new ethers.Wallet(CONFIG.privateKey, provider);
    vault    = new ethers.Contract(CONFIG.vaultAddress, VAULT_ABI, provider);
    guard    = new ethers.Contract(CONFIG.guardAddress, GUARD_ABI, signer);

    console.log(`[Sentinel] Connected | Signer: ${signer.address}`);
    provider.on("block", onBlock);

  } catch (err) {
    console.error("[Sentinel] Connection failed:", err.message);
    setTimeout(connect, CONFIG.reconnectDelay);
  }
}

async function onBlock(blockNumber) {
  const now = Date.now();
  blockTimes.push(now - lastBlockTime);
  if (blockTimes.length > 50) blockTimes.shift();
  lastBlockTime = now;
  blockCount++;

  if (isProcessing) {
    console.warn(`[Sentinel] Block ${blockNumber} skipped — still processing previous block`);
    return;
  }

  isProcessing = true;

  try {
    const sources = await vault.getYieldSources();

    if (sources.length === 0) {
      if (blockCount % 50 === 0) {
        console.log(`[Sentinel] Block ${blockNumber} | No yield sources registered`);
      }
      return;
    }

    if (blockCount % 10 === 0) {
      const avgBlockTime = blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
      console.log(
        `[Sentinel] Block ${blockNumber} | ` +
        `Sources: ${sources.length} | ` +
        `Avg block time: ${avgBlockTime.toFixed(0)}ms`
      );
    }

    await _processInBatches(sources, blockNumber, CONFIG.maxConcurrency);

  } catch (err) {
    console.error(`[Sentinel] Block ${blockNumber} processing error:`, err.message);
  } finally {
    isProcessing = false;
  }
}

async function _processInBatches(sources, blockNumber, batchSize) {
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(protocol => _processProtocol(protocol, blockNumber))
    );
  }
}

async function _processProtocol(protocol, blockNumber) {
  try {
    const emergency = await guard.isEmergency(protocol);
    if (emergency) {
      resetState(protocol);
      return;
    }

    const lastSubmit = lastSubmitBlock.get(protocol) || 0;
    const shouldSubmit = blockNumber >= lastSubmit + CONFIG.signalSubmitInterval;

    if (shouldSubmit) {
      const signals = await computeSignals(provider, protocol, blockNumber);

      await _submitSignals(protocol, signals, blockNumber);
      lastSubmitBlock.set(protocol, blockNumber);
    }

    const checkable = await guard.isCheckable(protocol);
    if (checkable) {
      await _checkAndExecute(protocol, blockNumber);
    }

  } catch (err) {
    console.error(`[Sentinel] Protocol ${_short(protocol)} error at block ${blockNumber}:`, err.message);
  }
}

async function _submitSignals(protocol, signals, blockNumber) {
  const signalTypes = signals.map(s => s.signalType);
  const values      = signals.map(s => s.value);

  const hasActivity = values.some(v => v > 0n);
  if (!hasActivity) return;

  try {
    const tx = await guard.recordSignals(protocol, signalTypes, values, {
      gasLimit: 300_000,
    });

    console.log(
      `[Sentinel] 📡 Signals submitted | ${_short(protocol)} | ` +
      `block ${blockNumber} | tx: ${tx.hash.slice(0, 10)}...`
    );

    for (const s of signals) {
      if (s.value > 0n) {
        const name = _signalName(s.signalType);
        console.log(`           ↳ ${name}: ${s.value}`);
      }
    }

  } catch (err) {
    console.error(`[Sentinel] Signal submission failed for ${_short(protocol)}: ${err.message}`);
  }
}

async function _checkAndExecute(protocol, blockNumber) {
  try {
    const triggered = await guard.checkAndExecute.staticCall(protocol);
    if (!triggered) return;

    console.warn(
      `[Sentinel] 🚨 THRESHOLD BREACHED | ${_short(protocol)} | block ${blockNumber}`
    );
    console.warn(`[Sentinel] 🚀 Calling checkAndExecute()...`);

    const tx = await guard.checkAndExecute(protocol, {
      gasLimit: 500_000,
    });

    const receipt = await tx.wait();

    const iface = new ethers.Interface(GUARD_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "EmergencyTriggered") {
          const bounty = ethers.formatUnits(parsed.args.bountyPaid, 6);
          console.warn(
            `[Sentinel] ✅ EMERGENCY EXECUTED | Protocol: ${parsed.args.protocol} | ` +
            `Bounty: $${bounty} USDC | tx: ${tx.hash}`
          );
        }
      } catch { /* not our event */ }
    }

    resetState(protocol);

  } catch (err) {
    if (err.message?.includes("revert")) return;
    console.error(`[Sentinel] checkAndExecute failed for ${_short(protocol)}:`, err.message);
  }
}

async function logHealthStatus() {
  try {
    const sources = await vault.getYieldSources();
    if (sources.length === 0) return;

    console.log("─── 🛡️  Sentinel Health Report ────────────────────");
    for (const protocol of sources) {
      const [tvl, oracle, flash, access, total] = await guard.getSignalState(protocol);
      const emergency = await guard.isEmergency(protocol);
      console.log(
        `  ${_short(protocol)} | ` +
        `TVL:${tvl ? "🔴" : "✅"} Oracle:${oracle ? "🔴" : "✅"} ` +
        `Flash:${flash ? "🔴" : "✅"} Access:${access ? "🔴" : "✅"} | ` +
        `Active: ${total}/4 | Emergency: ${emergency ? "🚨 YES" : "✅ No"}`
      );
    }
    console.log("────────────────────────────────────────────────────");
  } catch (err) {
    console.warn("[Sentinel] Health report failed:", err.message);
  }
}


function _short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function _signalName(type) {
  const names = ["TVL_DRAINAGE", "ORACLE_DEVIATION", "FLASH_LOAN_SPIKE", "ACCESS_CONTROL_ANOMALY"];
  return names[type] || `SIGNAL_${type}`;
}


process.on("SIGINT", () => {
  console.log("\n[Sentinel] Shutting down gracefully...");
  if (provider) provider.removeAllListeners();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[Sentinel] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Sentinel] Unhandled rejection:", reason);
});


setInterval(logHealthStatus, 5 * 60 * 1000);

bootstrap().catch((err) => {
  console.error("[Sentinel] Fatal bootstrap error:", err);
  process.exit(1);
});