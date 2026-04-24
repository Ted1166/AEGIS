import "dotenv/config";
import { ethers } from "ethers";
import { computeYieldScore, TVL_FLOOR_DEFAULT } from "./yield_quality.js";

const VAULT_ABI = [
  "function getYieldSources() external view returns (address[])",
];

const ORACLE_ABI = [
  "function writeScore(address protocol, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 tvlFloor) external",
  "function isScoreFresh(address protocol) external view returns (bool)",
  "function getScoreUnchecked(address protocol) external view returns (tuple(uint256 score, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 updatedAt, uint8 tier, bool active))",
  "function addProtocol(address protocol) external",
  "function scores(address) external view returns (tuple(uint256 score, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 updatedAt, uint8 tier, bool active))",
  "event ScoreUpdated(address indexed protocol, uint256 score, uint256 realYieldBps, uint256 totalAPYBps, uint256 tvl, uint8 tier)",
];

const CONFIG = {
  rpcUrl:         process.env.INITIA_RPC_URL,
  privateKey:     process.env.SCORER_PRIVATE_KEY,
  vaultAddress:   process.env.AEGIS_VAULT_ADDRESS,
  oracleAddress:  process.env.YIELD_ORACLE_ADDRESS,
  intervalMs:     parseInt(process.env.SCORER_INTERVAL_MS || "600000"),
  maxConcurrency: parseInt(process.env.SCORER_MAX_CONCURRENCY || "3"),
};

function validateConfig() {
  const required = ["rpcUrl", "privateKey", "vaultAddress", "oracleAddress"];
  for (const key of required) {
    if (!CONFIG[key]) throw new Error(`[Scorer] Missing env var for config.${key}`);
  }
}

let provider;
let signer;
let vault;
let oracle;

let runCount     = 0;
let totalScored  = 0;
let totalWritten = 0;
let totalErrors  = 0;

async function bootstrap() {
  validateConfig();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        Aegis Yield Brain — Initia            ║");
  console.log("║   Scoring yield. Protecting every deposit.   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`[Scorer] Oracle:   ${CONFIG.oracleAddress}`);
  console.log(`[Scorer] Vault:    ${CONFIG.vaultAddress}`);
  console.log(`[Scorer] Interval: ${CONFIG.intervalMs / 1000}s`);
  console.log("");

  provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  signer   = new ethers.Wallet(CONFIG.privateKey, provider);
  vault    = new ethers.Contract(CONFIG.vaultAddress,  VAULT_ABI,  provider);
  oracle   = new ethers.Contract(CONFIG.oracleAddress, ORACLE_ABI, signer);

  console.log(`[Scorer] Signer: ${signer.address}`);

  await runScoringRound();
  setInterval(runScoringRound, CONFIG.intervalMs);
}

async function runScoringRound() {
  runCount++;
  const start   = Date.now();
  const sources = await vault.getYieldSources().catch(err => {
    console.error("[Scorer] Failed to fetch yield sources:", err.message);
    return [];
  });

  if (sources.length === 0) {
    console.log(`[Scorer] Round ${runCount} | No yield sources registered — skipping`);
    return;
  }

  console.log(`\n[Scorer] Round ${runCount} | ${sources.length} source(s)`);

  await _ensureOracleTracking(sources);

  const results = await _computeAllScores(sources);
  await _writeAllScores(results);

  const elapsed    = ((Date.now() - start) / 1000).toFixed(1);
  const successful = results.filter(r => !r.error).length;

  console.log(
    `[Scorer] Round ${runCount} complete | ` +
    `${successful}/${sources.length} scored | ` +
    `${elapsed}s | total written: ${totalWritten}`
  );
}

async function _ensureOracleTracking(sources) {
  for (const source of sources) {
    try {
      const entry = await oracle.scores(source);
      if (!entry.active) {
        const tx = await oracle.addProtocol(source, { gasLimit: 150_000 });
        await tx.wait();
        console.log(`[Scorer] Tracked: ${_short(source)}`);
      }
    } catch {
      try {
        const tx = await oracle.addProtocol(source, { gasLimit: 150_000 });
        await tx.wait();
        console.log(`[Scorer] Auto-tracked: ${_short(source)}`);
      } catch (addErr) {
        console.warn(`[Scorer] Could not track ${_short(source)}: ${addErr.message}`);
      }
    }
  }
}

async function _computeAllScores(sources) {
  const results = [];

  for (let i = 0; i < sources.length; i += CONFIG.maxConcurrency) {
    const batch        = sources.slice(i, i + CONFIG.maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async source => {
        const envKey   = `SCORER_TVL_FLOOR_${source.toLowerCase()}`;
        const tvlFloor = process.env[envKey]
          ? BigInt(process.env[envKey])
          : TVL_FLOOR_DEFAULT;
        return computeYieldScore(provider, source, { tvlFloor });
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const settled = batchResults[j];
      if (settled.status === "fulfilled") {
        results.push(settled.value);
        totalScored++;
      } else {
        totalErrors++;
        results.push({
          sourceAddress:     batch[j],
          error:             settled.reason?.message || "unknown error",
          score:             0n,
          realYieldBps:      0n,
          emissionsYieldBps: 0n,
          totalAPYBps:       0n,
          tvl:               0n,
          tvlFloor:          TVL_FLOOR_DEFAULT,
        });
      }
    }
  }

  return results;
}

async function _writeAllScores(results) {
  for (const result of results) {
    if (result.error) {
      console.warn(`[Scorer] Skipping ${_short(result.sourceAddress)} — error: ${result.error}`);
      continue;
    }
    if (result.totalAPYBps === 0n) {
      console.warn(`[Scorer] Skipping ${_short(result.sourceAddress)} — zero APY`);
      continue;
    }
    try {
      await _writeScore(result);
    } catch (err) {
      totalErrors++;
      console.error(`[Scorer] Write failed for ${_short(result.sourceAddress)}: ${err.message}`);
    }
  }
}

async function _writeScore(result) {
  const { sourceAddress, name, score, realYieldBps, emissionsYieldBps, totalAPYBps, tvl, tvlFloor, tier } = result;
  const tierLabel = ["Risky", "Mixed", "Sustainable"][tier] || "Unknown";

  const tx = await oracle.writeScore(
    sourceAddress,
    realYieldBps,
    emissionsYieldBps,
    totalAPYBps,
    tvl,
    tvlFloor,
    { gasLimit: 200_000 }
  );
  await tx.wait();

  totalWritten++;
  console.log(
    `[Scorer] Written | ${name || _short(sourceAddress)} | ` +
    `Score: ${score}/100 (${tierLabel}) | tx: ${tx.hash.slice(0, 10)}...`
  );
}

async function logOracleSnapshot() {
  try {
    const sources = await vault.getYieldSources();
    if (sources.length === 0) return;

    console.log("\n[Scorer] Oracle Snapshot ─────────────────────────");
    for (const src of sources) {
      try {
        const entry = await oracle.getScoreUnchecked(src);
        const age   = Math.round((Date.now() / 1000) - Number(entry.updatedAt));
        const tier  = ["Risky", "Mixed", "Sustainable"][entry.tier] || "?";
        const apy   = (Number(entry.totalAPYBps) / 100).toFixed(2);
        const tvl   = (Number(entry.tvl) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
        console.log(
          `  ${_short(src)} | Score: ${entry.score}/100 | ` +
          `Tier: ${tier} | APY: ${apy}% | TVL: $${tvl} | Age: ${age}s`
        );
      } catch {
        console.log(`  ${_short(src)} | no score on record`);
      }
    }
    console.log("[Scorer] ────────────────────────────────────────────\n");
  } catch (err) {
    console.warn("[Scorer] Snapshot failed:", err.message);
  }
}

function _short(addr) {
  return `${addr?.slice(0, 6)}...${addr?.slice(-4)}`;
}

process.on("SIGINT", () => {
  console.log(`\n[Scorer] Shutting down | runs: ${runCount} | written: ${totalWritten} | errors: ${totalErrors}`);
  process.exit(0);
});

process.on("uncaughtException",  err => console.error("[Scorer] Uncaught:", err));
process.on("unhandledRejection", r   => console.error("[Scorer] Unhandled rejection:", r));

setInterval(logOracleSnapshot, 60 * 60 * 1000);

bootstrap().catch(err => {
  console.error("[Scorer] Fatal bootstrap error:", err);
  process.exit(1);
});