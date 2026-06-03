import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const CCIP_ROUTER = "0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297";
const WEATHER_MARKET = "0xcac5b9d2817325e78090e3ce4b9c299c819cf953";
const OWNER = "0xed2B5717c9b936ecC76d75401026A99143e278F5";
const GAS_OPTS = { gas: 5_000_000n };

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Pacific Ocean Mainnet",
  nativeCurrency: { name: "PROS", symbol: "PROS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.pharos.xyz"] } },
});

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");

  const account = privateKeyToAccount(`0x${privateKey}` as Hex);
  console.log("Deployer:", account.address);
  console.log("Network: Pharos Pacific Ocean Mainnet (Chain ID 1672)");

  const publicClient = createPublicClient({
    chain: pharosMainnet,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: pharosMainnet,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`PROS balance: ${Number(balance) / 1e18} PROS`);

  console.log("\nDeploying CCIPWeatherOracle...");
  console.log("  router      :", CCIP_ROUTER);
  console.log("  weatherMarket:", WEATHER_MARKET);
  console.log("  owner       :", OWNER);

  const artifact = await hre.artifacts.readArtifact("CCIPWeatherOracle");
  const hash = await (walletClient as any).deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as Hex,
    args: [CCIP_ROUTER, WEATHER_MARKET, OWNER],
    ...GAS_OPTS,
  });

  console.log("\nTx hash:", hash);
  console.log("Waiting for 2 block confirmations...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  if (receipt.status === "reverted") {
    throw new Error(`Deployment reverted! tx: ${hash}`);
  }

  const address = receipt.contractAddress!;
  console.log("\n✅ CCIPWeatherOracle deployed at:", address);

  // 追加 ccipOracle 欄位到 deployments/pharos-mainnet.json
  const deploymentPath = path.join(__dirname, "../deployments/pharos-mainnet.json");
  const existing = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  existing.contracts.CCIPWeatherOracle = address;
  fs.writeFileSync(deploymentPath, JSON.stringify(existing, null, 2) + "\n");
  console.log("✅ deployments/pharos-mainnet.json updated");

  console.log("\n--- Constructor arguments for manual verify ---");
  console.log("  arg[0] router       :", CCIP_ROUTER);
  console.log("  arg[1] weatherMarket:", WEATHER_MARKET);
  console.log("  arg[2] owner        :", OWNER);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
