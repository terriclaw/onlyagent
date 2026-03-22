import { defineConfig } from "hardhat/config";
import "dotenv/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

export default defineConfig({
  plugins: [hardhatVerify],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun"
    }
  },

  networks: {
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!]
    }
  },

  verify: {
    etherscan: {
      apiKey: process.env.BASESCAN_API_KEY!
    }
  }
});
