/**
 * 共用 tx 輔助：tx 間隔 + receipt 重試（RPC 限流時退避）。
 * 絕不重送 tx；限流時只重新查詢同一個 hash。
 */
import type { Hex, PublicClient } from "viem";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 兩筆 tx 之間等 2~3 秒 */
export const pause = () => sleep(2000 + Math.floor(Math.random() * 1000));

export function isRateLimited(e: unknown): boolean {
  const err = e as { message?: string; details?: string; shortMessage?: string };
  const text = `${err?.shortMessage ?? ""} ${err?.details ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return (
    text.includes("cu limit exceeded") ||
    text.includes("too fast") ||
    text.includes("rate limit") ||
    text.includes("429")
  );
}

/** 唯讀 RPC 呼叫：限流時指數退避重試 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimited(e) || i >= attempts) throw e;
      console.warn(`  ⚠ RPC 限流，${delay / 1000}s 後重試 (${i}/${attempts - 1})`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

/**
 * 等 receipt。遇到限流時先用 getTransaction 確認 tx 是否已上鏈，
 * 已上鏈就直接取 receipt；未上鏈就繼續輪詢同一個 hash，不重送。
 */
export async function waitReceipt(publicClient: PublicClient, hash: Hex, attempts = 8) {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try {
      return await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      if (!isRateLimited(e) || i >= attempts) throw e;
      console.warn(`  ⚠ RPC 限流，${delay / 1000}s 後確認 tx 狀態 (${i}/${attempts - 1})`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
      try {
        const tx = await publicClient.getTransaction({ hash });
        console.warn(`  tx 已${tx.blockNumber ? `上鏈 (block ${tx.blockNumber})` : "進 mempool"}，不重送`);
        if (tx.blockNumber) {
          return await publicClient.getTransactionReceipt({ hash });
        }
      } catch (e2) {
        if (!isRateLimited(e2)) console.warn("  getTransaction 尚查無此 tx，繼續等待（不重送）");
      }
    }
  }
}
