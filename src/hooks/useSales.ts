/**
 * useSales: reads ArtworkSold events (receipts minted) from ArtVendor.
 *
 * Same transport strategy as usePayoutLogs: 10,000 block chunks from the deploy
 * block, fallback RPCs, per-chunk retries, and a localStorage cache so later
 * visits only scan what is new.
 */
import { useEffect, useState } from 'react'
import { createPublicClient, fallback, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { ART_VENDOR_ADDRESS, DEPLOY_BLOCK } from '@/contracts/ArtVendor'

export interface Sale {
  artworkId: number
  buyer: string
  edition: number
  price: bigint
  tokenId: bigint
  txHash: string
  block: bigint
}

const client = createPublicClient({
  chain: arc,
  transport: fallback([
    http('https://rpc.mainnet.arc.io'),
    http('https://rpc.blockdaemon.mainnet.arc.io'),
    http('https://rpc.quicknode.mainnet.arc.io'),
  ]),
})

const SOLD_EVENT = parseAbiItem(
  'event ArtworkSold(uint256 indexed artworkId, address indexed buyer, uint32 editionNumber, uint256 price, uint256 tokenId)'
)

const CHUNK = 10000n
const MAX_CHUNKS = 30
const CACHE_KEY = 'tallfenn_sales_v1'

interface CachedSale {
  artworkId: number
  buyer: string
  edition: number
  price: string
  tokenId: string
  txHash: string
  block: string
}
interface Cache {
  lastBlock: string
  sales: CachedSale[]
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cache
    if (typeof parsed.lastBlock !== 'string' || !Array.isArray(parsed.sales)) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= attempts - 1) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const head = await client.getBlockNumber()
        const cache = readCache()

        const collected: Sale[] = cache
          ? cache.sales.map((s) => ({
              artworkId: s.artworkId,
              buyer: s.buyer,
              edition: s.edition,
              price: BigInt(s.price),
              tokenId: BigInt(s.tokenId),
              txHash: s.txHash,
              block: BigInt(s.block),
            }))
          : []

        let lastBlock = cache ? BigInt(cache.lastBlock) : DEPLOY_BLOCK - 1n
        if (head > lastBlock) {
          const start = lastBlock + 1n
          const totalBlocks = head - start + 1n
          const totalChunks = Number(totalBlocks / CHUNK) + (totalBlocks % CHUNK > 0n ? 1 : 0)
          const cappedChunks = Math.min(totalChunks, MAX_CHUNKS)
          let scannedTo = lastBlock

          for (let i = 0; i < cappedChunks; i++) {
            if (cancelled) return
            const fromBlock = start + BigInt(i) * CHUNK
            const rawTo = fromBlock + CHUNK - 1n
            const toBlock = rawTo > head ? head : rawTo
            try {
              const logs = await withRetry(() =>
                client.getLogs({ address: ART_VENDOR_ADDRESS, event: SOLD_EVENT, fromBlock, toBlock })
              )
              for (const log of logs) {
                collected.push({
                  artworkId: Number(log.args.artworkId),
                  buyer: String(log.args.buyer),
                  edition: Number(log.args.editionNumber),
                  price: log.args.price as bigint,
                  tokenId: log.args.tokenId as bigint,
                  txHash: log.transactionHash,
                  block: log.blockNumber ?? 0n,
                })
              }
              scannedTo = toBlock
            } catch {
              break
            }
            await new Promise((r) => setTimeout(r, 250))
          }

          if (scannedTo > lastBlock) {
            writeCache({
              lastBlock: scannedTo.toString(),
              sales: collected.map((s) => ({
                artworkId: s.artworkId,
                buyer: s.buyer,
                edition: s.edition,
                price: s.price.toString(),
                tokenId: s.tokenId.toString(),
                txHash: s.txHash,
                block: s.block.toString(),
              })),
            })
          }
        }

        if (!cancelled) {
          setSales(collected.sort((a, b) => (a.block > b.block ? -1 : 1)))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return { sales, loading }
}
