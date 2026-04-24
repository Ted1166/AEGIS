import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL     = process.env.INITIA_RPC_URL;
const PRIVATE_KEY = process.env.INITIA_PRIVATE_KEY;

if (!RPC_URL || !PRIVATE_KEY) {
  console.error("Missing INITIA_RPC_URL or INITIA_PRIVATE_KEY in .env");
  process.exit(1);
}

function loadArtifact(contractPath, name) {
  const p = path.join(__dirname, `../artifacts/contracts/${contractPath}/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadAddresses() {
  const p = path.join(__dirname, "../deployments/initia.json");
  if (!fs.existsSync(p)) throw new Error("No deployment found. Run deploy-initia.js first.");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function deploy(signer, artifact, ...args) {
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
  const deployTx = await factory.getDeployTransaction(...args);
  const tx = await signer.sendTransaction({ data: deployTx.data, gasLimit: 5_000_000n });
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  deployed at: ${receipt.contractAddress}`);
  return new ethers.Contract(receipt.contractAddress, artifact.abi, signer);
}

async function send(contract, method, args, label) {
  const tx = await contract[method](...args, { gasLimit: 300_000n });
  await tx.wait();
  console.log(`  ${label}`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    polling: true, pollingInterval: 2000, staticNetwork: true,
  });
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║           Aegis — Initia Testnet Seed            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Deployer: ${signer.address}\n`);

  const addresses = loadAddresses();
  console.log(`Vault:    ${addresses.vault}`);
  console.log(`USDC:     ${addresses.usdc}\n`);

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
    "event Deposited(address indexed user, uint256 amount, uint256 shares)",
  ];
  const ORACLE_ABI = [
    "function addProtocol(address protocol) external",
    "function writeScore(address protocol, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 tvlFloor) external",
  ];

  const usdc   = new ethers.Contract(addresses.usdc,   USDC_ABI,   signer);
  const vault  = new ethers.Contract(addresses.vault,  VAULT_ABI,  signer);
  const oracle = new ethers.Contract(addresses.oracle, ORACLE_ABI, signer);

  const mockArtifact = loadArtifact("mocks/MockYieldSource.sol", "MockYieldSource");

  console.log("Minting test USDC...");
  const MINT_AMOUNT = ethers.parseUnits("100000", 6);
  let tx = await usdc.mint(signer.address, MINT_AMOUNT, { gasLimit: 200_000n });
  await tx.wait();
  const bal = await usdc.balanceOf(signer.address);
  console.log(`  Deployer balance: ${(Number(bal) / 1e6).toFixed(2)} USDC`);

  console.log("\nDeploying mock yield sources...");
  const lendingSource = await deploy(signer, mockArtifact,
    addresses.usdc, "Aegis Mock Lending", 800, ethers.parseUnits("5000000", 6));
  const lendingAddress = await lendingSource.getAddress();
  console.log(`  MockLendingSource: ${lendingAddress} (8% APY, $5M TVL)`);

  const dexSource = await deploy(signer, mockArtifact,
    addresses.usdc, "Aegis Mock DEX LP", 2200, ethers.parseUnits("800000", 6));
  const dexAddress = await dexSource.getAddress();
  console.log(`  MockDEXSource:     ${dexAddress} (22% APY, $800k TVL)`);

  console.log("\nRegistering yield sources in AegisVault...");
  await send(vault, "addYieldSource", [lendingAddress], "MockLendingSource registered");
  await send(vault, "addYieldSource", [dexAddress],     "MockDEXSource registered");

  console.log("\nRegistering protocols in YieldOracle...");
  await send(oracle, "addProtocol", [lendingAddress], "MockLendingSource tracked in oracle");
  await send(oracle, "addProtocol", [dexAddress],     "MockDEXSource tracked in oracle");

  console.log("\nWriting initial Yield Quality Scores...");
  const TVL_FLOOR = ethers.parseUnits("500000", 6);

  tx = await oracle.writeScore(
    lendingAddress, 700, 100, 800,
    ethers.parseUnits("5000000", 6), TVL_FLOOR,
    { gasLimit: 300_000n }
  );
  await tx.wait();
  console.log("  LendingSource scored: ~75/100 (Sustainable)");

  tx = await oracle.writeScore(
    dexAddress, 800, 1400, 2200,
    ethers.parseUnits("800000", 6), TVL_FLOOR,
    { gasLimit: 300_000n }
  );
  await tx.wait();
  console.log("  DEXSource scored: ~52/100 (Mixed)");

  console.log("\nMaking test deposit ($10,000 USDC)...");
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6);
  tx = await usdc.approve(addresses.vault, DEPOSIT_AMOUNT, { gasLimit: 200_000n });
  await tx.wait();
  const depositTx = await vault.deposit(DEPOSIT_AMOUNT, { gasLimit: 500_000n });
  const receipt = await depositTx.wait();

  const iface = new ethers.Interface(VAULT_ABI);
  const depositEvent = receipt.logs
    .map(log => { try { return iface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "Deposited");
  const shares = depositEvent ? ethers.formatUnits(depositEvent.args.shares, 6) : "?";
  console.log(`  Deposited $10,000 USDC -> ${shares} vault shares`);

  console.log("\nTriggering initial rebalance...");
  tx = await vault.rebalance({ gasLimit: 500_000n });
  await tx.wait();
  console.log("  Vault rebalanced — funds routed to yield sources");

  const totalAssets = await vault.totalAssets();
  const sources     = await vault.getYieldSources();

  const deploymentsDir = path.join(__dirname, "../deployments");
  const existing = JSON.parse(fs.readFileSync(path.join(deploymentsDir, "initia.json"), "utf8"));
  fs.writeFileSync(
    path.join(deploymentsDir, "initia.json"),
    JSON.stringify({ ...existing, lendingSource: lendingAddress, dexSource: dexAddress }, null, 2)
  );

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                 Seed Complete                    ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Vault TVL:     $${(Number(totalAssets) / 1e6).toFixed(2)} USDC`);
  console.log(`Yield sources: ${sources.length}`);
  console.log(`\n  ${lendingAddress}  (Lending, score ~75)`);
  console.log(`  ${dexAddress}  (DEX LP, score ~52)`);
  console.log("\nReady to run AI services:");
  console.log("  npm run sentinel");
  console.log("  npm run scorer");
  console.log("  ADVISOR_RUN_ON_START=true npm run advisor");
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});