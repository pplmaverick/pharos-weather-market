/**
 * Arc Testnet → Pharos Atlantic Testnet USDC Bridge (CCTPv2)
 *
 * 使用 Circle @circle-fin/app-kit SDK 執行跨鏈 USDC 轉帳
 *
 * 路由:
 *   Arc Testnet (chain ID 5042002, CCTP domain 26)
 *     → Pharos Atlantic Testnet (chain ID 688689, CCTP domain 31)
 *
 * SDK 正確對應:
 *   - 套件: @circle-fin/adapter-viem-v2（不是 app-kit/viem）
 *   - 函數: createViemAdapterFromPrivateKey（不是 createViemAdapter）
 *   - Pharos Atlantic 的 chain ID: "Pharos_Testnet"（SDK enum 值）
 */

import * as dotenv from "dotenv";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

dotenv.config();

// ─── 常數設定 ────────────────────────────────────────────────────────────────

const ARC_USDC = "0x3600000000000000000000000000000000000000";
const PHAROS_USDC = "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b";
const BRIDGE_AMOUNT = "10.00"; // 10 USDC

// ─── 主程式 ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. 讀取私鑰
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ .env 未設定 PRIVATE_KEY");
  }

  console.log("=".repeat(60));
  console.log("  Arc Testnet → Pharos Atlantic Testnet USDC Bridge");
  console.log("=".repeat(60));
  console.log(`  金額       : ${BRIDGE_AMOUNT} USDC`);
  console.log(`  Arc USDC   : ${ARC_USDC}`);
  console.log(`  Pharos USDC: ${PHAROS_USDC}`);
  console.log("=".repeat(60));

  // 2. 建立 viem adapter（單一 adapter 可跨鏈使用）
  console.log("\n[1/3] 建立 viem adapter...");
  const adapter = createViemAdapterFromPrivateKey({
    privateKey: privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
  });
  console.log("      ✅ adapter 建立完成");

  // 3. 初始化 AppKit
  console.log("\n[2/3] 初始化 AppKit...");
  const kit = new AppKit();
  console.log("      ✅ AppKit 初始化完成");

  // 4. 執行跨鏈 bridge
  console.log("\n[3/3] 執行 bridge（Arc_Testnet → Pharos_Testnet）...");
  console.log("      這可能需要 1~2 分鐘，請耐心等候...\n");

  const result = await kit.bridge({
    from: {
      adapter: adapter,
      chain: "Arc_Testnet",   // Arc Testnet (domain 26)
    },
    to: {
      adapter: adapter,
      chain: "Pharos_Testnet", // Pharos Atlantic Testnet (domain 31)
    },
    amount: BRIDGE_AMOUNT,
    token: "USDC",
  });

  // 5. 輸出結果
  console.log("=".repeat(60));
  console.log("  Bridge 結果");
  console.log("=".repeat(60));
  console.log(`  狀態: ${result.state.toUpperCase()}`);
  console.log(`  步驟數: ${result.steps.length}`);

  result.steps.forEach((step, i) => {
    console.log(`\n  Step ${i + 1}: ${step.name ?? "unknown"}`);
    console.log(`    狀態     : ${step.state}`);
    if (step.txHash) {
      console.log(`    TX Hash  : ${step.txHash}`);
    }
    if (step.explorerUrl) {
      console.log(`    Explorer : ${step.explorerUrl}`);
    }
    if (step.errorMessage) {
      console.log(`    錯誤訊息 : ${step.errorMessage}`);
    }
    if (step.errorCategory) {
      console.log(`    錯誤分類 : ${step.errorCategory}`);
    }
  });

  console.log("\n" + "=".repeat(60));

  if (result.state === "success") {
    // 取得最後一個有 txHash 的 step（通常是 mint step）
    const lastTx = [...result.steps]
      .reverse()
      .find((s) => s.txHash !== undefined);

    const burnStep = result.steps.find((s) => s.name === "burn" || s.name === "transfer");
    const mintStep = result.steps.find((s) => s.name === "mint" || s.name === "receive");

    console.log("  🎉 Bridge 成功！");
    if (burnStep?.txHash) {
      console.log(`  🔥 Burn TX (Arc)   : ${burnStep.txHash}`);
      console.log(`     Explorer: https://testnet.arcscan.app/tx/${burnStep.txHash}`);
    }
    if (mintStep?.txHash) {
      console.log(`  ✨ Mint TX (Pharos) : ${mintStep.txHash}`);
      console.log(`     Explorer: https://atlantic.pharosscan.xyz/tx/${mintStep.txHash}`);
    }
    if (!burnStep?.txHash && !mintStep?.txHash && lastTx?.txHash) {
      console.log(`  最後交易 TX Hash: ${lastTx.txHash}`);
    }
  } else if (result.state === "error") {
    const failedStep = result.steps.find((s) => s.state === "error");
    console.log("  ❌ Bridge 失敗");
    if (failedStep) {
      console.log(`  失敗步驟: ${failedStep.name}`);
      console.log(`  錯誤: ${failedStep.errorMessage}`);
    }
    process.exit(1);
  } else {
    console.log("  ⏳ Bridge 仍在處理中（pending）");
    console.log("  請稍後至 explorer 確認交易狀態");
  }

  console.log("=".repeat(60));
}

// ─── 執行 ─────────────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error("\n❌ 發生錯誤:");
  if (err instanceof Error) {
    console.error(`  訊息: ${err.message}`);
    if (err.stack) {
      console.error(`  Stack: ${err.stack}`);
    }
  } else {
    console.error(err);
  }
  process.exit(1);
});
