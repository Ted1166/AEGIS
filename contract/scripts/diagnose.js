import { ethers } from "ethers";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import "dotenv/config";

const RPC_URL     = process.env.POLKADOT_HUB_RPC_URL;
const PRIVATE_KEY = process.env.POLKADOT_HUB_PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

  const nonce    = await provider.getTransactionCount(signer.address, "latest");
  const feeData  = await provider.getFeeData();
  const network  = await provider.getNetwork();
  const balance  = await provider.getBalance(signer.address);

  console.log(`Address:   ${signer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} WND`);
  console.log(`ChainID:   ${network.chainId}`);
  console.log(`GasPrice:  ${feeData.gasPrice}`);
  console.log(`Nonce:     ${nonce}`);

  // ── Test 1: plain value transfer ─────────────────────────────────────────
  console.log("\n📤 Test 1: plain value transfer (0.001 WND to self)...");
  try {
    const tx1 = await signer.sendTransaction({
      to:       signer.address,
      value:    ethers.parseEther("0.001"),
      gasLimit: 21_000n,
      gasPrice: feeData.gasPrice,
      nonce,
      type:     0,
      chainId:  420420421,
    });
    console.log(`   tx: ${tx1.hash}`);
    const r1 = await tx1.wait();
    console.log(`✅ Transfer OK, block: ${r1.blockNumber}`);
  } catch(e) {
    console.log(`❌ Transfer failed: ${e.message.slice(0, 200)}`);
  }

  // ── Test 2: empty contract deployment (no bytecode) ───────────────────────
  console.log("\n📤 Test 2: empty deploy (data=0x)...");
  try {
    const nonce2 = await provider.getTransactionCount(signer.address, "latest");
    const tx2 = await signer.sendTransaction({
      data:     "0x",
      gasLimit: 100_000n,
      gasPrice: feeData.gasPrice,
      nonce:    nonce2,
      type:     0,
      chainId:  420420421,
    });
    console.log(`   tx: ${tx2.hash}`);
    const r2 = await tx2.wait();
    console.log(`✅ Empty deploy OK: ${r2.contractAddress}`);
  } catch(e) {
    console.log(`❌ Empty deploy failed: ${e.message.slice(0, 200)}`);
  }

  // ── Test 3: raw eth_call to check RPC works ───────────────────────────────
  console.log("\n📤 Test 3: eth_getTransactionCount raw RPC...");
  try {
    const raw = await provider.send("eth_getTransactionCount", [signer.address, "latest"]);
    console.log(`✅ eth_getTransactionCount: ${raw}`);
  } catch(e) {
    console.log(`❌ RPC failed: ${e.message}`);
  }

  // ── Test 4: check if eth_sendRawTransaction works with EIP-1559 ──────────
  console.log("\n📤 Test 4: EIP-1559 value transfer...");
  try {
    const nonce4 = await provider.getTransactionCount(signer.address, "latest");
    const tx4 = await signer.sendTransaction({
      to:                   signer.address,
      value:                ethers.parseEther("0.001"),
      gasLimit:             21_000n,
      maxFeePerGas:         feeData.gasPrice,
      maxPriorityFeePerGas: 0n,
      nonce:                nonce4,
      type:                 2,
      chainId:              420420421,
    });
    console.log(`   tx: ${tx4.hash}`);
    const r4 = await tx4.wait();
    console.log(`✅ EIP-1559 transfer OK, block: ${r4.blockNumber}`);
  } catch(e) {
    console.log(`❌ EIP-1559 failed: ${e.message.slice(0, 200)}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });