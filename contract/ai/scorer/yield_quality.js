import { ethers } from "ethers";

const YIELD_SOURCE_ABI = [
  "function currentAPY() external view returns (uint256)",
  "function protocolTVL() external view returns (uint256)",
  "function protocolAddress() external view returns (address)",
  "function name() external view returns (string)",
];

const SUSTAINABILITY_APY_CAP_BPS = 5_000n;
const TVL_FLOOR_DEFAULT = 500_000n * 1_000_000n;
const TVL_CEILING = 10_000_000n * 1_000_000n;
const MAX_ERRORS_BEFORE_UNHEALTHY = 3;
const scoringState = new Map();
const APY_HISTORY_WINDOW = 6;


async function computeYieldScore(provider, sourceAddress, options = {}) {
  const source = new ethers.Contract(sourceAddress, YIELD_SOURCE_ABI, provider);
  const state  = _getState(sourceAddress);

  let sourceName = sourceAddress;

  try {
    const [totalAPYBps, tvl, protocolAddr, name] = await Promise.all([
      source.currentAPY(),
      source.protocolTVL(),
      source.protocolAddress(),
      source.name().catch(() => sourceAddress),
    ]);

    sourceName = name;

    const { realYieldBps, emissionsYieldBps } = await _resolveYieldSplit(
      provider,
      sourceAddress,
      protocolAddr,
      totalAPYBps,
      options.emissionsResolver
    );

    state.apyHistory.push(totalAPYBps);
    if (state.apyHistory.length > APY_HISTORY_WINDOW) state.apyHistory.shift();

    const tvlFloor       = options.tvlFloor || TVL_FLOOR_DEFAULT;
    const realYieldScore = _scoreRealYield(realYieldBps, totalAPYBps);
    const tvlScore       = _scoreTVL(tvl, tvlFloor);
    const sustainScore   = _scoreSustainability(totalAPYBps, state.apyHistory);
    const emissionsPenalty = _emissionsPenalty(emissionsYieldBps, totalAPYBps);

    const rawScore =
      (realYieldScore  * 50n +
       tvlScore        * 25n +
       sustainScore    * 25n) / 100n;

    const score = _clamp(rawScore - emissionsPenalty, 0n, 100n);
    const tier  = _scoreTier(score);

    state.errorCount = 0;
    state.lastScore  = score;

    const result = {
      sourceAddress,
      name:              sourceName,
      score,
      realYieldBps,
      emissionsYieldBps,
      totalAPYBps,
      tvl,
      tvlFloor,
      tier,
      _debug: { realYieldScore, tvlScore, sustainScore, emissionsPenalty },
    };

    _logScore(result);
    return result;

  } catch (err) {
    state.errorCount++;
    console.error(
      `[Scorer] Failed to score ${sourceName} | ` +
      `errors: ${state.errorCount} | ${err.message}`
    );

    if (state.errorCount >= MAX_ERRORS_BEFORE_UNHEALTHY) {
      console.warn(`[Scorer] ⚠️  ${sourceName} marked unhealthy after ${state.errorCount} consecutive errors`);
    }

    return {
      sourceAddress,
      name:              sourceName,
      score:             state.lastScore ?? 0n,
      realYieldBps:      0n,
      emissionsYieldBps: 0n,
      totalAPYBps:       0n,
      tvl:               0n,
      tvlFloor:          options.tvlFloor || TVL_FLOOR_DEFAULT,
      tier:              0,
      error:             err.message,
    };
  }
}

async function _resolveYieldSplit(provider, sourceAddress, protocolAddr, totalAPYBps, resolver) {
  if (typeof resolver === "function") {
    try {
      const split = await resolver(provider, protocolAddr, totalAPYBps);
      if (split?.realYieldBps !== undefined) {
        const real      = _clamp(split.realYieldBps, 0n, totalAPYBps);
        const emissions = totalAPYBps - real;
        return { realYieldBps: real, emissionsYieldBps: emissions };
      }
    } catch (err) {
      console.warn(`[Scorer] Custom emissions resolver failed: ${err.message} — falling back to heuristic`);
    }
  }

  console.log(`[Scorer] Using APY heuristic for emissions split (${_short(sourceAddress)})`);

  let realFractionBps;
  if      (totalAPYBps <= 500n)  realFractionBps = 9_000n;
  else if (totalAPYBps <= 1_500n) realFractionBps = 6_000n;
  else if (totalAPYBps <= 3_000n) realFractionBps = 3_000n;
  else                             realFractionBps = 1_000n;

  const realYieldBps      = (totalAPYBps * realFractionBps) / 10_000n;
  const emissionsYieldBps = totalAPYBps - realYieldBps;

  return { realYieldBps, emissionsYieldBps };
}


function _scoreRealYield(realYieldBps, totalAPYBps) {
  if (totalAPYBps === 0n) return 0n;
  const realFraction = (realYieldBps * 100n) / totalAPYBps;
  return _clamp(realFraction, 0n, 100n);
}

function _scoreTVL(tvl, tvlFloor) {
  if (tvl < tvlFloor) return 0n;
  if (tvl >= TVL_CEILING) return 100n;

  const range = TVL_CEILING - tvlFloor;
  const position = tvl - tvlFloor;
  return _clamp((position * 100n) / range, 10n, 100n);
}

function _scoreSustainability(totalAPYBps, apyHistory) {
  let score = 100n;

  if (totalAPYBps > SUSTAINABILITY_APY_CAP_BPS) {
    const excess = totalAPYBps - SUSTAINABILITY_APY_CAP_BPS;
    const penalty = _clamp((excess * 30n) / SUSTAINABILITY_APY_CAP_BPS, 0n, 60n);
    score -= penalty;
  }

  if (apyHistory.length >= 3) {
    const avg = apyHistory.reduce((a, b) => a + b, 0n) / BigInt(apyHistory.length);
    if (avg > 0n) {
      const variance = apyHistory.reduce((acc, v) => {
        const diff = v > avg ? v - avg : avg - v;
        return acc + diff * diff;
      }, 0n) / BigInt(apyHistory.length);

      const stdDev = _isqrt(variance);
      const cvBps  = (stdDev * 10_000n) / avg;

      if (cvBps > 2_000n) {
        const volatilityPenalty = _clamp((cvBps - 2_000n) / 300n, 0n, 30n);
        score -= volatilityPenalty;
      }
    }
  }

  return _clamp(score, 0n, 100n);
}

function _emissionsPenalty(emissionsYieldBps, totalAPYBps) {
  if (totalAPYBps === 0n) return 0n;
  const emissionsFraction = (emissionsYieldBps * 100n) / totalAPYBps;
  return _clamp((emissionsFraction * 40n) / 100n, 0n, 40n);
}


function _scoreTier(score) {
  if (score >= 70n) return 2;
  if (score >= 40n) return 1;
  return 0;
}

const TIER_LABELS = ["🔴 Risky", "🟡 Mixed", "🟢 Sustainable"];


function _clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Integer square root (Newton's method) */
function _isqrt(n) {
  if (n < 0n) return 0n;
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function _getState(address) {
  if (!scoringState.has(address)) {
    scoringState.set(address, {
      apyHistory: [],
      lastScore:  null,
      errorCount: 0,
    });
  }
  return scoringState.get(address);
}

function _short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function _formatAPY(bps) {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

function _formatUSDC(raw) {
  return `$${(Number(raw) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function _logScore(result) {
  const { name, score, totalAPYBps, tvl, tier, realYieldBps, emissionsYieldBps, _debug } = result;
  const tierLabel = TIER_LABELS[tier];

  console.log(
    `[Scorer] ${tierLabel} | ${name} | ` +
    `Score: ${score}/100 | ` +
    `APY: ${_formatAPY(totalAPYBps)} | ` +
    `TVL: ${_formatUSDC(tvl)}`
  );
  console.log(
    `         Real: ${_formatAPY(realYieldBps)} | ` +
    `Emissions: ${_formatAPY(emissionsYieldBps)} | ` +
    `Sub-scores → Real:${_debug.realYieldScore} TVL:${_debug.tvlScore} ` +
    `Sustain:${_debug.sustainScore} EmissionsPenalty:-${_debug.emissionsPenalty}`
  );
}


export {
  computeYieldScore,
  TIER_LABELS,
  TVL_FLOOR_DEFAULT,
  SUSTAINABILITY_APY_CAP_BPS,
};