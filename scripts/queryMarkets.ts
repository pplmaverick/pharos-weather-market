/**
 * 查詢 Pharos Mainnet 上四個天氣市場的狀態
 */
import {
  createPublicClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Mainnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pharos.xyz"] },
  },
});

const WEATHER_MARKET = "0xcac5b9d2817325e78090e3ce4b9c299c819cf953" as Hex;
const STATUS_LABEL = ["OPEN", "LOCKED", "SETTLED"];

async function main() {
  const publicClient = createPublicClient({
    chain: pharosMainnet,
    transport: http(),
  });

  const artifact = await hre.artifacts.readArtifact("WeatherMarket");

  console.log("=== Pharos Mainnet 市場狀態查詢 ===\n");
  console.log(`合約地址: ${WEATHER_MARKET}\n`);

  for (let id = 0; id <= 8; id++) {
    const result = await publicClient.readContract({
      address: WEATHER_MARKET,
      abi: artifact.abi,
      functionName: "getMarket",
      args: [BigInt(id)],
    }) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];

    const [city, targetDate, lockTime, status, totalPool, finalTemp, winningBucket, buckets, noWinner] = result;

    const targetDateStr = new Date(Number(targetDate) * 1000).toISOString().split("T")[0];
    const lockTimeStr = new Date(Number(lockTime) * 1000).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    console.log(`--- Market #${id} ---`);
    console.log(`  city:       ${city}`);
    console.log(`  status:     ${STATUS_LABEL[status]} (${status})`);
    console.log(`  targetDate: ${targetDateStr} (Unix: ${targetDate})`);
    console.log(`  lockTime:   ${lockTimeStr}`);
    console.log(`  totalPool:  ${Number(totalPool) / 1e6} USDC`);
    if (status === 2) {
      console.log(`  finalTemp:  ${Number(finalTemp) / 10} °C`);
      console.log(`  winning:    bucket #${winningBucket}`);
      console.log(`  noWinner:   ${noWinner}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("查詢失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
