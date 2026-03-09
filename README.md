# 🛡️ Aegis — AI-Guarded Stablecoin Vault on Polkadot Hub

> *"$3.4 billion was stolen from DeFi in 2025. Aegis watches your savings 24/7 and pulls them to safety before you hear about the hack."*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Polkadot Hub](https://img.shields.io/badge/Network-Polkadot%20Hub-E6007A)](https://polkadot.network/)
[![Built With Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-f7f700)](https://hardhat.org/)
[![DoraHacks](https://img.shields.io/badge/Hackathon-Polkadot%20Solidity%202026-blueviolet)](https://dorahacks.io/hackathon/polkadot-solidity-hackathon/detail)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [How Aegis Works](#-how-aegis-works)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Smart Contracts](#-smart-contracts)
- [AI Stack](#-ai-stack)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Polkadot Hub Advantages](#-polkadot-hub-advantages)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [License](#-license)

---

## 🌐 Overview

**Aegis** is the first AI-guarded, consumer-grade stablecoin savings vault on Polkadot Hub. It combines:

- A non-custodial **USDC vault** that routes deposits into yield-generating DeFi protocols
- An **AI Yield Brain** that scores each yield source for sustainability and transparency
- An **AI Safety Sentinel** that monitors on-chain anomalies in real-time and auto-withdraws funds to safety when threat thresholds are breached
- A **Gasless UX** (powered by 0xGasless) so users never touch gas manually
- A **Weekly AI Advisor** that generates a plain-English savings report for every user

Built on Polkadot Hub's EVM-compatible smart contract layer — leveraging 2-second block finality to make real-time threat response possible.

---

## 🔴 The Problem

| The Reality | The Number |
|---|---|
| DeFi exploits & hacks (H1 2025) | **$3.1 billion lost** |
| Average time from exploit to user awareness | **4–12 minutes** |
| Polkadot Hub block time | **2 seconds** |
| Existing protocols with real-time AI protection | **0** |

Every DeFi protocol today is built on the same assumption: audit the code, deploy it, and hope nothing goes wrong. There is no post-deployment intelligent protection layer. Users are on their own the moment a hack begins.

Aegis changes the calculus. On a 2-second block chain, a threat detected at block N can result in funds withdrawn at block N+2 — before a user could even open Twitter.

Beyond safety, most DeFi yield is opaque. Users have no idea if their 15% APY is sustainable real yield or token emissions inflating into worthlessness in 6 weeks. Aegis makes that visible.

---

## ⚙️ How Aegis Works

### For the User — It's Dead Simple

```
1. Open Aegis → Answer a 5-question risk quiz
2. Deposit USDC → AI allocates to scored yield sources
3. Relax → Sentinel watches 24/7. Weekly reports in plain English.
4. Sleep easy → If an anomaly fires, your funds auto-withdraw to safety.
```

### Under the Hood — Three AI Layers

#### 🧠 Layer 1: Yield Brain
- Continuously reads on-chain yield data from active protocols on Polkadot Hub
- Computes a **Yield Quality Score (0–100)** per source:
  - `> 70` = Sustainable (real lending fees, trading revenue)
  - `40–70` = Mixed (partially emissions-based)
  - `< 40` = Risky (heavy emissions, inflationary, imminent decline)
- Scores are written on-chain and used by the vault to weight allocations

#### 🔍 Layer 2: Safety Sentinel
Monitors 4 anomaly signals per protocol per block:
- **TVL Drainage Rate** — rapid unusual outflows
- **Oracle Price Deviation** — price feed manipulation signals
- **Flash Loan Pattern Detection** — abnormal single-block volume spikes
- **Access Control Anomaly** — unexpected admin function calls

When ≥ 2 signals breach threshold simultaneously, `AegisGuard.sol` triggers an emergency withdrawal to the `AegisTreasury.sol` safe harbor — no human intervention required.

#### 📋 Layer 3: Weekly Advisor
Every 7 days, an AI compiles a plain-English savings report per user:
- Total earned, broken down by source
- Why the AI moved (or didn't move) your funds this week
- Risk outlook for the next 7 days
- Protocol health summary

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER INTERFACE                    │
│         (Next.js · Wagmi · 0xGasless SDK)           │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  AEGIS SMART CONTRACTS               │
│                   (Polkadot Hub EVM)                 │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ AegisVault  │  │  AegisGuard  │  │  Aegis     │  │
│  │   .sol      │◄─┤    .sol      │  │ Treasury   │  │
│  │             │  │              │  │  .sol      │  │
│  │ Deposit /   │  │ Anomaly      │  │            │  │
│  │ Withdraw /  │  │ Thresholds / │  │ Safe Harbor│  │
│  │ Rebalance   │  │ Emergency    │  │ Reserve    │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────┘  │
│         │                │                           │
│  ┌──────▼──────┐  ┌──────▼───────┐                  │
│  │ YieldOracle │  │  RiskMath    │                   │
│  │   .sol      │  │  Library     │                   │
│  └─────────────┘  └──────────────┘                   │
└────────────────────────┬────────────────────────────┘
                         │ on-chain reads / writes
┌────────────────────────▼────────────────────────────┐
│                     AI SERVICES                      │
│                  (Node.js · Off-chain)               │
│                                                      │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │ Yield Brain  │ │  Sentinel   │ │ Weekly Advisor│ │
│  │  /scorer     │ │  /sentinel  │ │  /advisor     │ │
│  └──────────────┘ └─────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
aegis/
│
├── contracts/                        # All Solidity smart contracts
│   ├── core/                         # Primary protocol contracts
│   │   ├── AegisVault.sol            # Main vault: deposit, withdraw, rebalance
│   │   ├── AegisGuard.sol            # Safety sentinel logic + emergency trigger
│   │   └── AegisTreasury.sol         # Safe harbor reserve for emergency funds
│   │
│   ├── interfaces/                   # Contract interfaces (clean boundaries)
│   │   ├── IAegisVault.sol
│   │   ├── IAegisGuard.sol
│   │   └── IYieldSource.sol
│   │
│   ├── oracles/                      # On-chain oracle & scoring contracts
│   │   └── YieldOracle.sol           # Reads + stores AI yield quality scores
│   │
│   └── libraries/                    # Shared logic libraries
│       ├── RiskMath.sol              # Anomaly threshold math
│       └── YieldScorer.sol           # Yield quality score computation helpers
│
├── ai/                               # Off-chain AI services (Node.js)
│   ├── sentinel/                     # Safety Sentinel service
│   │   ├── index.js                  # Entry point — listens to blocks
│   │   └── anomaly.js                # Anomaly detection logic
│   │
│   ├── scorer/                       # Yield Brain service
│   │   ├── index.js                  # Entry point — periodic scorer runner
│   │   └── yield_quality.js          # Yield Quality Score computation
│   │
│   └── advisor/                      # Weekly Advisor service
│       ├── index.js                  # Entry point — weekly cron trigger
│       └── report_generator.js       # Claude API call → plain-English report
│
├── scripts/                          # Deployment & utility scripts
│   ├── deploy.js                     # Full protocol deployment script
│   ├── verify.js                     # Contract verification on Polkadot Hub
│   └── seed.js                       # Seed test yield sources for dev/testnet
│
├── test/                             # Test suite
│   ├── AegisVault.test.js            # Core vault deposit/withdraw/rebalance tests
│   ├── AegisGuard.test.js            # Sentinel + emergency trigger tests
│   ├── YieldOracle.test.js           # Oracle read/write + score validation
│   └── helpers/
│       └── fixtures.js               # Shared test setup & mock data
│
├── .env.example                      # Required environment variables (template)
├── hardhat.config.js                 # Hardhat config (Polkadot Hub network)
├── package.json
└── README.md
```

---

## 📜 Smart Contracts

| Contract | Purpose |
|---|---|
| `AegisVault.sol` | Core vault. Accepts USDC deposits, routes to yield sources, handles withdrawals and AI-triggered rebalances |
| `AegisGuard.sol` | Monitors anomaly signals. When ≥2 breach threshold, triggers emergency withdrawal to AegisTreasury |
| `AegisTreasury.sol` | Safe harbor. Holds funds during and after an emergency event until user claims |
| `YieldOracle.sol` | Stores Yield Quality Scores written by the off-chain Yield Brain. Readable by the Vault |
| `RiskMath.sol` | Library for anomaly math — TVL drainage rates, deviation thresholds, flash loan signal scoring |
| `YieldScorer.sol` | Library with helpers for blending real yield vs emissions yield into a 0–100 score |

---

## 🤖 AI Stack

| Service | Runtime | Trigger | Output |
|---|---|---|---|
| **Yield Brain** | Node.js | Every 10 minutes | Writes Yield Quality Score on-chain via `YieldOracle.sol` |
| **Safety Sentinel** | Node.js | Every new block (~2s) | Calls `AegisGuard.triggerEmergency()` if threshold breached |
| **Weekly Advisor** | Node.js | Cron — every Sunday | Writes plain-English report to `UserReports` mapping in vault |

AI inference is powered by the **Anthropic Claude API** (`claude-sonnet-4-6`). Each service makes structured API calls and either writes results on-chain or serves them to the frontend.

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18.x`
- npm or yarn
- A funded wallet on Polkadot Hub Testnet (Westend Asset Hub)
- Anthropic API key (for AI services)

### Install

```bash
git clone https://github.com/your-org/aegis.git
cd aegis
npm install
```

### Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Network
POLKADOT_HUB_RPC_URL=https://westend-asset-hub-eth-rpc.polkadot.io
PRIVATE_KEY=your_deployer_wallet_private_key

# Contracts (populated after deploy)
AEGIS_VAULT_ADDRESS=
AEGIS_GUARD_ADDRESS=
AEGIS_TREASURY_ADDRESS=
YIELD_ORACLE_ADDRESS=

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key

# Gasless (0xGasless)
GASLESS_API_KEY=your_0xgasless_api_key
```

---

## 🔧 Deployment

```bash
# Deploy all contracts to Polkadot Hub Testnet
npx hardhat run scripts/deploy.js --network polkadot-hub-testnet

# Verify contracts
npx hardhat run scripts/verify.js --network polkadot-hub-testnet

# Seed test yield sources (dev only)
npx hardhat run scripts/seed.js --network polkadot-hub-testnet
```

---

## 🧪 Testing

```bash
# Run full test suite
npx hardhat test

# Run with gas report
REPORT_GAS=true npx hardhat test

# Run a single test file
npx hardhat test test/AegisGuard.test.js
```

---

## ⚡ Polkadot Hub Advantages

Aegis is not an Ethereum port. It is built specifically for Polkadot Hub and its properties are essential to the product:

| Feature | Polkadot Hub | Ethereum |
|---|---|---|
| Block time | **~2 seconds** | ~12 seconds |
| Emergency response window | **4 seconds** | 24+ seconds |
| Gas fees | **Negligible** | $5–50 per tx |
| Gasless infrastructure | **Native (0xGasless)** | Complex workarounds |
| EVM compatibility | **Full (PolkaVM)** | Native |

The Safety Sentinel is **only viable** at Polkadot Hub's block speed. At Ethereum's 12-second block times, most exploits are fully executed before 3 blocks confirm an anomaly. Aegis makes real-time protection structurally possible.

---

## 🗺️ Roadmap

| Phase | Target | Milestone |
|---|---|---|
| **Phase 1** | March 2026 | Hackathon MVP — vault + sentinel + yield brain |
| **Phase 2** | Q2 2026 | Bifrost vDOT integration as yield source |
| **Phase 3** | Q2 2026 | Multi-asset support (DOT, ETH via Snowbridge) |
| **Phase 4** | Q3 2026 | DAO governance for sentinel thresholds |
| **Phase 5** | Q4 2026 | Polkadot Treasury grant + audit via Polkadot Assurance Legion |

---

## 👥 Team

| Name | Role |
|---|---|
| — | Smart Contract Engineer |
| — | AI / Backend Engineer |
| — | Frontend Engineer |

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ for the **Polkadot Solidity Hackathon 2026**

Organized by [OpenGuild](https://openguild.wtf) × [Web3 Foundation](https://web3.foundation) × [Polkadot](https://polkadot.network)

</div>