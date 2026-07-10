import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { type Chain } from 'viem'

export const pharosMainnet: Chain = {
  id: 1672,
  name: 'Pharos Pacific Ocean Mainnet',
  nativeCurrency: { name: 'PHRS', symbol: 'PHRS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.pharos.xyz'] },
  },
  blockExplorers: {
    default: { name: 'PharosScan', url: 'https://pharosscan.xyz' },
  },
}

export const wagmiConfig = createConfig({
  chains: [pharosMainnet],
  connectors: [injected()],
  transports: {
    [pharosMainnet.id]: http(
      import.meta.env.VITE_RPC_URL ?? 'https://rpc.pharos.xyz'
    ),
  },
})

// Pharos Mainnet (chainId 1672) — deployments/pharos-mainnet.json
export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS ?? '0xcac5b9d2817325e78090e3ce4b9c299c819cf953'
) as `0x${string}`

export const USDC_ADDRESS = '0xC879C018dB60520F4355C26eD1a6D572cdAC1815' as `0x${string}`

// Current round (shown in Betting page)
export const CITIES = {
  Singapore: { marketId: 9n, slug: 'singapore' },
  Dubai:     { marketId: 10n, slug: 'dubai' },
  Sydney:    { marketId: 11n, slug: 'sydney' },
  Paris:     { marketId: 12n, slug: 'paris' },
} as const

export type CityName = keyof typeof CITIES

export const CITY_NAMES = Object.keys(CITIES) as CityName[]

// All markets across all rounds (for MyBets & Market History)
export const ALL_MARKETS: Record<number, { city: string; buckets: number[]; status: string; finalTemp?: number }> = {
  0:  { city: 'Hong Kong',  buckets: [25,28,31,34], status: 'SETTLED', finalTemp: 26 },
  1:  { city: 'Shanghai',   buckets: [20,24,28,32], status: 'SETTLED', finalTemp: 28 },
  2:  { city: 'Chicago',    buckets: [15,20,25,30], status: 'SETTLED', finalTemp: 19 },
  3:  { city: 'London',     buckets: [12,16,20,24], status: 'SETTLED', finalTemp: 16 },
  4:  { city: 'Taipei',     buckets: [30,33,36,39], status: 'SETTLED', finalTemp: 29 },
  5:  { city: 'Tokyo',      buckets: [20,23,26,29], status: 'SETTLED', finalTemp: 23 },
  7:  { city: 'Seoul',      buckets: [24,27,30,33], status: 'SETTLED', finalTemp: 24 },
  8:  { city: 'Bangkok',    buckets: [29,32,35,38], status: 'SETTLED', finalTemp: 32 },
  9:  { city: 'Singapore',  buckets: [28,31,34,37], status: 'OPEN' },
  10: { city: 'Dubai',      buckets: [35,38,41,44], status: 'OPEN' },
  11: { city: 'Sydney',     buckets: [10,13,16,19], status: 'OPEN' },
  12: { city: 'Paris',      buckets: [16,19,22,25], status: 'OPEN' },
}

export function getCityByMarketId(marketId: number | bigint): string {
  return ALL_MARKETS[Number(marketId)]?.city ?? 'Unknown'
}

export function getBucketLabel(buckets: readonly bigint[], index: number): string {
  const lo = index === 0 ? null : Number(buckets[index - 1])
  const hi = index >= buckets.length ? null : Number(buckets[index])
  if (lo === null && hi !== null) return `< ${hi}°C`
  if (lo !== null && hi === null) return `> ${lo}°C`
  if (lo !== null && hi !== null) return `${lo}–${hi}°C`
  return '–'
}

export const BUCKET_COUNT = 5
