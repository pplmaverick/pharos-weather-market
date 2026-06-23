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

// Market IDs on Pharos Mainnet — Round 2 deployed 2026-06-23 via createRound2Markets.ts
export const CITIES = {
  Taipei:  { marketId: 4n, slug: 'taipei' },
  Tokyo:   { marketId: 5n, slug: 'tokyo' },
  Seoul:   { marketId: 7n, slug: 'seoul' },
  Bangkok: { marketId: 8n, slug: 'bangkok' },
} as const

export type CityName = keyof typeof CITIES

export const CITY_NAMES = Object.keys(CITIES) as CityName[]

export function getBucketLabel(buckets: readonly bigint[], index: number): string {
  const lo = index === 0 ? null : Number(buckets[index - 1])
  const hi = index >= buckets.length ? null : Number(buckets[index])
  if (lo === null && hi !== null) return `< ${hi}°C`
  if (lo !== null && hi === null) return `> ${lo}°C`
  if (lo !== null && hi !== null) return `${lo}–${hi}°C`
  return '–'
}

export const BUCKET_COUNT = 5
