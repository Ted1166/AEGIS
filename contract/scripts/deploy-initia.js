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

function loadArtifact(name) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const raw = fs.readFileSync(artifactPath, "utf8");
  return JSON.parse(raw);
}

function loadArtifactFromPath(contractPath, name) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractPath}/${name}.json`);
  const raw = fs.readFileSync(artifactPath, "utf8");
  return JSON.parse(raw);
}

async function deploy(signer, artifact, ...args) {
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
  const deployTx = await factory.getDeployTransaction(...args);

  const tx = await signer.sendTransaction({
    data:     deployTx.data,
    gasLimit: 5_000_000n,
  });

  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait(1, 60_000);
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
    polling: true,
    pollingInterval: 2000,
    staticNetwork: true,
  });
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║      Aegis — Initia EVM Deployment               ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Deployer: ${signer.address}`);

  const balance = await provider.getBalance(signer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} INIT\n`);

  if (balance === 0n) {
    console.error("Deployer has no balance.");
    process.exit(1);
  }

  const network = await provider.getNetwork();
  console.log(`Chain ID: ${network.chainId}\n`);

  const artifacts = {
    MockUSDC:      loadArtifactFromPath("mocks/MockUSDC.sol",      "MockUSDC"),
    AegisTreasury: loadArtifact("AegisTreasury"),
    YieldOracle:   loadArtifactFromPath("oracles/YieldOracle.sol", "YieldOracle"),
    AegisGuard:    loadArtifact("AegisGuard"),
    AegisVault:    loadArtifact("AegisVault"),
  };
  console.log("All artifacts loaded\n");

  let usdcAddress = process.env.USDC_ADDRESS || "";
  if (!usdcAddress) {
    console.log("Deploying MockUSDC...");
    const usdc = await deploy(signer, artifacts.MockUSDC);
    usdcAddress = await usdc.getAddress();
    console.log(`MockUSDC:       ${usdcAddress}`);
  } else {
    console.log(`Using USDC:     ${usdcAddress}`);
  }

  console.log("Deploying AegisTreasury...");
  const treasury = await deploy(signer, artifacts.AegisTreasury, usdcAddress);
  const treasuryAddress = await treasury.getAddress();
  console.log(`AegisTreasury:  ${treasuryAddress}`);

  console.log("Deploying YieldOracle...");
  const oracle = await deploy(signer, artifacts.YieldOracle);
  const oracleAddress = await oracle.getAddress();
  console.log(`YieldOracle:    ${oracleAddress}`);

  console.log("Deploying AegisVault (temp guard = deployer)...");
  const vaultTemp = await deploy(signer, artifacts.AegisVault,
    usdcAddress, oracleAddress, signer.address, treasuryAddress);
  const vaultTempAddress = await vaultTemp.getAddress();

  console.log("Deploying AegisGuard...");
  const guard = await deploy(signer, artifacts.AegisGuard, vaultTempAddress, treasuryAddress);
  const guardAddress = await guard.getAddress();
  console.log(`AegisGuard:     ${guardAddress}`);

  console.log("Deploying AegisVault (final)...");
  const vault = await deploy(signer, artifacts.AegisVault,
    usdcAddress, oracleAddress, guardAddress, treasuryAddress);
  const vaultAddress = await vault.getAddress();
  console.log(`AegisVault:     ${vaultAddress}`);

  console.log("\nWiring contracts...");

  const treasuryWire = new ethers.Contract(treasuryAddress, [
    "function setVault(address) external",
    "function setGuard(address) external",
  ], signer);

  const oracleWire = new ethers.Contract(oracleAddress, [
    "function setVault(address) external",
    "function addWriter(address) external",
  ], signer);

  const guardWire = new ethers.Contract(guardAddress, [
    "function addSignalWriter(address) external",
  ], signer);

  await send(treasuryWire, "setVault",  [vaultAddress],   "Treasury.vault set");
  await send(treasuryWire, "setGuard",  [guardAddress],   "Treasury.guard set");
  await send(oracleWire,   "setVault",  [vaultAddress],   "Oracle.vault set");

  const sentinelAddress = process.env.SENTINEL_PRIVATE_KEY
    ? new ethers.Wallet(process.env.SENTINEL_PRIVATE_KEY).address : null;
  const scorerAddress = process.env.SCORER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.SCORER_PRIVATE_KEY).address : null;

  if (sentinelAddress) {
    await send(guardWire,  "addSignalWriter", [sentinelAddress], `Sentinel authorized: ${sentinelAddress}`);
  }
  if (scorerAddress) {
    await send(oracleWire, "addWriter",       [scorerAddress],   `Scorer authorized:   ${scorerAddress}`);
  }

  const addresses = {
    network:     RPC_URL,
    chainId:     network.chainId.toString(),
    deployer:    signer.address,
    usdc:        usdcAddress,
    treasury:    treasuryAddress,
    oracle:      oracleAddress,
    guard:       guardAddress,
    vault:       vaultAddress,
    deployedAt:  new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "initia.json"),
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           Deployment Complete                     ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\nCopy these into your .env:");
  console.log(`AEGIS_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`AEGIS_GUARD_ADDRESS=${guardAddress}`);
  console.log(`AEGIS_TREASURY_ADDRESS=${treasuryAddress}`);
  console.log(`YIELD_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`USDC_ADDRESS=${usdcAddress}`);
}

main().catch(err => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});