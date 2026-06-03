import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: "0.8.28",
  networks: {
    arc: {
      type: "http",
      url: "https://rpc.testnet.arc.network",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: 5042002,
    },
    pharos: {
      type: "http",
      url: "https://atlantic.dplabs-internal.com",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: 688689,
    },
    pharosMainnet: {
      type: "http",
      url: "https://rpc.pharos.xyz",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: 1672,
      gas: 5_000_000,
    },
  },
  // Hardhat v3 verify config
  // Note: hardhat-verify v3 dropped customChains support.
  // Pharos mainnet (1672) verification must be done via direct API call to
  // https://api.socialscan.io/pharos/v1/explorer/command_api/contract
  // or through the pharosscan.xyz UI when the API is available.
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY ?? "anything",
    },
  },
});
