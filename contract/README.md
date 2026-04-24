# Aegis — AI-Guarded Stablecoin Vault on Initia

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Initia](https://img.shields.io/badge/Network-Initia%20EVM-6366f1)](https://initia.xyz/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-f7f700)](https://hardhat.org/)
[![Claude](https://img.shields.io/badge/AI-Anthropic%20Claude-orange)](https://anthropic.com/)

---

## Overview

**Aegis** is an AI-powered, non-custodial stablecoin savings vault built on Initia EVM. It routes deposits across yield sources, monitors them in real time for anomalies, and automatically triggers emergency withdrawals when risk thresholds are breached — without any manual intervention.

Three layers of intelligence run continuously:

- A **Yield Brain** that scores yield sources every 10 minutes and writes quality scores on-chain
- A **Safety Sentinel** that watches every block and triggers emergency withdrawals when signals breach thresholds
- A **Weekly Advisor** that generates plain-English savings reports powered by the Anthropic Claude API

Aegis also monitors Initia's **Interwoven Bridge** natively — detecting stuck transfers, relay failures, and volume anomalies as a fifth signal type unique to the Initia ecosystem.

---

## How It Works

```
1. Deposit USDC     → Funds are routed to AI-scored yield sources
2. Relax            → Sentinel monitors every block (~1s). Reports arrive weekly.
3. Withdraw         → Redeem shares for USDC at any time, no lockups
4. Stay protected   → Bridge anomalies, TVL crashes, and oracle deviations trigger automatic safety
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER INTERFACE                    │
│              (React · Vite · ethers.js)              │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              AEGIS SMART CONTRACTS                   │
│                  (Initia EVM)                        │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ AegisVault  │◄─┤  AegisGuard  │  │  Aegis     │  │
│  │             │  │              │  │ Treasury   │  │
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
│                    AI SERVICES                       │
│                 (Node.js · Off-chain)                │
│                                                      │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │    Scorer    │ │  Sentinel   │ │ Weekly Advisor│ │
│  │  /scorer     │ │  /sentinel  │ │  /advisor     │ │
│  └──────────────┘ └─────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Smart Contracts

| Contract | Address (aegis-1) | Purpose |
|---|---|---|
| `AegisVault.sol` | `0x3C1b5aa1C2b914bDBfe3313cc2e2B3c850F94AFe` | Core vault — deposits, withdrawals, rebalancing |
| `AegisGuard.sol` | `0x205aE7eF827e92f9daB6B35CD84301A780C75C08` | Signal monitoring and emergency execution |
| `AegisTreasury.sol` | `0xc08757f4dA6b13e6Fa0d343F227fB751FC220e9b` | Safe harbor for emergency-withdrawn funds |
| `YieldOracle.sol` | `0xb5b844ba8f544406d53fF7C7e0B43c008f8D16CF` | On-chain yield quality scores from AI |
| `MockUSDC.sol` | `0x4205DEBc42B91c7B13983C42B6808fC9F559d94b` | Testnet USDC (mintable) |

### Signal Types

The Guard tracks 5 signal types submitted by the off-chain Sentinel:

| Signal | Description |
|---|---|
| `TVL_DRAINAGE` | Rapid TVL decline in bps/block |
| `ORACLE_DEVIATION` | APY deviation from rolling reference |
| `FLASH_LOAN_SPIKE` | Single-block volume anomaly |
| `ACCESS_CONTROL_ANOMALY` | Unexpected admin or ownership events |
| `BRIDGE_ANOMALY` | Interwoven Bridge irregularities (Initia-native) |

When 2 or more signals breach thresholds simultaneously, `checkAndExecute()` pulls funds to treasury and pays a bounty to the caller.

---

## AI Stack

| Service | Trigger | Output |
|---|---|---|
| **Scorer** | Every 10 minutes | Writes Yield Quality Score on-chain to `YieldOracle.sol` |
| **Sentinel** | Every block (~1s) | Submits signals to `AegisGuard`, calls `checkAndExecute()` if threshold breached |
| **Advisor** | Weekly (Sunday) | Plain-English report per user via Anthropic Claude API |
| **Bridge Monitor** | Every block | Watches Interwoven Bridge for timeouts, failed ACKs, volume spikes |

All AI inference uses **Anthropic Claude** (`claude-sonnet-4-6`).

---

## Project Structure

```
aegis/
├── contracts/
│   ├── AegisVault.sol
│   ├── AegisGuard.sol
│   ├── AegisTreasury.sol
│   ├── interfaces/
│   │   ├── IAegisGuard.sol
│   │   ├── IAegisVault.sol
│   │   └── IYieldSource.sol
│   ├── libraries/
│   │   ├── RiskMath.sol
│   │   └── YieldScorer.sol
│   ├── oracles/
│   │   └── YieldOracle.sol
│   └── mocks/
│       ├── MockUSDC.sol
│       └── MockYieldSource.sol
│
├── ai/
│   ├── sentinel/
│   │   ├── index.js           # block watcher + signal submission
│   │   ├── anomaly.js         # TVL, oracle, flash loan, access control signals
│   │   └── bridge_monitor.js  # Interwoven Bridge anomaly detection
│   ├── scorer/
│   │   ├── index.js           # scoring loop
│   │   └── yield_quality.js   # scoring algorithm
│   └── advisor/
│       ├── index.js           # cron + HTTP API
│       └── report_generator.js  # Claude API integration
│
├── scripts/
│   ├── deploy-initia.js       # deployment script
│   ├── seed-initia.js         # testnet seeding
│   └── authorize.js           # authorize AI service wallets
│
├── test/
│   ├── AegisVault.test.js
│   ├── AegisGuard.test.js
│   └── YieldOracle.test.js
│
└── deployments/
    └── initia.json            # deployed addresses
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- An Initia EVM appchain (set up via `weave init`)
- Anthropic API key

### Install

```bash
cd contract
npm install
```

### Configure

```bash
cp .env.example .env
```

Fill in:

```env
INITIA_RPC_URL=http://localhost:8545
INITIA_PRIVATE_KEY=0x...

SENTINEL_PRIVATE_KEY=0x...
SCORER_PRIVATE_KEY=0x...
ADVISOR_PRIVATE_KEY=0x...

ANTHROPIC_API_KEY=sk-ant-...
```

---

## Deployment

### 1. Compile

```bash
npx hardhat compile
```

### 2. Deploy

```bash
npm run deploy:initia
```

Deploys all 5 contracts, wires them together, and saves addresses to `deployments/initia.json`.

### 3. Authorize AI services

```bash
npm run authorize
```

### 4. Seed testnet data

```bash
npm run seed:initia
```

Deploys mock yield sources, mints USDC, makes a test deposit, triggers an initial rebalance.

---

## Running AI Services

Start each in a separate terminal:

```bash
npm run sentinel    # watches every block
npm run scorer      # scores yield sources every 10 minutes
npm run advisor     # weekly reports + HTTP API on :3001

# To trigger an immediate report on startup:
ADVISOR_RUN_ON_START=true npm run advisor
```

### Advisor API

```
GET http://localhost:3001/health
GET http://localhost:3001/report/:address
GET http://localhost:3001/report/:address/history
```

---

## Testing

```bash
npm test
REPORT_GAS=true npm test
```

---

## Why Initia

| Property | Value for Aegis |
|---|---|
| Block time ~1s | Sentinel responds within 2 blocks of detecting a signal |
| Negligible gas | Sentinel submits transactions every block affordably |
| Interwoven Bridge | Native bridge monitoring — a 5th signal type no other EVM chain offers |
| Auto-signing | Users approve once; Sentinel operates silently in the background |
| Full EVM | Standard Solidity tooling, zero contract rewrites |

---

## Network

| | Value |
|---|---|
| Chain ID | `aegis-1` |
| JSON-RPC | `http://localhost:8545` |
| RPC | `http://localhost:26657` |
| Compiler | solc 0.8.28 / EVM paris |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

🛡️ **Aegis** — Your savings, watched over.

</div>