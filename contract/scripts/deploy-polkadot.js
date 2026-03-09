import { ethers } from "ethers";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import "dotenv/config";

const RPC_URL     = process.env.POLKADOT_HUB_RPC_URL;
const PRIVATE_KEY = process.env.POLKADOT_HUB_PRIVATE_KEY;

if (!RPC_URL || !PRIVATE_KEY) {
  console.error("❌ Missing POLKADOT_HUB_RPC_URL or POLKADOT_HUB_PRIVATE_KEY in .env");
  process.exit(1);
}

const RESOLC_BIN = path.join(process.env.HOME, "resolc-bin-060");

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
  collectSources(path.join(root, "contracts"), root);

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
    execSync(`${RESOLC_BIN} --standard-json`, { input, cwd: root, maxBuffer: 50 * 1024 * 1024 }).toString()
  );

  if (result.errors?.some(e => e.severity === "error")) {
    throw new Error(result.errors.find(e => e.severity === "error").message);
  }

  const fileKey = Object.keys(result.contracts || {}).find(k =>
    result.contracts[k][contractName]
  );
  if (!fileKey) throw new Error(`${contractName} not found in output`);

  const c = result.contracts[fileKey][contractName];
  return {
    abi:      c.abi,
    bytecode: "0x" + c.evm.bytecode.object,
  };
}

async function deploy(signer, artifact, ...args) {
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
  const deployTx = await factory.getDeployTransaction(...args);

  const tx = await signer.sendTransaction({
    data:                deployTx.data,
    gasLimit:            10_000_000n,
    maxFeePerGas:        2_000_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000_000n,
  });

  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait(1, 120_000);
  console.log(`  deployed at: ${receipt.contractAddress}`);
  return new ethers.Contract(receipt.contractAddress, artifact.abi, signer);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
      polling: true,
      pollingInterval: 3000,
      staticNetwork: true,
    });  
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║    🛡️  Aegis — Polkadot Hub Deployment           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Deployer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} WND\n`);

  const network  = await provider.getNetwork();
  const feeData  = await provider.getFeeData();
  const nonce    = await provider.getTransactionCount(signer.address, "latest");
  console.log(`Chain ID:  ${network.chainId}`);
  console.log(`GasPrice:  ${feeData.gasPrice}`);
  console.log(`Nonce:     ${nonce}\n`);

  if (balance === 0n) {
    console.error("❌ Deployer has no balance.");
    process.exit(1);
  }

  // Compile all contracts
  const root = path.join(__dirname, "..");
  const contracts = {
    MockUSDC:      await compile(path.join(root, "contracts/mocks/MockUSDC.sol"),         "MockUSDC"),
    AegisTreasury: await compile(path.join(root, "contracts/AegisTreasury.sol"),          "AegisTreasury"),
    YieldOracle:   await compile(path.join(root, "contracts/oracles/YieldOracle.sol"),    "YieldOracle"),
    AegisGuard:    await compile(path.join(root, "contracts/AegisGuard.sol"),             "AegisGuard"),
    AegisVault:    await compile(path.join(root, "contracts/AegisVault.sol"),             "AegisVault"),
  };
  console.log("✅ All contracts compiled\n");

  // Deploy
  let usdcAddress = process.env.USDC_ADDRESS || "";
  if (!usdcAddress) {
    console.log("⚙️  Deploying MockUSDC...");
    const usdc = await deploy(signer, contracts.MockUSDC);
    usdcAddress = await usdc.getAddress();
    console.log(`✅ MockUSDC:       ${usdcAddress}`);
  } else {
    console.log(`✅ Using USDC:     ${usdcAddress}`);
  }

  console.log("⚙️  Deploying AegisTreasury...");
  const treasury = await deploy(signer, contracts.AegisTreasury, usdcAddress);
  const treasuryAddress = await treasury.getAddress();
  console.log(`✅ AegisTreasury:  ${treasuryAddress}`);

  console.log("⚙️  Deploying YieldOracle...");
  const oracle = await deploy(signer, contracts.YieldOracle);
  const oracleAddress = await oracle.getAddress();
  console.log(`✅ YieldOracle:    ${oracleAddress}`);

  console.log("⚙️  Deploying AegisVault (placeholder guard)...");
  const vaultTemp = await deploy(signer, contracts.AegisVault,
    usdcAddress, oracleAddress, signer.address, treasuryAddress);
  const vaultTempAddress = await vaultTemp.getAddress();
  console.log(`✅ AegisVault (temp): ${vaultTempAddress}`);

  console.log("⚙️  Deploying AegisGuard...");
  const guard = await deploy(signer, contracts.AegisGuard, vaultTempAddress, treasuryAddress);
  const guardAddress = await guard.getAddress();
  console.log(`✅ AegisGuard:     ${guardAddress}`);

  console.log("⚙️  Deploying AegisVault (final)...");
  const vault = await deploy(signer, contracts.AegisVault,
    usdcAddress, oracleAddress, guardAddress, treasuryAddress);
  const vaultAddress = await vault.getAddress();
  console.log(`✅ AegisVault:     ${vaultAddress}`);

  // Wire
  console.log("\n⚙️  Wiring contracts...");
  const treasuryContract = new ethers.Contract(treasuryAddress,
    ["function setVault(address) external", "function setGuard(address) external"], signer);
  const oracleContract = new ethers.Contract(oracleAddress,
    ["function setVault(address) external", "function addWriter(address) external"], signer);
  const guardContract = new ethers.Contract(guardAddress,
    ["function addSignalWriter(address) external"], signer);

  let tx;
  tx = await treasuryContract.setVault(vaultAddress, {
    gasLimit: 500_000n, maxFeePerGas: 2_000_000_000_000n, maxPriorityFeePerGas: 1_000_000_000_000n });
  await tx.wait();
  console.log("✅ Treasury.vault set");

  tx = await treasuryContract.setGuard(guardAddress, {
    gasLimit: 500_000n, maxFeePerGas: 2_000_000_000_000n, maxPriorityFeePerGas: 1_000_000_000_000n });
  await tx.wait();
  console.log("✅ Treasury.guard set");

  tx = await oracleContract.setVault(vaultAddress, {
    gasLimit: 500_000n, maxFeePerGas: 2_000_000_000_000n, maxPriorityFeePerGas: 1_000_000_000_000n });
  await tx.wait();
  console.log("✅ Oracle.vault set");

  const sentinelAddress = process.env.SENTINEL_PRIVATE_KEY
    ? new ethers.Wallet(process.env.SENTINEL_PRIVATE_KEY).address : null;
  const scorerAddress = process.env.SCORER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.SCORER_PRIVATE_KEY).address : null;

  if (sentinelAddress) {
    tx = await guardContract.addSignalWriter(sentinelAddress, {
      gasLimit: 500_000n, maxFeePerGas: 2_000_000_000_000n, maxPriorityFeePerGas: 1_000_000_000_000n });
    await tx.wait();
    console.log(`✅ Sentinel authorized: ${sentinelAddress}`);
  }
  if (scorerAddress) {
    tx = await oracleContract.addWriter(scorerAddress, {
      gasLimit: 500_000n, maxFeePerGas: 2_000_000_000_000n, maxPriorityFeePerGas: 1_000_000_000_000n });
    await tx.wait();
    console.log(`✅ Scorer authorized:   ${scorerAddress}`);
  }

  // Save
  const addresses = {
    network: RPC_URL, deployer: signer.address,
    usdc: usdcAddress, treasury: treasuryAddress,
    oracle: oracleAddress, guard: guardAddress, vault: vaultAddress,
    deployedAt: new Date().toISOString(),
  };
  const deploymentsDir = path.join(root, "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(path.join(deploymentsDir, "polkadotHub.json"), JSON.stringify(addresses, null, 2));

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           ✅ Deployment Complete                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n💡 Copy these into your .env:`);
  console.log(`AEGIS_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`AEGIS_GUARD_ADDRESS=${guardAddress}`);
  console.log(`AEGIS_TREASURY_ADDRESS=${treasuryAddress}`);
  console.log(`YIELD_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`USDC_ADDRESS=${usdcAddress}`);
}

main().catch(err => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
