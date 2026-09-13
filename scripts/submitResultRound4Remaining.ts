/**
 * Round 4 結算收尾：markets 15 (Cairo) 16 (Sao Paulo) 尚未 submitResult
 * (markets 13, 14 已於前次執行成功結算)
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
  rpcUrls: { default: { http: ["https://rpc.pharos.xyz"] } },
});

const ADMIN_ORACLE = "0xbdc53e50b1167ce1199bfad54a034f7ab1741051" as Hex;
const WEATHER_MARKET = "0xcac5b9d2817325e78090e3ce4b9c299c819cf953" as Hex;

const MARKETS = [
  { id: 15, city: "Cairo",     temp: 26n },
  { id: 16, city: "Sao Paulo", temp: 12n },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set");
  const account = privateKeyToAccount(`0x${pk}` as Hex);

  const publicClient = createPublicClient({ chain: pharosMainnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: pharosMainnet, transport: http() });
  const oracleArtifact = await hre.artifacts.readArtifact("AdminOracle");
  const wmArtifact = await hre.artifacts.readArtifact("WeatherMarket");

  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    if (i > 0) await sleep(10000);
    console.log(`▶ Market #${m.id} (${m.city}) submitResult(temp=${m.temp})...`);
    const hash = await walletClient.writeContract({
      address: ADMIN_ORACLE,
      abi: oracleArtifact.abi,
      functionName: "submitResult",
      args: [m.city, m.temp, BigInt(m.id)],
      gas: 150_000n,
    });
    console.log(`  tx: ${hash}`);
    await sleep(3000);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ status: ${receipt.status}  block: ${receipt.blockNumber}\n`);
  }

  console.log("【最終確認】\n");
  const STATUS_LABEL = ["OPEN", "LOCKED", "SETTLED"];
  for (const id of [13, 14, 15, 16]) {
    const result = await publicClient.readContract({
      address: WEATHER_MARKET,
      abi: wmArtifact.abi,
      functionName: "getMarket",
      args: [BigInt(id)],
    }) as [string, bigint, bigint, number, bigint, bigint, number, bigint[], boolean];
    const [city,,,status,,finalTemp] = result;
    console.log(`Market #${id} ${city}: ${STATUS_LABEL[status]}  finalTemp=${finalTemp}°C`);
  }
}

main().catch((err) => {
  console.error("執行失敗:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
