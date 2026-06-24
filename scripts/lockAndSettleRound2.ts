/**
 * Round 2 市場結算：lockMarket() → AdminOracle.submitResult()
 * 城市：Taipei(4) Tokyo(5) Seoul(7) Bangkok(8)
 * 溫度：2026-06-24 查詢，整數攝氏度，無縮放
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

const MARKETS = [
  { id: 4, city: "Taipei",  temp: 29n },
  { id: 5, city: "Tokyo",   temp: 23n },
  { id: 7, city: "Seoul",   temp: 24n },
  { id: 8, city: "Bangkok", temp: 32n },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(`0x${pk}` as Hex);

  const publicClient = createPublicClient({ chain: pharosMainnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: pharosMainnet, transport: http() });

  const wmArtifact     = await hre.artifacts.readArtifact("WeatherMarket");
  const oracleArtifact = await hre.artifacts.readArtifact("AdminOracle");

  console.log("=== Round 2 lockMarket() + submitResult() ===\n");
  console.log(`執行帳戶: ${account.address}\n`);

  // ── 第一輪：lockMarket ──────────────────────────────────────
  console.log("【第一輪】lockMarket()\n");
  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    if (i > 0) await sleep(5000);
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ status: ${receipt.status}  block: ${receipt.blockNumber}\n`);
    } catch (e: unknown) {
      const err = e as Error & { shortMessage?: string; details?: string };
      console.error(`  ✗ 失敗: ${err.shortMessage ?? err.message}`);
      if (err.details) console.error(`    Details: ${err.details}`);
      console.log();
    }
  }

  // ── 第二輪：submitResult ────────────────────────────────────
  console.log("【第二輪】AdminOracle.submitResult()\n");
  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    if (i > 0) await sleep(5000);
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ status: ${receipt.status}  block: ${receipt.blockNumber}\n`);
    } catch (e: unknown) {
      const err = e as Error & { shortMessage?: string; details?: string };
      console.error(`  ✗ 失敗: ${err.shortMessage ?? err.message}`);
      if (err.details) console.error(`    Details: ${err.details}`);
      console.log();
    }
  }

  // ── 最終狀態確認 ─────────────────────────────────────────────
  console.log("【最終確認】getMarket() 狀態\n");
  const STATUS_LABEL = ["OPEN", "LOCKED", "SETTLED"];
  for (const m of MARKETS) {
    const result = await publicClient.readContract({
      address: WEATHER_MARKET,
      abi: wmArtifact.abi,
      functionName: "getMarket",
      args: [BigInt(m.id)],
    }) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];

    const [city,,,status,,finalTemp,winningBucket,,noWinner] = result;
    console.log(`Market #${m.id} ${city}: ${STATUS_LABEL[status]}  finalTemp=${finalTemp}°C  winningBucket=${winningBucket}  noWinner=${noWinner}`);
  }
}

main().catch((err) => {
  console.error("執行失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
