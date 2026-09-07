/**
 * 對四個市場依序執行 lockMarket() → AdminOracle.submitResult()
 * 溫度單位：整數攝氏度，無縮放
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

const WEATHER_MARKET  = "0xcac5b9d2817325e78090e3ce4b9c299c819cf953" as Hex;
const ADMIN_ORACLE    = "0xbdc53e50b1167ce1199bfad54a034f7ab1741051" as Hex;

// Round 3 (marketId 9-12): totalPool=0 for all four (no bets were ever
// placed), so this is pure state cleanup — finalTemp values below are live
// OpenWeather readings, not historical data for the original targetDate.
const MARKETS = [
  { id: 9,  city: "Singapore", temp: 33n },
  { id: 10, city: "Dubai",     temp: 37n },
  { id: 11, city: "Sydney",    temp: 19n },
  { id: 12, city: "Paris",     temp: 19n },
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(`0x${pk}` as Hex);

  const publicClient = createPublicClient({
    chain: pharosMainnet,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: pharosMainnet,
    transport: http(),
  });

  const wmArtifact     = await hre.artifacts.readArtifact("WeatherMarket");
  const oracleArtifact = await hre.artifacts.readArtifact("AdminOracle");

  console.log("=== lockMarket() + submitResult() ===\n");
  console.log(`執行帳戶: ${account.address}\n`);

  // ── 第一輪：lockMarket ──────────────────────────────────────
  console.log("【第一輪】lockMarket()\n");
  for (const m of MARKETS) {
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
  for (const m of MARKETS) {
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

    const [city,, , status,, finalTemp, winningBucket,, noWinner] = result;
    console.log(`Market #${m.id} ${city}: ${STATUS_LABEL[status]}  finalTemp=${finalTemp}°C  winningBucket=${winningBucket}  noWinner=${noWinner}`);
  }
}

main().catch((err) => {
  console.error("執行失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
