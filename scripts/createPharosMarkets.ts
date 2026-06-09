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

const now = Math.floor(Date.now() / 1000);
const TARGET_DATE = BigInt(now + 24 * 3_600); // 現在 + 24h
const LOCK_TIME   = BigInt(now + 18 * 3_600); // 現在 + 18h

const CITIES = [
  { name: "Hong Kong", buckets: [25n, 28n, 31n, 34n] },
  { name: "Shanghai",  buckets: [20n, 24n, 28n, 32n] },
  { name: "Chicago",   buckets: [15n, 20n, 25n, 30n] },
  { name: "London",    buckets: [12n, 16n, 20n, 24n] },
];

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

  console.log("WeatherMarket :", weatherMarketAddr);
  console.log("Deployer      :", account.address);
  console.log("targetDate    :", new Date(Number(TARGET_DATE) * 1000).toISOString());
  console.log("lockTime      :", new Date(Number(LOCK_TIME) * 1000).toISOString());
  console.log("─".repeat(60));

  const results: { city: string; marketId: string; txHash: string }[] = [];

  for (const { name, buckets } of CITIES) {
    console.log(`\n>>> 建立 ${name} 市場`);
    console.log(`    buckets: [${buckets.join(",")}] → ${buckets.length + 1} 個區間`);

    const hash = await walletClient.writeContract({
      address: weatherMarketAddr,
      abi: artifact.abi,
      functionName: "createMarket",
      args: [name, TARGET_DATE, buckets, LOCK_TIME],
      ...GAS_OPTS,
    });

    console.log(`    tx hash : ${hash}`);
    console.log(`    等待確認...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      console.error(`    ❌ 交易 reverted！tx: ${hash}`);
      continue;
    }

    let marketId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: artifact.abi,
          data: log.data,
          topics: log.topics,
          eventName: "MarketCreated",
        });
        marketId = (decoded.args as { marketId: bigint }).marketId;
        break;
      } catch {
        // 跳過不相關的 log
      }
    }

    if (marketId === null) {
      console.error(`    ❌ 無法從 logs 解析 marketId`);
      continue;
    }

    console.log(`    ✓ marketId: ${marketId}`);
    results.push({ city: name, marketId: marketId.toString(), txHash: hash });
  }

  console.log("\n" + "═".repeat(60));
  console.log("全部完成！請更新前端 src/lib/wagmi.ts 的 CITIES：");
  console.log("─".repeat(60));
  for (const r of results) {
    console.log(`  ${r.city.padEnd(12)}: marketId = ${r.marketId}  (tx: ${r.txHash.slice(0, 20)}...)`);
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
