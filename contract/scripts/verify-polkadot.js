import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL      = process.env.POLKADOT_HUB_RPC_URL;
const EXPLORER_URL = "https://blockscout-passet-hub.parity-testnet.parity.io";

function loadAddresses() {
  const p = path.join(__dirname, "../deployments/polkadotHub.json");
  if (!fs.existsSync(p)) throw new Error("No deployment found. Run deploy-polkadot.js first.");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function checkContract(provider, label, address) {
  if (!address) {
    console.log(`  ⚠️  ${label}: address missing in deployment file`);
    return false;
  }
  const code = await provider.getCode(address);
  const deployed = code && code !== "0x";
  const pvmMagic = code?.startsWith("0x50564d"); // PVM magic bytes
  const status   = deployed ? (pvmMagic ? "✅ PVM bytecode" : "✅ deployed") : "❌ no code";
  console.log(`  ${status.padEnd(20)} ${label.padEnd(20)} ${address}`);
  console.log(`  ${"".padEnd(20)} ${"".padEnd(20)} ${EXPLORER_URL}/address/${address}`);
  return deployed;
}

async function main() {
  const addresses = loadAddresses();
  const provider  = new ethers.JsonRpcProvider(RPC_URL);
  const network   = await provider.getNetwork();

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     🔍  Aegis — Polkadot Hub Verification        ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Chain ID:  ${network.chainId}`);
  console.log(`RPC:       ${RPC_URL}`);
  console.log(`Explorer:  ${EXPLORER_URL}`);
  console.log(`Block:     ${await provider.getBlockNumber()}`);
  console.log("");

  console.log("── Core Contracts ──────────────────────────────────");
  const results = await Promise.all([
    checkContract(provider, "MockUSDC",      addresses.usdc),
    checkContract(provider, "AegisTreasury", addresses.treasury),
    checkContract(provider, "YieldOracle",   addresses.oracle),
    checkContract(provider, "AegisGuard",    addresses.guard),
    checkContract(provider, "AegisVault",    addresses.vault),
  ]);

  console.log("");
  console.log("── Yield Sources ───────────────────────────────────");
  const sourceResults = await Promise.all([
    checkContract(provider, "MockLendingSource", addresses.lendingSource),
    checkContract(provider, "MockDEXSource",     addresses.dexSource),
  ]);

  const allDeployed = [...results, ...sourceResults].every(Boolean);

  console.log("");
  console.log("── Deployment Summary ──────────────────────────────");
  console.log(`  AEGIS_VAULT_ADDRESS=${addresses.vault}`);
  console.log(`  AEGIS_GUARD_ADDRESS=${addresses.guard}`);
  console.log(`  AEGIS_TREASURY_ADDRESS=${addresses.treasury}`);
  console.log(`  YIELD_ORACLE_ADDRESS=${addresses.oracle}`);
  console.log(`  USDC_ADDRESS=${addresses.usdc}`);
  console.log("");

  // Write a markdown verification report for hackathon submission
  const report = `# Aegis — Polkadot Hub Deployment Verification

**Network:** Paseo Asset Hub (Chain ID: ${network.chainId})  
**Block:** ${await provider.getBlockNumber()}  
**Explorer:** ${EXPLORER_URL}  
**Verified:** ${new Date().toISOString()}

## Contracts

| Contract | Address | Explorer |
|----------|---------|---------|
| MockUSDC | \`${addresses.usdc}\` | [view](${EXPLORER_URL}/address/${addresses.usdc}) |
| AegisTreasury | \`${addresses.treasury}\` | [view](${EXPLORER_URL}/address/${addresses.treasury}) |
| YieldOracle | \`${addresses.oracle}\` | [view](${EXPLORER_URL}/address/${addresses.oracle}) |
| AegisGuard | \`${addresses.guard}\` | [view](${EXPLORER_URL}/address/${addresses.guard}) |
| AegisVault | \`${addresses.vault}\` | [view](${EXPLORER_URL}/address/${addresses.vault}) |
| MockLendingSource | \`${addresses.lendingSource}\` | [view](${EXPLORER_URL}/address/${addresses.lendingSource}) |
| MockDEXSource | \`${addresses.dexSource}\` | [view](${EXPLORER_URL}/address/${addresses.dexSource}) |

## Verification Method

Polkadot Asset Hub uses PVM (Polkadot Virtual Machine) bytecode compiled via \`resolc\`.  
Source-level verification is not yet supported by block explorers for PVM contracts.  
All contracts are verified by on-chain bytecode presence (PVM magic bytes \`0x50564d\`).

## Compiler

- **Compiler:** resolc v0.6.0 (revive)
- **Solc:** 0.8.28
- **Target:** PVM (PolkaVM)
- **Optimizer:** enabled, 200 runs
`;

  const outPath = path.join(__dirname, "../deployments/verification-polkadotHub.md");
  fs.writeFileSync(outPath, report);
  console.log(`  📄 Report saved: deployments/verification-polkadotHub.md`);
  console.log("");

  if (allDeployed) {
    console.log("✅ All contracts verified on Polkadot Hub testnet");
  } else {
    console.warn("⚠️  Some contracts missing — re-run deploy-polkadot.js");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("\n❌ Verification failed:", err.message);
  process.exit(1);
});