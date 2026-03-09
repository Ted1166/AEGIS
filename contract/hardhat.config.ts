import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          evmVersion: "paris",
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "paris",
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },

    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },

    westendAssetHub: {
      type: "http",
      chainType: "l1",
      url: process.env.WESTEND_ASSET_HUB_RPC_URL!,
      accounts: [process.env.POLKADOT_HUB_PRIVATE_KEY!],
    },

    polkadotAssetHub: {
      type: "http",
      chainType: "l1",
      url: process.env.POLKADOT_ASSET_HUB_RPC_URL!,
      accounts: [process.env.POLKADOT_HUB_PRIVATE_KEY!],
    },
  },
});