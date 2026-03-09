import { ethers } from "ethers";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import "dotenv/config";

const RPC_URL     = process.env.POLKADOT_HUB_RPC_URL;
const PRIVATE_KEY = process.env.POLKADOT_HUB_PRIVATE_KEY;
const RESOLC_BIN  = path.join(process.env.HOME, "resolc-bin-060");

if (!RPC_URL || !PRIVATE_KEY) {
  console.error("❌ Missing POLKADOT_HUB_RPC_URL or POLKADOT_HUB_PRIVATE_KEY in .env");
  process.exit(1);
}

function loadAddresses() {
  const p = path.join(__dirname, "../deployments/polkadotHub.json");
  if (!fs.existsSync(p)) throw new Error("No deployment found. Run deploy-polkadot.js first.");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function compile(contractPath, contractName) {
  console.log(`⚙️  Compiling ${contractName} with resolc...`);
  const root = path.join(__dirname, "..");
  const sources = {};

  function collectSources(dir, base) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectSources(full, base);
      else if (entry.name.endsWith(".sol")) {
        const rel = path.relative(base, full);
        sources[rel] = { content: fs.readFileSync(full, "utf8") };
      }
    }
  }

  function collectOZ(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectOZ(full);
      else if (entry.name.endsWith(".sol")) {
        const rel = "@openzeppelin/" + path.relative(path.join(root, "node_modules/@openzeppelin"), full);
        sources[rel] = { content: fs.readFileSync(full, "utf8") };
      }
    }
  }

  collectSources(path.join(root, "contracts"), root);
  collectOZ(path.join(root, "node_modules/@openzeppelin"));

  const input = JSON.stringify({
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } }
    }
  });

  const result = JSON.parse(
    execSync(`${RESOLC_BIN} --standard-json`, {
      input, cwd: root, maxBuffer: 50 * 1024 * 1024
    }).toString()
  );

  if (result.errors?.some(e => e.severity === "error")) {
    throw new Error(result.errors.find(e => e.severity === "error").message);
  }

  const fileKey = Object.keys(result.contracts || {}).find(k =>
    result.contracts[k][contractName]
  );
  if (!fileKey) throw new Error(`${contractName} not found in output`);

  const c = result.contracts[fileKey][contractName];
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

async function deploy(signer, artifact, ...args) {
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
  const deployTx = await factory.getDeployTransaction(...args);

  const tx = await signer.sendTransaction({
    data:                 deployTx.data,
    gasLimit:             10_000_000n,
    maxFeePerGas:         2_000_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000_000n,
  });

  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait(1, 120_000);
  console.log(`  deployed at: ${receipt.contractAddress}`);
  return new ethers.Contract(receipt.contractAddress, artifact.abi, signer);
}

async function sendTx(tx) {
  return tx.wait(1, 120_000);
}

const GAS = {
  gasLimit:             3_000_000n,
  maxFeePerGas:         2_000_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000_000n,
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    polling: true, pollingInterval: 3000, staticNetwork: true,
  });
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║           🌱  Aegis Testnet Seed                 ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Deployer: ${signer.address}\n`);

  const addresses = loadAddresses();
  console.log(`Vault:    ${addresses.vault}`);
  console.log(`USDC:     ${addresses.usdc}\n`);

  // ABIs
  const USDC_ABI = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];
  const VAULT_ABI = [
    "function addYieldSource(address source) external",
    "function deposit(uint256 amount) external returns (uint256)",
    "function rebalance() external",
    "function totalAssets() external view returns (uint256)",
    "function getYieldSources() external view returns (address[])",
  ];
  const ORACLE_ABI = [
    "function addProtocol(address protocol) external",
    "function writeScore(address protocol, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 tvlFloor) external",
  ];

  const usdc   = new ethers.Contract(addresses.usdc,     USDC_ABI,   signer);
  const vault  = new ethers.Contract(addresses.vault,    VAULT_ABI,  signer);
  const oracle = new ethers.Contract(addresses.oracle,   ORACLE_ABI, signer);

  // Compile MockYieldSource
  const mockArtifact = await compile(
    path.join(__dirname, "../contracts/mocks/MockYieldSource.sol"),
    "MockYieldSource"
  );

  // Mint USDC
  console.log("⚙️  Minting test USDC...");
  const MINT_AMOUNT = ethers.parseUnits("100000", 6);
  await sendTx(await usdc.mint(signer.address, MINT_AMOUNT, GAS));
  const bal = await usdc.balanceOf(signer.address);
  console.log(`✅ Deployer balance: ${(Number(bal) / 1e6).toFixed(2)} USDC`);

  // Deploy mock yield sources
  console.log("\n⚙️  Deploying mock yield sources...");
  const lendingSource = await deploy(signer, mockArtifact,
    addresses.usdc, "Aegis Mock Lending", 800, 5_000_000_000_000n);
  const lendingAddress = await lendingSource.getAddress();
  console.log(`✅ MockLendingSource: ${lendingAddress} (8% APY, $5M TVL)`);

  const dexSource = await deploy(signer, mockArtifact,
    addresses.usdc, "Aegis Mock DEX LP", 2200, 800_000_000_000n);
  const dexAddress = await dexSource.getAddress();
  console.log(`✅ MockDEXSource:     ${dexAddress} (22% APY, $800k TVL)`);

  // Register in vault
  console.log("\n⚙️  Registering yield sources in AegisVault...");
  await sendTx(await vault.addYieldSource(lendingAddress, GAS));
  console.log("✅ MockLendingSource registered");
  await sendTx(await vault.addYieldSource(dexAddress, GAS));
  console.log("✅ MockDEXSource registered");

  // Register in oracle
  console.log("\n⚙️  Registering protocols in YieldOracle...");
  await sendTx(await oracle.addProtocol(lendingAddress, GAS));
  console.log("✅ MockLendingSource tracked in oracle");
  await sendTx(await oracle.addProtocol(dexAddress, GAS));
  console.log("✅ MockDEXSource tracked in oracle");

  // Write initial scores
  console.log("\n⚙️  Writing initial Yield Quality Scores...");
  const TVL_FLOOR = ethers.parseUnits("500000", 6);

  await sendTx(await oracle.writeScore(
    lendingAddress, 700, 100, 800,
    ethers.parseUnits("5000000", 6), TVL_FLOOR, GAS
  ));
  console.log("✅ LendingSource scored: ~75/100 (Sustainable)");

  await sendTx(await oracle.writeScore(
    dexAddress, 800, 1400, 2200,
    ethers.parseUnits("800000", 6), TVL_FLOOR, GAS
  ));
  console.log("✅ DEXSource scored: ~52/100 (Mixed)");

  // Test deposit
  console.log("\n⚙️  Making test deposit ($10,000 USDC)...");
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6);
  await sendTx(await usdc.approve(addresses.vault, DEPOSIT_AMOUNT, GAS));
  const depositReceipt = await sendTx(await vault.deposit(DEPOSIT_AMOUNT, GAS));

  const vaultIface = new ethers.Interface(VAULT_ABI);
  const depositedEvent = depositReceipt.logs
    .map(log => { try { return vaultIface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "Deposited");
  const shares = depositedEvent
    ? ethers.formatUnits(depositedEvent.args.shares, 6) : "?";
  console.log(`✅ Deposited $10,000 USDC → ${shares} vault shares`);

  // Rebalance
  console.log("\n⚙️  Triggering initial rebalance...");
  await sendTx(await vault.rebalance(GAS));
  console.log("✅ Vault rebalanced — funds routed to yield sources");

  // Summary
  const totalAssets = await vault.totalAssets();
  const sources     = await vault.getYieldSources();

  // Save seed addresses
  const seedData = { lendingSource: lendingAddress, dexSource: dexAddress };
  const deploymentsDir = path.join(__dirname, "../deployments");
  const existing = JSON.parse(fs.readFileSync(path.join(deploymentsDir, "polkadotHub.json"), "utf8"));
  fs.writeFileSync(
    path.join(deploymentsDir, "polkadotHub.json"),
    JSON.stringify({ ...existing, ...seedData }, null, 2)
  );

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║              🌱 Seed Complete                    ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Vault TVL:      $${(Number(totalAssets) / 1e6).toFixed(2)} USDC`);
  console.log(`Yield sources:  ${sources.length}`);
  console.log(`\nYield sources:`);
  console.log(`  ${lendingAddress}  (Lending, score ~75)`);
  console.log(`  ${dexAddress}  (DEX LP, score ~52)`);
  console.log("\n💡 Sentinel, Scorer, and Advisor are now ready to run.");
  console.log("   npm run sentinel");
  console.log("   npm run scorer");
  console.log("   ADVISOR_RUN_ON_START=true npm run advisor");
}

main().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});