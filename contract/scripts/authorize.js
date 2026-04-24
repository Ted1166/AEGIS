import { ethers } from "ethers";
import "dotenv/config";

const GUARD_ABI  = ["function addSignalWriter(address) external"];
const ORACLE_ABI = ["function addWriter(address) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.INITIA_RPC_URL);
  const signer   = new ethers.Wallet(process.env.INITIA_PRIVATE_KEY, provider);

  const guard  = new ethers.Contract(process.env.AEGIS_GUARD_ADDRESS,  GUARD_ABI,  signer);
  const oracle = new ethers.Contract(process.env.YIELD_ORACLE_ADDRESS, ORACLE_ABI, signer);

  const sentinel = new ethers.Wallet(process.env.SENTINEL_PRIVATE_KEY).address;
  const scorer   = new ethers.Wallet(process.env.SCORER_PRIVATE_KEY).address;

  console.log(`Authorizing Sentinel: ${sentinel}`);
  let tx = await guard.addSignalWriter(sentinel, { gasLimit: 300_000n });
  await tx.wait();
  console.log("  Sentinel authorized");

  console.log(`Authorizing Scorer:   ${scorer}`);
  tx = await oracle.addWriter(scorer, { gasLimit: 300_000n });
  await tx.wait();
  console.log("  Scorer authorized");

  console.log("\nDone. All services authorized.");
}

main().catch(err => {
  console.error("Authorization failed:", err.message);
  process.exit(1);
});