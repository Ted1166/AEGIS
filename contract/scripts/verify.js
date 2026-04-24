import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const network = hre.network.name;
  console.log(`\n🔍 Verifying contracts on: ${network}\n`);

  const deploymentsPath = path.join(process.cwd(), "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      `No deployment found for network "${network}". ` +
      `Run deploy.js first.`
    );
  }

  const addresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  console.log("Loaded addresses:", addresses);

  const verifications = [
    {
      name:             "AegisTreasury",
      address:          addresses.treasury,
      constructorArgs:  [addresses.usdc],
    },
    {
      name:             "YieldOracle",
      address:          addresses.oracle,
      constructorArgs:  [],
    },
    {
      name:             "AegisGuard",
      address:          addresses.guard,
      constructorArgs:  [addresses.vault, addresses.treasury],
    },
    {
      name:             "AegisVault",
      address:          addresses.vault,
      constructorArgs:  [
        addresses.usdc,
        addresses.oracle,
        addresses.guard,
        addresses.treasury,
      ],
    },
  ];

  for (const v of verifications) {
    console.log(`\n⚙️  Verifying ${v.name} at ${v.address}...`);
    try {
      await hre.run("verify:verify", {
        address:              v.address,
        constructorArguments: v.constructorArgs,
      });
      console.log(`✅ ${v.name} verified`);
    } catch (err) {
      if (err.message?.toLowerCase().includes("already verified")) {
        console.log(`✅ ${v.name} already verified`);
      } else {
        console.warn(`⚠️  ${v.name} verification failed: ${err.message}`);
      }
    }
  }

  console.log("\n✅ Verification complete");
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});