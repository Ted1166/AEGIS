import { ethers } from "ethers";

const VAULT_ABI = [
  "function balanceOf(address user) external view returns (uint256)",
  "function getUserShares(address user) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
  "function getYieldSources() external view returns (address[])",
  "function bufferBalance() external view returns (uint256)",
  "function sourceInEmergency(address) external view returns (bool)",
  "event Deposited(address indexed user, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed user, uint256 shares, uint256 amount)",
  "event Rebalanced(address indexed caller, uint256 timestamp)",
];

const ORACLE_ABI = [
  "function getScoreUnchecked(address protocol) external view returns (tuple(uint256 score, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 updatedAt, uint8 tier, bool active))",
];

const GUARD_ABI = [
  "event EmergencyTriggered(address indexed caller, address indexed protocol, uint256 bountyPaid)",
  "function isEmergency(address protocol) external view returns (bool)",
];

const TREASURY_ABI = [
  "function claimableBalance(address user) external view returns (uint256)",
];

const SOURCE_ABI = [
  "function name() external view returns (string)",
  "function currentAPY() external view returns (uint256)",
  "function balanceOf() external view returns (uint256)",
];

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL   = "claude-sonnet-4-6";


async function generateReport({
  provider,
  userAddress,
  vaultAddress,
  oracleAddress,
  guardAddress,
  treasuryAddress,
  weeklyStats,
  anthropicApiKey,
}) {
  const context = await _buildUserContext({
    provider,
    userAddress,
    vaultAddress,
    oracleAddress,
    guardAddress,
    treasuryAddress,
    weeklyStats,
  });

  const rawReport = await _callClaude(context, anthropicApiKey);

  const report = _parseReport(rawReport, context);

  return report;
}

async function _buildUserContext({
  provider,
  userAddress,
  vaultAddress,
  oracleAddress,
  guardAddress,
  treasuryAddress,
  weeklyStats,
}) {
  const vault    = new ethers.Contract(vaultAddress,    VAULT_ABI,    provider);
  const oracle   = new ethers.Contract(oracleAddress,   ORACLE_ABI,   provider);
  const guard    = new ethers.Contract(guardAddress,    GUARD_ABI,    provider);
  const treasury = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

  const [currentBalanceRaw, claimableRaw, sources] = await Promise.all([
    vault.balanceOf(userAddress),
    treasury.claimableBalance(userAddress),
    vault.getYieldSources(),
  ]);

  const currentBalance = _formatUSDC(currentBalanceRaw);
  const claimable      = _formatUSDC(claimableRaw);

  const sourceBreakdowns = await Promise.all(
    sources.map(async (src) => {
      const sourceContract = new ethers.Contract(src, SOURCE_ABI, provider);
      const [name, apyRaw, tvlRaw, scoreEntry, inEmergency] = await Promise.all([
        sourceContract.name().catch(() => _short(src)),
        sourceContract.currentAPY().catch(() => 0n),
        sourceContract.balanceOf().catch(() => 0n),
        oracle.getScoreUnchecked(src).catch(() => null),
        guard.isEmergency(src).catch(() => false),
      ]);

      return {
        address:     src,
        name,
        apy:         `${(Number(apyRaw) / 100).toFixed(2)}%`,
        tvl:         _formatUSDC(tvlRaw),
        score:       scoreEntry ? Number(scoreEntry.score) : null,
        tier:        scoreEntry ? ["Risky", "Mixed", "Sustainable"][scoreEntry.tier] : "Unknown",
        realYield:   scoreEntry ? `${(Number(scoreEntry.realYieldBps) / 100).toFixed(2)}%` : "N/A",
        emissions:   scoreEntry ? `${(Number(scoreEntry.emissionsYieldBps) / 100).toFixed(2)}%` : "N/A",
        inEmergency,
      };
    })
  );

  const {
    startBalance        = "0.00",
    weeklyEarned        = "0.00",
    rebalanceCount      = 0,
    depositCount        = 0,
    withdrawalCount     = 0,
    emergencyEvents     = [],
    rebalanceReasons    = [],
    periodStart,
    periodEnd,
  } = weeklyStats || {};

  return {
    user:            userAddress,
    reportDate:      new Date().toISOString().split("T")[0],
    period:          `${periodStart} → ${periodEnd}`,
    currentBalance,
    startBalance,
    weeklyEarned,
    claimable,
    sources:         sourceBreakdowns,
    rebalanceCount,
    depositCount,
    withdrawalCount,
    emergencyEvents,
    rebalanceReasons,
  };
}

async function _callClaude(context, apiKey) {
  const prompt = _buildPrompt(context);

  const response = await fetch(CLAUDE_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 1000,
      system:     _systemPrompt(),
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  const text = data.content
    ?.filter(block => block.type === "text")
    .map(block => block.text)
    .join("") || "";

  if (!text) throw new Error("Claude returned empty response");

  const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Claude response was not valid JSON: ${clean.slice(0, 200)}`);
  }
}


function _systemPrompt() {
  return `You are the Aegis AI Advisor — a friendly, clear financial assistant that explains DeFi savings performance in plain English that anyone can understand. No jargon. No condescension. Be warm, concise, and honest. Never invent numbers — only use data provided.

You MUST respond with ONLY a valid JSON object. No preamble, no explanation, no markdown. Just the JSON.

The JSON must have exactly this structure:
{
  "summary": "2–3 sentence plain-English overview of the user's week",
  "earned": "Plain-English sentence about how much was earned and where",
  "movements": "Plain-English explanation of any rebalances or AI decisions this week",
  "outlook": "1–2 sentence risk outlook for next 7 days based on current source scores",
  "alerts": ["array of alert strings if any emergency events, empty array if none"],
  "tip": "One short friendly savings tip or observation tailored to their portfolio"
}`;
}

function _buildPrompt(ctx) {
  const sourceLines = ctx.sources.map(s =>
    `  - ${s.name}: APY ${s.apy} | Score ${s.score ?? "N/A"}/100 (${s.tier}) | Real yield: ${s.realYield} | Emissions: ${s.emissions}${s.inEmergency ? " | ⚠️ IN EMERGENCY" : ""}`
  ).join("\n");

  const emergencyLines = ctx.emergencyEvents.length > 0
    ? ctx.emergencyEvents.map(e => `  - EMERGENCY: ${e.protocol} at ${e.timestamp}`).join("\n")
    : "  None this week.";

  const rebalanceLines = ctx.rebalanceReasons.length > 0
    ? ctx.rebalanceReasons.map(r => `  - ${r}`).join("\n")
    : "  No rebalances triggered this week.";

  return `Generate a weekly savings report for this Aegis vault user.

USER DATA:
- Wallet: ${ctx.user}
- Report date: ${ctx.reportDate}
- Period: ${ctx.period}
- Balance at start of week: $${ctx.startBalance} USDC
- Balance now: $${ctx.currentBalance} USDC
- Earned this week: $${ctx.weeklyEarned} USDC
- Claimable from safe harbor: $${ctx.claimable} USDC

ACTIVITY THIS WEEK:
- Deposits made: ${ctx.depositCount}
- Withdrawals made: ${ctx.withdrawalCount}
- AI rebalances triggered: ${ctx.rebalanceCount}

YIELD SOURCES (current state):
${sourceLines}

AI REBALANCE REASONS:
${rebalanceLines}

EMERGENCY EVENTS:
${emergencyLines}

Now generate the JSON report.`;
}

function _parseReport(raw, context) {
  const report = {
    user:        context.user,
    reportDate:  context.reportDate,
    period:      context.period,
    balance:     context.currentBalance,
    earned:      context.weeklyEarned,
    summary:     raw?.summary   || `Your Aegis vault earned $${context.weeklyEarned} USDC this week.`,
    earnedText:  raw?.earned    || `You earned $${context.weeklyEarned} from your active yield sources.`,
    movements:   raw?.movements || "No significant allocation changes this week.",
    outlook:     raw?.outlook   || "Monitoring all sources. No elevated risk signals detected.",
    alerts:      Array.isArray(raw?.alerts) ? raw.alerts : [],
    tip:         raw?.tip       || "Consistent savings in low-volatility sources compounds steadily over time.",
    generatedAt: Date.now(),
    sources:     context.sources.map(s => ({
      name:  s.name,
      score: s.score,
      tier:  s.tier,
      apy:   s.apy,
    })),
  };

  return report;
}

function _formatUSDC(raw) {
  if (!raw && raw !== 0n) return "0.00";
  return (Number(raw) / 1e6).toFixed(2);
}

function _short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}


export{ generateReport };