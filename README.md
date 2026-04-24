# Aegis - AI-Guarded Stablecoin Vault on Initia

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Initia](https://img.shields.io/badge/Network-Initia%20EVM-6366f1)](https://initia.xyz/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-f7f700)](https://hardhat.org/)
[![Claude](https://img.shields.io/badge/AI-Anthropic%20Claude-orange)](https://anthropic.com/)

---

## Initia Hackathon Submission

- **Project Name**: Aegis

### Project Overview

Aegis is an AI-powered, non-custodial stablecoin savings vault. It routes user deposits across yield sources, continuously monitors them for on-chain anomalies using three AI layers (Yield Brain, Safety Sentinel, and Weekly Advisor), and automatically triggers emergency withdrawals without any manual intervention — so users can earn yield without watching their positions.

### Implementation Detail

- **The Custom Implementation**: Aegis implements a five-signal risk detection system where an off-chain AI Sentinel reads every block and submits signal values (TVL drainage, oracle deviation, flash loan spikes, access control anomalies, and Interwoven Bridge anomalies) to an on-chain Guard contract. When two or more signals breach their thresholds simultaneously, the Guard automatically pulls funds to a safe harbor Treasury contract and pays a bounty to the triggering caller. A separate Scorer service runs every 10 minutes, computes a Yield Quality Score (0–100) per protocol based on real yield vs emissions ratio and TVL depth, and writes it on-chain to a YieldOracle contract that the vault uses to weight its allocations. A third service, the Weekly Advisor, uses the Anthropic Claude API to generate plain-English savings reports per user, served via a local HTTP API.

- **The Native Feature**: Aegis uses the **Interwoven Bridge** as a fifth risk signal. The `bridge_monitor.js` service watches every block for `SendToIBC`, `AcknowledgePacket`, and `TimeoutPacket` events on the bridge contract. If 3 or more timeouts occur in a single block, 2 or more failed ACKs are detected, or bridge volume spikes 8× above the rolling average, the Sentinel raises a `BRIDGE_ANOMALY` signal. This is unique to Initia — no other EVM chain has a native bridge that can be monitored this way. It means Aegis can detect cross-chain risk events (stuck transfers, relay failures) and protect user funds automatically, which is not possible on any other EVM-compatible chain.

### How to Run Locally

1. Start the appchain: `weave rollup start -d && weave opinit start executor -d && weave relayer start -d`
2. Deploy contracts and seed data: `cd contract && npm run deploy:initia && npm run authorize && npm run seed:initia`
3. Start AI services in separate terminals: `npm run sentinel` · `npm run scorer` · `ADVISOR_RUN_ON_START=true npm run advisor`
4. Start the frontend: `cd client && npm install && npm run dev` — open `http://localhost:5173`, add Aegis-1 to MetaMask (Chain ID: `2559569424467142`, RPC: `http://localhost:8545`, symbol: `GAS`), connect wallet, and use the Faucet tab to mint MockUSDC before depositing.

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
│   ├── libraries/
│   ├── oracles/
│   └── mocks/
├── ai/
│   ├── sentinel/         # block watcher + bridge monitor
│   ├── scorer/           # yield quality scoring
│   └── advisor/          # Claude API reports + HTTP API
├── client/               # React + Vite frontend
├── scripts/
│   ├── deploy-initia.js
│   ├── seed-initia.js
│   └── authorize.js
├── test/
└── deployments/
    └── initia.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- An Initia EVM appchain via `weave init`
- Anthropic API key

### Install & Configure

```bash
cd contract
npm install
cp .env.example .env
```

```env
INITIA_RPC_URL=http://localhost:8545
INITIA_PRIVATE_KEY=0x...
SENTINEL_PRIVATE_KEY=0x...
SCORER_PRIVATE_KEY=0x...
ADVISOR_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
```

### Deploy

```bash
npx hardhat compile
npm run deploy:initia
npm run authorize
npm run seed:initia
```

### Run AI Services

```bash
npm run sentinel
npm run scorer
ADVISOR_RUN_ON_START=true npm run advisor
```

### Run Frontend

```bash
cd client
npm install
npm run dev
```

### Advisor API

```
GET http://localhost:3001/health
GET http://localhost:3001/report/:address
GET http://localhost:3001/report/:address/history
```

---

## Network

| | Value |
|---|---|
| Chain ID | `aegis-1` |
| EVM Chain ID | `2559569424467142` |
| JSON-RPC | `http://localhost:8545` |
| RPC | `http://localhost:26657` |
| REST | `http://localhost:1317` |
| Compiler | solc 0.8.28 / EVM paris |

### Viewing Transactions

Aegis transactions live on the local `aegis-1` appchain. To view them in the Initia scanner, open this link in **Chrome** and add the custom network:

```
https://scan.testnet.initia.xyz/custom-network/add/link?config=eyJ2bSI6ImV2bSIsImNoYWluSWQiOiJhZWdpcy0xIiwibWluR2FzUHJpY2UiOjAsImRlbm9tIjoiR0FTIiwibGNkIjoiaHR0cDovL2xvY2FsaG9zdDoxMzE3IiwicnBjIjoiaHR0cDovL2xvY2FsaG9zdDoyNjY1NyIsImpzb25ScGMiOiJodHRwOi8vbG9jYWxob3N0Ojg1NDUiLCJpbmRleGVyIjoiaHR0cDovL2xvY2FsaG9zdDo2NzY3In0=
```

### Adding aegis-1 to MetaMask

| Field | Value |
|---|---|
| Network Name | Aegis-1 (Initia) |
| RPC URL | `http://localhost:8545` |
| Chain ID | `2559569424467142` |
| Currency Symbol | `GAS` |

### Funding Your Wallet

The deployer wallet (`0x953F...D890`) is funded from genesis. To fund other wallets:

```bash
minitiad tx bank send gas-station \
  <init1_address> \
  1000000000000000000000GAS \
  --keyring-backend test \
  --chain-id aegis-1 \
  --node http://localhost:26657 \
  --gas auto --yes
```

Convert EVM address to init1 format:
```bash
python3 -c "
import bech32
b = bytes.fromhex('<hex_address_without_0x>')
print(bech32.bech32_encode('init', bech32.convertbits(b, 8, 5)))
"
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

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

🛡️ **Aegis** — Your savings, watched over.

</div>