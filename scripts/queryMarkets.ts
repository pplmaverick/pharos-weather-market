/**
 * 查詢 Pharos Mainnet 上所有天氣市場的狀態（讀 nextMarketId 掃全部）
 * finalTemp / buckets 皆為整數攝氏，無 x10 編碼。
 * 用法：npx hardhat run scripts/queryMarkets.ts
 *      FROM=17 npx hardhat run scripts/queryMarkets.ts   # 只看 id >= 17
 */
import {
  createPublicClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import hre from "hardhat";
import dotenv from "dotenv";
import { sleep, withRetry } from "./lib/tx.js";

dotenv.config();

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Mainnet",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
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

  const nextId = (await withRetry(() =>
    publicClient.readContract({
      address: WEATHER_MARKET,
      abi: artifact.abi,
      functionName: "nextMarketId",
    }),
  )) as bigint;
  const from = Number(process.env.FROM ?? 0);

  console.log("=== Pharos Mainnet 市場狀態查詢 ===\n");
  console.log(`合約地址: ${WEATHER_MARKET}`);
  console.log(`nextMarketId: ${nextId}（共 ${nextId} 個市場）\n`);

  const counts = [0, 0, 0];

  for (let id = from; id < Number(nextId); id++) {
    if (id > from) await sleep(300);
    const result = (await withRetry(() =>
      publicClient.readContract({
        address: WEATHER_MARKET,
        abi: artifact.abi,
        functionName: "getMarket",
        args: [BigInt(id)],
      }),
    )) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];

    const [city, targetDate, lockTime, status, totalPool, finalTemp, winningBucket, buckets, noWinner] = result;
    counts[status]++;

    console.log(`--- Market #${id} ---`);
    console.log(`  city:       ${city}`);
    console.log(`  status:     ${STATUS_LABEL[status]} (${status})`);
    console.log(`  targetDate: ${new Date(Number(targetDate) * 1000).toISOString()} (Unix: ${targetDate})`);
    console.log(`  lockTime:   ${new Date(Number(lockTime) * 1000).toISOString()} (Unix: ${lockTime})`);
    console.log(`  buckets:    [${buckets.join(", ")}] °C`);
    console.log(`  totalPool:  ${Number(totalPool) / 1e6} USDC`);
    if (status === 2) {
      console.log(`  finalTemp:  ${finalTemp} °C`);
      console.log(`  winning:    bucket #${winningBucket}`);
      console.log(`  noWinner:   ${noWinner}`);
    }
    console.log();
  }

  console.log(`合計：OPEN=${counts[0]}  LOCKED=${counts[1]}  SETTLED=${counts[2]}`);
}

main().catch((err) => {
  console.error("查詢失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
