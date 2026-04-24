import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import http from "http";
import { generateReport } from "./report_generator.js";

const VAULT_ABI = [
  "function getYieldSources() external view returns (address[])",
  "function balanceOf(address user) external view returns (uint256)",
  "event Deposited(address indexed user, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed user, uint256 shares, uint256 amount)",
  "event Rebalanced(address indexed caller, uint256 timestamp)",
];

const GUARD_ABI = [
  "event EmergencyTriggered(address indexed caller, address indexed protocol, uint256 bountyPaid)",
];

const SOURCE_ABI = [
  "function name() external view returns (string)",
];

const CONFIG = {
  rpcUrl:          process.env.INITIA_RPC_URL,
  privateKey:      process.env.ADVISOR_PRIVATE_KEY,
  vaultAddress:    process.env.AEGIS_VAULT_ADDRESS,
  oracleAddress:   process.env.YIELD_ORACLE_ADDRESS,
  guardAddress:    process.env.AEGIS_GUARD_ADDRESS,
  treasuryAddress: process.env.AEGIS_TREASURY_ADDRESS,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  apiPort:         parseInt(process.env.ADVISOR_API_PORT || "3001"),
  reportsDir:      process.env.ADVISOR_REPORTS_DIR || "./reports",
  reportRetention: 12,
  weeklyBlockWindow: 302_400,
};

function validateConfig() {
  const required = [
    "rpcUrl", "privateKey", "vaultAddress", "oracleAddress",
    "guardAddress", "treasuryAddress", "anthropicApiKey",
  ];
  for (const key of required) {
    if (!CONFIG[key]) throw new Error(`[Advisor] Missing env var for config.${key}`);
  }
  fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
}

let provider;
let signer;
let vault;

let runCount     = 0;
let totalReports = 0;
let totalErrors  = 0;

async function bootstrap() {
  validateConfig();

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║      Aegis Weekly Advisor — Initia           ║");
  console.log("║   Plain-English savings reports, every week. ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`[Advisor] Vault:    ${CONFIG.vaultAddress}`);
  console.log(`[Advisor] Reports:  ${CONFIG.reportsDir}`);
  console.log(`[Advisor] API port: ${CONFIG.apiPort}`);
  console.log("");

  provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  signer   = new ethers.Wallet(CONFIG.privateKey, provider);
  vault    = new ethers.Contract(CONFIG.vaultAddress, VAULT_ABI, provider);

  console.log(`[Advisor] Signer: ${signer.address}`);

  _startApiServer();
  _scheduleCron();

  if (process.env.ADVISOR_RUN_ON_START === "true") {
    console.log("[Advisor] Running immediately (ADVISOR_RUN_ON_START=true)");
    await runWeeklyReports();
  }
}

function _scheduleCron() {
  const targetDay  = parseInt(process.env.ADVISOR_CRON_DAY  || "0");
  const targetHour = parseInt(process.env.ADVISOR_CRON_HOUR || "0");

  console.log(`[Advisor] Scheduled: day ${targetDay} (0=Sun) at ${targetHour}:00 UTC`);

  let lastRunDate = null;

  setInterval(() => {
    const now      = new Date();
    const dayOfWeek = now.getUTCDay();
    const hour      = now.getUTCHours();
    const dateKey   = `${now.getUTCFullYear()}-W${_isoWeek(now)}`;

    if (dayOfWeek === targetDay && hour === targetHour && lastRunDate !== dateKey) {
      lastRunDate = dateKey;
      console.log(`[Advisor] Weekly cron triggered — ${now.toISOString()}`);
      runWeeklyReports().catch(err =>
        console.error("[Advisor] Weekly run error:", err.message)
      );
    }
  }, 60 * 1000);
}

async function runWeeklyReports() {
  runCount++;
  const start = Date.now();

  console.log(`\n[Advisor] Weekly Run ${runCount} ──────────────────────`);

  const users = await _discoverUsers();
  console.log(`[Advisor] Found ${users.length} user(s) to report on`);

  if (users.length === 0) {
    console.log("[Advisor] No users with active balances — skipping");
    return;
  }

  const currentBlock = await provider.getBlockNumber();
  const fromBlock    = Math.max(0, currentBlock - CONFIG.weeklyBlockWindow);
  const weeklyEvents = await _fetchWeeklyEvents(fromBlock, currentBlock);

  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const periodEnd   = new Date().toISOString().split("T")[0];

  let successCount = 0;
  for (const user of users) {
    try {
      await _generateAndStoreReport(user, weeklyEvents, periodStart, periodEnd);
      successCount++;
      await _sleep(500);
    } catch (err) {
      totalErrors++;
      console.error(`[Advisor] Report failed for ${_short(user)}: ${err.message}`);
    }
  }

  totalReports += successCount;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[Advisor] Run ${runCount} complete | ` +
    `${successCount}/${users.length} reports | ` +
    `${elapsed}s | total reports: ${totalReports}`
  );
}

async function _discoverUsers() {
  try {
    const events     = await vault.queryFilter(vault.filters.Deposited());
    const candidates = [...new Set(events.map(e => e.args.user))];
    const activeUsers = [];

    for (const user of candidates) {
      try {
        const balance = await vault.balanceOf(user);
        if (balance > 0n) activeUsers.push(user);
      } catch { }
    }
    return activeUsers;
  } catch (err) {
    console.warn("[Advisor] User discovery error:", err.message);
    return [];
  }
}

async function _fetchWeeklyEvents(fromBlock, toBlock) {
  const guard = new ethers.Contract(CONFIG.guardAddress, GUARD_ABI, provider);

  const [deposits, withdrawals, rebalances, emergencies] = await Promise.all([
    vault.queryFilter(vault.filters.Deposited(),  fromBlock, toBlock).catch(() => []),
    vault.queryFilter(vault.filters.Withdrawn(),  fromBlock, toBlock).catch(() => []),
    vault.queryFilter(vault.filters.Rebalanced(), fromBlock, toBlock).catch(() => []),
    guard.queryFilter(guard.filters.EmergencyTriggered(), fromBlock, toBlock).catch(() => []),
  ]);

  const emergencyEntries = await Promise.all(
    emergencies.map(async e => {
      const protocolName = await _getProtocolName(e.args.protocol);
      return {
        protocol:  e.args.protocol,
        name:      protocolName,
        timestamp: new Date(Number(e.args[2] || 0) * 1000).toISOString().split("T")[0] || "this week",
        txHash:    e.transactionHash,
      };
    })
  );

  return {
    deposits,
    withdrawals,
    rebalanceCount:   rebalances.length,
    emergencyEvents:  emergencyEntries,
    rebalanceReasons: _describeRebalances(rebalances.length, emergencyEntries),
  };
}

async function _generateAndStoreReport(user, weeklyEvents, periodStart, periodEnd) {
  const userDeposits    = weeklyEvents.deposits.filter(e => e.args.user === user);
  const userWithdrawals = weeklyEvents.withdrawals.filter(e => e.args.user === user);

  const currentBalance  = await vault.balanceOf(user);
  const depositedAmount = userDeposits.reduce((sum, e) => sum + e.args.amount, 0n);
  const withdrawnAmount = userWithdrawals.reduce((sum, e) => sum + e.args.amount, 0n);

  const lastReport      = _loadLastReport(user);
  const startBalanceRaw = lastReport?.balanceRaw
    ? BigInt(lastReport.balanceRaw)
    : currentBalance;

  const netChange    = currentBalance - startBalanceRaw + withdrawnAmount - depositedAmount;
  const weeklyEarned = netChange > 0n ? _formatUSDC(netChange) : "0.00";

  const weeklyStats = {
    startBalance:    lastReport?.balance || _formatUSDC(startBalanceRaw),
    weeklyEarned,
    rebalanceCount:  weeklyEvents.rebalanceCount,
    depositCount:    userDeposits.length,
    withdrawalCount: userWithdrawals.length,
    emergencyEvents: weeklyEvents.emergencyEvents,
    rebalanceReasons: weeklyEvents.rebalanceReasons,
    periodStart,
    periodEnd,
  };

  console.log(`[Advisor] Generating report for ${_short(user)}...`);

  const report = await generateReport({
    provider,
    userAddress:     user,
    vaultAddress:    CONFIG.vaultAddress,
    oracleAddress:   CONFIG.oracleAddress,
    guardAddress:    CONFIG.guardAddress,
    treasuryAddress: CONFIG.treasuryAddress,
    weeklyStats,
    anthropicApiKey: CONFIG.anthropicApiKey,
  });

  report.balanceRaw = currentBalance.toString();
  _storeReport(user, report);

  console.log(
    `[Advisor] Report stored | ${_short(user)} | ` +
    `earned: $${weeklyEarned} | alerts: ${report.alerts.length}`
  );
}

function _storeReport(user, report) {
  const filePath = path.join(CONFIG.reportsDir, `${user.toLowerCase()}.json`);
  let existing = { history: [] };
  try { existing = JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { }

  existing.history.unshift(report);
  if (existing.history.length > CONFIG.reportRetention) {
    existing.history = existing.history.slice(0, CONFIG.reportRetention);
  }
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

function _loadLastReport(user) {
  const filePath = path.join(CONFIG.reportsDir, `${user.toLowerCase()}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data.history?.[0] || null;
  } catch { return null; }
}

function _startApiServer() {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    const url = req.url || "";

    if (url === "/health") {
      return res.end(JSON.stringify({ status: "ok", runCount, totalReports, totalErrors, uptime: process.uptime() }));
    }

    const match = url.match(/^\/report\/(0x[a-fA-F0-9]{40})(\/history)?$/);
    if (!match) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Not found" }));
    }

    const userAddress = match[1].toLowerCase();
    const wantHistory = !!match[2];
    const filePath    = path.join(CONFIG.reportsDir, `${userAddress}.json`);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (wantHistory) {
        return res.end(JSON.stringify({ history: data.history || [] }));
      }
      const latest = data.history?.[0];
      if (!latest) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "No report found" }));
      }
      return res.end(JSON.stringify(latest));
    } catch {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "No reports for this address" }));
    }
  });

  server.listen(CONFIG.apiPort, () => {
    console.log(`[Advisor] Report API running on port ${CONFIG.apiPort}`);
  });
}

function _formatUSDC(raw) {
  if (!raw && raw !== 0n) return "0.00";
  return (Number(raw) / 1e6).toFixed(2);
}

function _short(addr) { return `${addr?.slice(0, 6)}...${addr?.slice(-4)}`; }

function _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function _isoWeek(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
}

async function _getProtocolName(address) {
  try {
    const c = new ethers.Contract(address, SOURCE_ABI, provider);
    return await c.name();
  } catch { return _short(address); }
}

function _describeRebalances(count, emergencies) {
  const reasons = [];
  if (count === 0) return reasons;
  if (emergencies.length > 0) {
    reasons.push(
      `Emergency rebalance triggered — funds moved to safe harbor after anomaly detected in ${emergencies.map(e => e.name).join(", ")}`
    );
  }
  if (count > emergencies.length) {
    reasons.push("Routine AI rebalance — allocation updated based on current Yield Quality Scores");
  }
  return reasons;
}

process.on("SIGINT", () => {
  console.log(`\n[Advisor] Shutting down | runs: ${runCount} | reports: ${totalReports} | errors: ${totalErrors}`);
  process.exit(0);
});

process.on("uncaughtException",  err => console.error("[Advisor] Uncaught:", err));
process.on("unhandledRejection", r   => console.error("[Advisor] Unhandled rejection:", r));

bootstrap().catch(err => {
  console.error("[Advisor] Fatal bootstrap error:", err);
  process.exit(1);
});