# 🛡️ Aegis — AI-Guarded Stablecoin Vault on Polkadot Hub

> *Built for the Polkadot Solidity Hackathon 2026 — an intelligent, non-custodial savings vault that watches your deposits around the clock.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Polkadot Hub](https://img.shields.io/badge/Network-Polkadot%20Hub-E6007A)](https://polkadot.network/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-f7f700)](https://hardhat.org/)
[![DoraHacks](https://img.shields.io/badge/Hackathon-Polkadot%20Solidity%202026-blueviolet)](https://dorahacks.io/hackathon/polkadot-solidity-hackathon/detail)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [How Aegis Works](#-how-aegis-works)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Smart Contracts](#-smart-contracts)
- [AI Stack](#-ai-stack)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Why Polkadot Hub](#-why-polkadot-hub)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [License](#-license)

---

## 🌐 Overview

**Aegis** is an AI-powered, non-custodial stablecoin savings vault built on Polkadot Hub. It is designed for users who want to earn yield on their USDC without having to actively manage risk or understand the technical details of every protocol their funds are in.

The core idea is simple: your deposits should be working for you, and an intelligent system should be watching over them — so you don't have to.

Aegis combines three layers of intelligence:

- A **Yield Brain** that continuously scores yield sources for quality and sustainability
- A **Safety Sentinel** that monitors on-chain activity in real time and can move funds to safety automatically
- A **Weekly Advisor** that generates plain-English summaries of your position, earnings, and the overall risk outlook

All of this runs on Polkadot Hub's EVM-compatible environment, taking full advantage of its 2-second block finality and low-cost transactions.

---

## ⚙️ How Aegis Works

### For the User

```
1. Connect wallet → Visit the Faucet tab to get testnet PAS and MockUSDC
2. Deposit USDC  → Funds are routed to AI-scored yield sources
3. Relax         → Sentinel monitors every block. Reports arrive weekly.
4. Withdraw      → Redeem your shares for USDC at any time, no lockups
```

### Under the Hood — Three AI Layers

#### 🧠 Layer 1: Yield Brain (Scorer)
Runs every 10 minutes. Reads on-chain yield data and computes a **Yield Quality Score (0–100)** per protocol:

| Score Range | Tier | Meaning |
|---|---|---|
| 70–100 | Sustainable | Revenue from real fees and lending activity |
| 40–69 | Mixed | Partially driven by token emissions |
| 0–39 | Risky | Heavily emissions-based, APY may not hold |

Scores are written on-chain to `YieldOracle.sol` and used by the vault to weight allocations.

#### 🔍 Layer 2: Safety Sentinel
Runs on every new block (~2 seconds). Monitors 4 signals per protocol:

- **TVL Drainage** — unusual or rapid outflows from the protocol
- **Oracle Deviation** — price feed readings diverging from expected range
- **Flash Loan Spike** — abnormally high single-block volume
- **Access Control Event** — unexpected admin or ownership changes

When 2 or more signals breach their thresholds simultaneously, `AegisGuard.sol` triggers an emergency withdrawal to `AegisTreasury.sol` — a safe harbor contract — without any manual intervention.

#### 📋 Layer 3: Weekly Advisor
Runs every Sunday. Compiles a user-facing plain-English report:

- Total earned, broken down by source
- Summary of any rebalances or emergency events
- Protocol health outlook for the coming week
- Risk assessment of the current allocation

Powered by the **Anthropic Claude API**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER INTERFACE                    │
│              (React · Vite · ethers.js)              │
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
│  │ Deposit /   │  │ Signal watch │  │            │  │
│  │ Withdraw /  │  │ Emergency    │  │ Safe Harbor│  │
│  │ Rebalance   │  │ trigger      │  │ Reserve    │  │
│  └──────┬──────┘  └──────────────┘  └────────────┘  │
│         │                                            │
│  ┌──────▼──────┐                                     │
│  │ YieldOracle │                                     │
│  │   .sol      │                                     │
│  └─────────────┘                                     │
└────────────────────────┬────────────────────────────┘
                         │ on-chain reads / writes
┌────────────────────────▼────────────────────────────┐
│                     AI SERVICES                      │
│                  (Node.js · Off-chain)               │
│                                                      │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │    Scorer    │ │  Sentinel   │ │ Weekly Advisor│ │
│  │  /scorer     │ │  /sentinel  │ │  /advisor     │ │
│  └──────────────┘ └─────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
aegis/
│
├── contracts/                        # Solidity smart contracts
│   ├── AegisVault.sol                # Main vault: deposit, withdraw, rebalance
│   ├── AegisGuard.sol                # Signal monitoring + emergency trigger
│   ├── AegisTreasury.sol             # Safe harbor reserve
│   ├── oracles/
│   │   └── YieldOracle.sol           # Stores AI-written yield quality scores
│   └── mocks/
│       └── MockUSDC.sol              # Testnet USDC token
│
├── ai/                               # Off-chain AI services
│   ├── sentinel/                     # Safety Sentinel (block listener)
│   ├── scorer/                       # Yield Brain (periodic scorer)
│   └── advisor/                      # Weekly Advisor (Claude API reports)
│
├── client/                           # Frontend (React + Vite)
│   └── src/
│       ├── pages/                    # Dashboard, Vault, Analytics, Faucet
│       ├── components/               # UI components + layout
│       ├── hooks/                    # useVault, useGuard, useOracle, useEvents
│       └── config/                   # Chain + contract config
│
├── scripts/
│   ├── deploy-polkadot.js            # Full deployment script
│   └── seed.js                       # Seed test yield sources
│
└── test/                             # Hardhat test suite (53 tests)
```

---

## 📜 Smart Contracts

| Contract | Address (Paseo Hub) | Purpose |
|---|---|---|
| `AegisVault.sol` | `0x5ef526DFe9474E66c439Ca8FF31526f755F7aaBd` | Core vault — deposits, withdrawals, rebalancing |
| `AegisGuard.sol` | `0x0F5FAd045798b5BC1Eada8650D09fEE05D4090c5` | Signal monitoring and emergency execution |
| `AegisTreasury.sol` | `0x95c02D478522b1B7616f433A22B7CDcBa259CA50` | Safe harbor for emergency-withdrawn funds |
| `YieldOracle.sol` | `0xC7c40108FA72A9C696a277B3496025AefeBc33b6` | On-chain yield quality scores from AI |
| `MockUSDC.sol` | `0x3A5786F2CB62a8002544DA58F70eb23F17fdEFC5` | Testnet USDC (mintable) |

---

## 🤖 AI Stack

| Service | Trigger | Output |
|---|---|---|
| **Scorer** | Every 10 minutes | Writes Yield Quality Score on-chain to `YieldOracle.sol` |
| **Sentinel** | Every block (~2s) | Calls `AegisGuard.checkAndExecute()` if thresholds breach |
| **Advisor** | Weekly cron (Sunday) | Plain-English report per user via Claude API |

All AI inference uses **Anthropic Claude** (`claude-sonnet-4-6`).

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18.x`
- MetaMask with Paseo Asset Hub added
- Anthropic API key (for AI services)

### Install

```bash
git clone https://github.com/your-org/aegis.git
cd aegis/contracts
npm install

cd ../client
npm install
```

### Configure

```bash
cp .env.example .env
```

Key variables:

```env
POLKADOT_HUB_RPC_URL=https://services.polkadothub-rpc.com/testnet
POLKADOT_HUB_PRIVATE_KEY=your_deployer_private_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Run Frontend

```bash
cd client
npm run dev
# Open http://localhost:5173
```

### Run AI Services

```bash
cd contracts
npm run sentinel   # Start Safety Sentinel
npm run scorer     # Start Yield Brain
npm run advisor    # Start Weekly Advisor
```

---

## 🔧 Deployment

Contracts are already deployed on Paseo Hub testnet. To redeploy:

```bash
cd contracts
npm run deploy:polkadot
```

The script compiles with `resolc` (PVM bytecode), deploys all 5 contracts in sequence, wires them together, and saves addresses to `deployments/polkadotHub.json`.

---

## 🧪 Testing

```bash
cd contracts
npm test               # Run all 53 tests
REPORT_GAS=true npm test  # With gas report
```

---

## ⚡ Why Polkadot Hub

Aegis is built specifically for Polkadot Hub, not ported from another chain. Several design decisions only work here:

| Property | Polkadot Hub | Why It Matters for Aegis |
|---|---|---|
| Block time | ~2 seconds | Sentinel can respond within 4 seconds of detecting a signal |
| Gas fees | Negligible | Sentinel can submit transactions every block affordably |
| EVM compatibility | Full (PolkaVM) | Standard Solidity tooling works without modification |
| Finality | Fast, deterministic | Emergency withdrawals confirm quickly and reliably |

The Sentinel's real-time response model depends entirely on fast, cheap blocks. It is not practical on chains where a transaction costs $10–50 and confirms every 12 seconds.

---

## 🗺️ Roadmap

| Phase | Target | Milestone |
|---|---|---|
| **Phase 1** | March 2026 | Hackathon MVP — vault + sentinel + yield brain on Paseo Hub |
| **Phase 2** | Q2 2026 | Bifrost vDOT integration as first live yield source |
| **Phase 3** | Q2 2026 | Multi-asset support (DOT, ETH via Snowbridge) |
| **Phase 4** | Q3 2026 | DAO governance for sentinel signal thresholds |
| **Phase 5** | Q4 2026 | Polkadot Treasury grant + audit via Polkadot Assurance Legion |

---

## 👥 Team

Built for the **Polkadot Solidity Hackathon 2026**, organized by OpenGuild × Web3 Foundation × Polkadot.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

🛡️ **Aegis** — Your savings, watched over.

</div>