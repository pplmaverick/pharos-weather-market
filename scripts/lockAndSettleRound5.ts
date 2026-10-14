/**
 * Round 5 市場結算：lockMarket() → AdminOracle.submitResult()
 * 城市：Berlin(17) Mexico City(18)
 * 溫度：2026-09-27 10:00 UTC, Open-Meteo Archive API, 整數攝氏度，無縮放
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";
import dotenv from "dotenv";
import { waitReceipt, pause, withRetry } from "./lib/tx.js";

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
const ADMIN_ORACLE   = "0xbdc53e50b1167ce1199bfad54a034f7ab1741051" as Hex;

const TARGET_DAY = "2026-09-27";
const TARGET_HOUR = "10:00";
const SEND = process.env.SEND === "1";

const MARKETS: { id: number; city: string; lat: number; lon: number; temp: bigint }[] = [
  { id: 17, city: "Berlin",      lat: 52.52,   lon: 13.405,   temp: 0n },
  { id: 18, city: "Mexico City", lat: 19.4326, lon: -99.1332, temp: 0n },
];

async function fetchTemp(lat: number, lon: number): Promise<{ raw: number; rounded: bigint }> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${TARGET_DAY}&end_date=${TARGET_DAY}&hourly=temperature_2m&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const d = (await res.json()) as { hourly: { time: string[]; temperature_2m: number[] } };
  const i = d.hourly.time.indexOf(`${TARGET_DAY}T${TARGET_HOUR}`);
  if (i < 0 || d.hourly.temperature_2m[i] == null) throw new Error("hour not found");
  const raw = d.hourly.temperature_2m[i];
  return { raw, rounded: BigInt(Math.round(raw)) };
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(`0x${pk}` as Hex);

  const publicClient = createPublicClient({ chain: pharosMainnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: pharosMainnet, transport: http() });

  const wmArtifact     = await hre.artifacts.readArtifact("WeatherMarket");
  const oracleArtifact = await hre.artifacts.readArtifact("AdminOracle");

  console.log("=== Round 5 lockMarket() + submitResult() ===\n");
  console.log(SEND ? "模式: SEND\n" : "模式: DRY RUN（SEND=1 才會送 tx）\n");

  const wmAbi = wmArtifact.abi;
  for (const m of MARKETS) {
    const { raw, rounded } = await fetchTemp(m.lat, m.lon);
    m.temp = rounded;
    const mk = (await publicClient.readContract({
      address: WEATHER_MARKET, abi: wmAbi, functionName: "getMarket", args: [BigInt(m.id)],
    })) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];
    const buckets = mk[7];
    let win = buckets.length;
    for (let i = 0; i < buckets.length; i++) { if (m.temp <= buckets[i]) { win = i; break; } }
    console.log(`#${m.id} ${m.city} (chain city="${mk[0]}", status=${mk[3]}, pool=${mk[4]})`);
    console.log(`   Open-Meteo ${TARGET_DAY} ${TARGET_HOUR} UTC raw=${raw} -> finalTemp=${m.temp}`);
    console.log(`   buckets=[${buckets.join(", ")}] -> winningBucket=${win}\n`);
    if (mk[0] !== m.city) throw new Error(`city mismatch for #${m.id}`);
    if (mk[3] !== 0) throw new Error(`#${m.id} not OPEN`);
  }
  if (!SEND) return;

  console.log(`執行帳戶: ${account.address}\n`);

  console.log("【第一輪】lockMarket()\n");
  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    if (i > 0) await pause();
    console.log(`▶ Market #${m.id} (${m.city}) lockMarket()...`);
    try {
      const hash = await walletClient.writeContract({
        address: WEATHER_MARKET,
        abi: wmArtifact.abi,
        functionName: "lockMarket",
        args: [BigInt(m.id)],
        gas: 100_000n,
      });
      console.log(`  tx: ${hash}`);
      const receipt = await waitReceipt(publicClient, hash);
      console.log(`  ✓ status: ${receipt.status}  block: ${receipt.blockNumber}\n`);
      if (receipt.status !== "success") {
        throw new Error(`lockMarket reverted for market ${m.id}`);
      }
    } catch (e: unknown) {
      const err = e as Error & { shortMessage?: string; details?: string };
      console.error(`  ✗ 失敗: ${err.shortMessage ?? err.message}`);
      if (err.details) console.error(`    Details: ${err.details}`);
      throw e;
    }
  }

  console.log("【第二輪】AdminOracle.submitResult()\n");
  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    if (i > 0) await pause();
    console.log(`▶ Market #${m.id} (${m.city}) submitResult(temp=${m.temp})...`);
    try {
      const hash = await walletClient.writeContract({
        address: ADMIN_ORACLE,
        abi: oracleArtifact.abi,
        functionName: "submitResult",
        args: [m.city, m.temp, BigInt(m.id)],
        gas: 150_000n,
      });
      console.log(`  tx: ${hash}`);
      const receipt = await waitReceipt(publicClient, hash);
      console.log(`  ✓ status: ${receipt.status}  block: ${receipt.blockNumber}\n`);
      if (receipt.status !== "success") {
        throw new Error(`submitResult reverted for market ${m.id}`);
      }
    } catch (e: unknown) {
      const err = e as Error & { shortMessage?: string; details?: string };
      console.error(`  ✗ 失敗: ${err.shortMessage ?? err.message}`);
      if (err.details) console.error(`    Details: ${err.details}`);
      throw e;
    }
  }

  console.log("【最終確認】getMarket() 狀態\n");
  const STATUS_LABEL = ["OPEN", "LOCKED", "SETTLED"];
  for (const m of MARKETS) {
    const result = await withRetry(() => publicClient.readContract({
      address: WEATHER_MARKET,
      abi: wmArtifact.abi,
      functionName: "getMarket",
      args: [BigInt(m.id)],
    })) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];

    const [city,,,status,,finalTemp,winningBucket,,noWinner] = result;
    console.log(`Market #${m.id} ${city}: ${STATUS_LABEL[status]}  finalTemp=${finalTemp}°C  winningBucket=${winningBucket}  noWinner=${noWinner}`);
  }
}

main().catch((err) => {
  console.error("執行失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
