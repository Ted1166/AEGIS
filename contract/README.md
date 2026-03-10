# Aegis — AI-Powered DeFi Vault on Polkadot Hub

Aegis is a non-custodial USDC yield vault with an AI safety layer, built for the Polkadot Solidity Hackathon 2026. It routes deposits across yield sources, monitors them for anomalies in real time, and automatically triggers emergency withdrawals when risk thresholds are breached.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AegisVault                          │
│  Accepts USDC deposits, issues shares, routes to yield  │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
    ┌──────────▼──────────┐   ┌──────────▼──────────┐
    │    YieldOracle       │   │    AegisTreasury     │
    │  Yield quality       │   │  Safe harbor for     │
    │  scores + APY data   │   │  emergency funds     │
    └─────────────────────┘   └─────────────────────┘
               │
    ┌──────────▼──────────┐
    │     AegisGuard       │
    │  AI signal intake    │
    │  + emergency trigger │
    └─────────────────────┘
               ▲
               │  on-chain signals
    ┌──────────┴──────────────────────────────────────┐
    │              Off-chain AI Services               │
    │  Sentinel (block watcher) · Scorer · Advisor    │
    └─────────────────────────────────────────────────┘
```

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `AegisVault` | Core vault — deposits, withdrawals, rebalancing, share accounting |
| `AegisGuard` | Receives AI signals, tracks risk state, triggers emergency mode |
| `YieldOracle` | Stores yield quality scores (real yield %, emissions %, TVL, tier) |
| `AegisTreasury` | Holds funds during emergency; manages claimable balances |
| `MockUSDC` | ERC-20 test token (testnet only) |
| `MockYieldSource` | Simulated yield protocol for testnet seeding |

### Signal Types (AegisGuard)

The guard tracks 4 signal types submitted by the off-chain Sentinel:

| Signal | Description |
|--------|-------------|
| `TVL_DRAINAGE` | Rapid TVL decline in bps/block |
| `ORACLE_DEVIATION` | APY deviation from rolling average |
| `FLASH_LOAN_SPIKE` | Volume spike relative to historical average |
| `ACCESS_CONTROL_ANOMALY` | Ownership/role change events detected |

When enough signals breach their thresholds, `checkAndExecute()` pulls funds to treasury and pays a bounty to the caller.

## AI Services

| Service | File | Description |
|---------|------|-------------|
| **Sentinel** | `ai/sentinel/index.js` | Watches every block, computes anomaly signals, submits to AegisGuard |
| **Scorer** | `ai/scorer/index.js` | Scores yield sources every 10 min, writes to YieldOracle |
| **Advisor** | `ai/advisor/index.js` | Weekly AI report per user via Claude API, HTTP API on port 3001 |

## Prerequisites

- Node.js v18+
- `solc` 0.8.28 via [solc-select](https://github.com/crytic/solc-select)
- `resolc` v0.6.0 (PVM compiler) — see [Installation](#resolc-installation)
- A funded wallet on Paseo Hub testnet

## resolc Installation

```bash
wget https://github.com/paritytech/revive/releases/download/v0.6.0/resolc-x86_64-unknown-linux-musl \
  -O ~/resolc-bin-060
chmod +x ~/resolc-bin-060
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```dotenv
# Paseo Hub testnet
POLKADOT_HUB_RPC_URL=https://services.polkadothub-rpc.com/testnet
POLKADOT_HUB_PRIVATE_KEY=0x...          # deployer wallet

# AI service wallets (must have WND for gas)
SENTINEL_PRIVATE_KEY=0x...
SCORER_PRIVATE_KEY=0x...
ADVISOR_PRIVATE_KEY=0x...

# Filled after deployment
AEGIS_VAULT_ADDRESS=
AEGIS_GUARD_ADDRESS=
AEGIS_TREASURY_ADDRESS=
YIELD_ORACLE_ADDRESS=
USDC_ADDRESS=

# Advisor only
ANTHROPIC_API_KEY=sk-ant-...
```

## Installation

```bash
cd contract
npm install
```

## Running Tests

All 53 tests run against a local Hardhat EVM:

```bash
npm test
```

## Deployment

### 1. Deploy to Polkadot Hub

Compiles all contracts with resolc (PVM bytecode) and deploys in one step:

```bash
npm run deploy:polkadot
```

This will:
- Compile contracts using `resolc` + standard-json (with OpenZeppelin imports)
- Deploy MockUSDC, AegisTreasury, YieldOracle, AegisGuard, AegisVault
- Wire contracts together (setVault, setGuard, setOracle)
- Authorize AI service wallets
- Save addresses to `deployments/polkadotHub.json`

Copy the printed env vars into your `.env`.

### 2. Seed testnet data

Deploys mock yield sources, mints USDC, makes a test deposit, and triggers an initial rebalance:

```bash
npm run seed:polkadot
```

### 3. Verify deployment

Checks all contracts are live on-chain and generates a markdown verification report:

```bash
npm run verify:polkadot
```

Output saved to `deployments/verification-polkadotHub.md`.

## Running AI Services

Start each in a separate terminal. They run indefinitely:

```bash
# Terminal 1 — watches every block for anomaly signals
npm run sentinel

# Terminal 2 — scores yield sources every 10 minutes
npm run scorer

# Terminal 3 — weekly advisor + HTTP API on :3001
npm run advisor

# To trigger an immediate advisor report on startup:
ADVISOR_RUN_ON_START=true npm run advisor
```

### Advisor API

```
GET http://localhost:3001/health
GET http://localhost:3001/report/:address
GET http://localhost:3001/report/:address/history
```

## Network

| | Value |
|-|-------|
| Network | Paseo Asset Hub (testnet) |
| Chain ID | 420420417 |
| RPC | `https://services.polkadothub-rpc.com/testnet` |
| Compiler | resolc v0.6.0 / solc 0.8.28 |
| Bytecode | PVM (PolkaVM) — magic bytes `0x50564d` |

## Deployed Contracts (Paseo Hub Testnet)

| Contract | Address |
|----------|---------|
| AegisVault | `0x5ef526DFe9474E66c439Ca8FF31526f755F7aaBd` |
| AegisGuard | `0x0F5FAd045798b5BC1Eada8650D09fEE05D4090c5` |
| AegisTreasury | `0x95c02D478522b1B7616f433A22B7CDcBa259CA50` |
| YieldOracle | `0xC7c40108FA72A9C696a277B3496025AefeBc33b6` |
| MockUSDC | `0x3A5786F2CB62a8002544DA58F70eb23F17fdEFC5` |
| MockLendingSource | `0x77D2198692c743f2D0B0d30B83310e666704Ca8A` |
| MockDEXSource | `0x7277eA9bb150b51b77984eDf84DaA5206be5Fb7f` |

## Project Structure

```
contract/
├── contracts/
│   ├── AegisVault.sol
│   ├── AegisGuard.sol
│   ├── YieldOracle.sol
│   ├── AegisTreasury.sol
│   └── mocks/
│       ├── MockUSDC.sol
│       └── MockYieldSource.sol
├── ai/
│   ├── sentinel/
│   │   ├── index.js          # block watcher
│   │   └── anomaly.js        # signal computation
│   ├── scorer/
│   │   ├── index.js          # scoring loop
│   │   └── yield_quality.js  # scoring algorithm
│   └── advisor/
│       ├── index.js          # cron + HTTP API
│       └── report_generator.js  # Claude API integration
├── scripts/
│   ├── deploy-polkadot.js    # PVM deployment
│   ├── seed-polkadot.js      # testnet seeding
│   └── verify-polkadot.js    # on-chain verification
├── test/                     # 53 Hardhat tests
└── deployments/
    └── polkadotHub.json      # deployed addresses
```

## Hackathon

**Polkadot Solidity Hackathon 2026**
Track: EVM Smart Contracts — DeFi + AI-powered dApps
Submission deadline: March 20, 2026 | Demo Day: March 24–25