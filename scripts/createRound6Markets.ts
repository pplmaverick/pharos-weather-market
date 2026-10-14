/**
 * Round 6 市場建立：Los Angeles(19) Istanbul(20)
 * 2 週到期：lockTime = now + 14 days, targetDate = lockTime + 6h（與 R5 偏移一致）
 * bucket：整數攝氏、無 x10 編碼，間隔 4°C，中心 = Open-Meteo 最近 7 天日均溫（四捨五入）
 *
 * 預設 dry run；SEND=1 才送 tx。
 * 為了讓 dry run 與實送參數一致，可用 LOCK_TIME=<unix> 固定 lockTime（dry run 會印出）。
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseGwei,
  defineChain,
  decodeEventLog,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { waitReceipt, pause, withRetry } from "./lib/tx.js";

dotenv.config();

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Pacific Ocean Mainnet",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.pharos.xyz"] } },
});

const GAS_OPTS = {
  gas: 5_000_000n,
  gasPrice: parseGwei("10"),
} as const;

const SEND = process.env.SEND === "1";
const TWO_WEEKS = 14 * 24 * 3600;
const TARGET_OFFSET = 6 * 3600; // R5: targetDate = lockTime + 6h
const STEP = 4; // bucket 間隔 °C

const CITIES = [
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Istanbul",    lat: 41.0082, lon: 28.9784 },
];

/** 最近 7 天（不含今天）日均溫 */
async function recentMean(lat: number, lon: number): Promise<number> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_mean&past_days=7&forecast_days=1&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const d = (await res.json()) as { daily: { time: string[]; temperature_2m_mean: (number | null)[] } };
  const today = new Date().toISOString().slice(0, 10);
  const vals = d.daily.time
    .map((t, i) => ({ t, v: d.daily.temperature_2m_mean[i] }))
    .filter((x) => x.t < today && x.v != null)
    .slice(-7)
    .map((x) => x.v as number);
  if (vals.length < 7) throw new Error(`only ${vals.length} days of data`);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const deployments = JSON.parse(
    readFileSync(resolve(__dirname, "../deployments/pharos-mainnet.json"), "utf-8"),
  );
  const weatherMarketAddr = deployments.contracts.WeatherMarket as Hex;
  const artifact = await hre.artifacts.readArtifact("WeatherMarket");

  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}` as Hex);
  const walletClient = createWalletClient({ account, chain: pharosMainnet, transport: http() });
  const publicClient = createPublicClient({ chain: pharosMainnet, transport: http() });

  const lockTime = process.env.LOCK_TIME
    ? BigInt(process.env.LOCK_TIME)
    : BigInt(Math.floor(Date.now() / 1000) + TWO_WEEKS);
  const targetDate = lockTime + BigInt(TARGET_OFFSET);

  const nextId = (await withRetry(() =>
    publicClient.readContract({ address: weatherMarketAddr, abi: artifact.abi, functionName: "nextMarketId" }),
  )) as bigint;

  console.log(SEND ? "模式: SEND" : "模式: DRY RUN（SEND=1 才會送 tx）");
  console.log("WeatherMarket :", weatherMarketAddr);
  console.log("Deployer      :", account.address);
  console.log("nextMarketId  :", nextId.toString(), `(預期新 id: ${nextId}, ${nextId + 1n})`);
  console.log("lockTime      :", new Date(Number(lockTime) * 1000).toISOString(), `(${lockTime})`);
  console.log("targetDate    :", new Date(Number(targetDate) * 1000).toISOString(), `(${targetDate})`);
  console.log("─".repeat(60));

  const plan: { name: string; buckets: bigint[] }[] = [];
  for (const c of CITIES) {
    const mean = await recentMean(c.lat, c.lon);
    const center = Math.round(mean);
    const buckets = [-1.5, -0.5, 0.5, 1.5].map((k) => BigInt(center + k * STEP));
    plan.push({ name: c.name, buckets });
    console.log(`${c.name}  (lat=${c.lat}, lon=${c.lon})`);
    console.log(`   7 天均溫 ${mean.toFixed(2)}°C → 中心 ${center}°C`);
    console.log(`   buckets = [${buckets.join(", ")}]  → 5 區間: ≤${buckets[0]}, (${buckets[0]},${buckets[1]}], (${buckets[1]},${buckets[2]}], (${buckets[2]},${buckets[3]}], >${buckets[3]}`);
  }

  if (!SEND) return;

  console.log("\n" + "─".repeat(60));
  const results: { city: string; marketId: string; txHash: string }[] = [];
  for (let i = 0; i < plan.length; i++) {
    const { name, buckets } = plan[i];
    if (i > 0) await pause();
    console.log(`\n>>> 建立 ${name} 市場`);
    const hash = await walletClient.writeContract({
      address: weatherMarketAddr,
      abi: artifact.abi,
      functionName: "createMarket",
      args: [name, targetDate, buckets, lockTime],
      ...GAS_OPTS,
    });
    console.log(`    tx hash : ${hash}`);
    const receipt = await waitReceipt(publicClient, hash);
    if (receipt.status !== "success") throw new Error(`createMarket reverted: ${hash}`);

    let marketId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: artifact.abi, data: log.data, topics: log.topics, eventName: "MarketCreated" });
        marketId = (decoded.args as { marketId: bigint }).marketId;
        break;
      } catch {
        // skip unrelated logs
      }
    }
    if (marketId === null) throw new Error(`無法從 logs 解析 marketId (tx ${hash})`);
    console.log(`    ✓ status=success  marketId: ${marketId}`);
    results.push({ city: name, marketId: marketId.toString(), txHash: hash });
  }

  console.log("\n" + "═".repeat(60));
  console.log("建立完成：");
  for (const r of results) console.log(`  ${r.city.padEnd(14)}: marketId = ${r.marketId}  (tx: ${r.txHash})`);
}

main().catch((err) => {
  console.error("Error:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
