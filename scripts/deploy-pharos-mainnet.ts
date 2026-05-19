import {
  createWalletClient,
  createPublicClient,
  http,
  parseGwei,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import hre from "hardhat";
import dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const pharosMainnet = defineChain({
  id: 1672,
  name: "Pharos Pacific Ocean Mainnet",
  nativeCurrency: { name: "PROS", symbol: "PROS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pharos.xyz"] },
  },
});

// 主網 WeatherMarket deploy 實測需要 ~3.5M gas，AdminOracle ~655k
// gas=5M × gasPrice=10gwei = 0.05 PROS 保證金（帳戶有 9.6 PROS，充足）
const GAS_OPTS = {
  gas: 5_000_000n,
  gasPrice: parseGwei("10"),
} as const;

async function deployContract(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  contractName: string,
  args: readonly unknown[] = [],
): Promise<Hex> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await (walletClient as any).deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as Hex,
    args,
    ...GAS_OPTS,
  });
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`Deploy ${contractName} reverted! tx: ${hash}`);
  }
  const address = receipt.contractAddress!;
  console.log(`  ${contractName} deployed: ${address}`);
  return address;
}

async function sendTx(
  publicClient: ReturnType<typeof createPublicClient>,
  label: string,
  hash: Hex,
): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`${label} reverted! tx: ${hash}`);
  }
  console.log(`  ✓ ${label}: ${hash}`);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const usdcAddress = process.env.PHAROS_MAINNET_USDC_ADDRESS;

  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");
  if (!usdcAddress) throw new Error("PHAROS_MAINNET_USDC_ADDRESS not set in .env");

  const account = privateKeyToAccount(`0x${privateKey}` as Hex);
  console.log("Deploying with:", account.address);
  console.log("Network: Pharos Pacific Ocean Mainnet (Chain ID 1672)");
  console.log("USDC:", usdcAddress);

  // 確認帳戶 PROS 餘額
  const publicClient = createPublicClient({
    chain: pharosMainnet,
    transport: http(),
  });
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`PROS balance: ${Number(balance) / 1e18} PROS`);
  if (balance < parseGwei("10") * 1_000_000n * 3n) {
    console.warn("⚠ PROS 餘額可能不足以完成 3 筆交易，請確認後繼續");
  }

  const walletClient = createWalletClient({
    account,
    chain: pharosMainnet,
    transport: http(),
  });

  // 1. WeatherMarket（deployer 同時是 owner 和初始 oracle）
  console.log("\n[1/3] Deploying WeatherMarket...");
  const weatherMarketAddress = await deployContract(
    walletClient,
    publicClient,
    "WeatherMarket",
    [usdcAddress, account.address],
  );

  // 2. AdminOracle（指向 WeatherMarket）
  console.log("\n[2/3] Deploying AdminOracle...");
  const adminOracleAddress = await deployContract(
    walletClient,
    publicClient,
    "AdminOracle",
    [weatherMarketAddress],
  );

  // 3. 把 WeatherMarket 的 oracle 更新為 AdminOracle
  console.log("\n[3/3] Setting oracle on WeatherMarket...");
  const wmArtifact = await hre.artifacts.readArtifact("WeatherMarket");
  await sendTx(
    publicClient,
    "setOracle",
    await walletClient.writeContract({
      address: weatherMarketAddress as Hex,
      abi: wmArtifact.abi,
      functionName: "setOracle",
      args: [adminOracleAddress],
      ...GAS_OPTS,
    }),
  );

  // 4. 寫入 deployments/pharos-mainnet.json
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const deploymentsDir = resolve(__dirname, "../deployments");
  mkdirSync(deploymentsDir, { recursive: true });

  const deploymentData = {
    network: "Pharos Pacific Ocean Mainnet",
    chainId: 1672,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      WeatherMarket: weatherMarketAddress,
      AdminOracle: adminOracleAddress,
      USDC: usdcAddress,
    },
  };

  const outPath = resolve(deploymentsDir, "pharos-mainnet.json");
  writeFileSync(outPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n✓ Deployment complete. Addresses written to deployments/pharos-mainnet.json");
  console.log(JSON.stringify(deploymentData.contracts, null, 2));
}

main().catch((err) => {
  console.error("Deploy failed:", err.shortMessage ?? err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
