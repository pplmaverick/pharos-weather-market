/**
 * Round 5 市場建立：Berlin(17) Mexico City(18)
 * 2 週到期：lockTime = now + 14 days, targetDate = lockTime + 6h
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

const LOCK_TIME   = 1790482221n;
const TARGET_DATE = 1790503821n;

const CITIES = [
  { name: "Berlin",       buckets: [10n, 14n, 18n, 22n] },
  { name: "Mexico City",  buckets: [14n, 18n, 22n, 26n] },
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
    const hash = await walletClient.writeContract({
      address: weatherMarketAddr,
      abi: artifact.abi,
      functionName: "createMarket",
      args: [name, TARGET_DATE, buckets, LOCK_TIME],
      ...GAS_OPTS,
    });
    console.log(`    tx hash : ${hash}`);
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
        // skip unrelated logs
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
  console.log("建立完成：");
  for (const r of results) {
    console.log(`  ${r.city.padEnd(14)}: marketId = ${r.marketId}  (tx: ${r.txHash})`);
  }
}

main().catch((err) => {
  console.error("Error:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
