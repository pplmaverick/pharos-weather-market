import {
  createPublicClient,
  http,
  defineChain,
  getAddress,
  type Hex,
} from "viem";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Pacific Ocean Mainnet",
  nativeCurrency: { name: "PROS", symbol: "PROS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.pharos.xyz"] } },
});

const EXPECTED = {
  router:        "0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297",
  weatherMarket: "0xcac5b9d2817325e78090e3ce4b9c299c819cf953",
  owner:         "0xed2B5717c9b936ecC76d75401026A99143e278F5",
};

function checkLine(label: string, got: string, expected: string): boolean {
  const match = getAddress(got) === getAddress(expected);
  const icon = match ? "✅" : "❌";
  const note = match ? "(match)" : `(MISMATCH — expected ${expected})`;
  console.log(`${icon} ${label}: ${got} ${note}`);
  return match;
}

async function main() {
  // deployments/pharos-mainnet.json から ccipOracle アドレスを読む
  const deploymentPath = path.join(__dirname, "../deployments/pharos-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const oracleAddress = deployment.contracts.CCIPWeatherOracle as Hex;

  if (!oracleAddress) throw new Error("CCIPWeatherOracle not found in pharos-mainnet.json");

  console.log("CCIPWeatherOracle:", oracleAddress);
  console.log("Network: Pharos Pacific Ocean Mainnet (Chain ID 1672)");
  console.log("---");

  const publicClient = createPublicClient({
    chain: pharosMainnet,
    transport: http(),
  });

  const artifact = await hre.artifacts.readArtifact("CCIPWeatherOracle");

  // 1. getRouter()
  const router = await publicClient.readContract({
    address: oracleAddress,
    abi: artifact.abi,
    functionName: "getRouter",
  }) as string;

  // 2. weatherMarket()
  const weatherMarket = await publicClient.readContract({
    address: oracleAddress,
    abi: artifact.abi,
    functionName: "weatherMarket",
  }) as string;

  // 3. owner()
  const owner = await publicClient.readContract({
    address: oracleAddress,
    abi: artifact.abi,
    functionName: "owner",
  }) as string;

  const r1 = checkLine("router",        router,        EXPECTED.router);
  const r2 = checkLine("weatherMarket", weatherMarket, EXPECTED.weatherMarket);
  const r3 = checkLine("owner",         owner,         EXPECTED.owner);

  console.log("---");
  if (r1 && r2 && r3) {
    console.log("All checks passed. CCIPWeatherOracle is live on Pharos Mainnet.");
  } else {
    console.error("One or more checks FAILED. Please review the output above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
