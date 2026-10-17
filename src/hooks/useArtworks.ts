/**
 * useArtworks: reads all artworks from ArtVendor onchain.
 */
import { useReadContract, useReadContracts } from 'wagmi'
import { ART_VENDOR_ADDRESS, ART_VENDOR_ABI, ART_VENDOR_CHAIN_ID } from '@/contracts/ArtVendor'

export interface ArtworkData {
  id: bigint
  artist: string
  price: bigint
  editions: number
  sold: number
  seedInput: string
  seedHash: string
  seriesName: string
  recipients: readonly string[]
  sharesBps: readonly number[]
}

export function useArtworkCount() {
  return useReadContract({
    address: ART_VENDOR_ADDRESS,
    abi: ART_VENDOR_ABI,
    functionName: 'artworkCount',
    chainId: ART_VENDOR_CHAIN_ID,
  })
}

export function useArtworks() {
  const { data: count } = useArtworkCount()
  const n = count ? Number(count) : 0

  const contracts = Array.from({ length: n }, (_, i) => ({
    address: ART_VENDOR_ADDRESS as `0x${string}`,
    abi: ART_VENDOR_ABI,
    functionName: 'artworks' as const,
    args: [BigInt(i)] as const,
    chainId: ART_VENDOR_CHAIN_ID,
  }))

  const results = useReadContracts({ contracts, query: { enabled: n > 0 } })

  const artworks: ArtworkData[] = (results.data ?? [])
    .map((r, i) => {
      if (r.status !== 'success' || !r.result) return null
      const art = r.result as {
        artist: string; price: bigint; editions: number; sold: number
        seedInput: string; seedHash: string; seriesName: string
        recipients: readonly string[]; sharesBps: readonly number[]
      }
      return {
        id: BigInt(i),
        artist: art.artist,
        price: art.price,
        editions: Number(art.editions),
        sold: Number(art.sold),
        seedInput: art.seedInput,
        seedHash: art.seedHash,
        seriesName: art.seriesName,
        recipients: art.recipients,
        sharesBps: art.sharesBps,
      } satisfies ArtworkData
    })
    .filter((a): a is ArtworkData => a !== null)

  return { artworks, isLoading: results.isPending, refetch: results.refetch }
}

export function useContractOwner() {
  return useReadContract({
    address: ART_VENDOR_ADDRESS,
    abi: ART_VENDOR_ABI,
    functionName: 'owner',
    chainId: ART_VENDOR_CHAIN_ID,
  })
}
