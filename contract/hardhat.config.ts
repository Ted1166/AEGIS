import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
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

    initiaTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.INITIA_RPC_URL!,
      accounts: [process.env.INITIA_PRIVATE_KEY!],
    },

    initiaLocal: {
      type: "http",
      chainType: "l1",
      url: "http://localhost:8545",
      accounts: [process.env.INITIA_PRIVATE_KEY!],
    },
  },
});