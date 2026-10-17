/**
 * usePayoutLogs: reads PayoutSent events from ArtVendor and aggregates per recipient.
 *
 * Arc RPCs limit eth_getLogs ranges and rate limit bursts. Strategy:
 * - Scan in 10,000 block chunks from DEPLOY_BLOCK to head (about 7 calls today).
 * - Cache the aggregate plus the last scanned block in localStorage, so later
 *   visits only scan what is new.
 * - Fallback transports (mainnet, Blockdaemon, QuickNode) in case one endpoint fails.
 * - Retries with backoff per chunk; if a chunk still fails we stop, keep the cached
 *   totals and flag the data as partial instead of hammering the RPC.
 */
import { useEffect, useState } from 'react'
import { createPublicClient, fallback, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { ART_VENDOR_ADDRESS, USDC_DECIMALS, DEPLOY_BLOCK } from '@/contracts/ArtVendor'

export interface RecipientTotals {
  address: string
  total: bigint
  lastAmount: bigint
  count: number
}

const client = createPublicClient({
  chain: arc,
  transport: fallback([
    http('https://rpc.mainnet.arc.io'),
    http('https://rpc.blockdaemon.mainnet.arc.io'),
    http('https://rpc.quicknode.mainnet.arc.io'),
  ]),
})

const PAYOUT_EVENT = parseAbiItem(
  'event PayoutSent(uint256 indexed artworkId, address indexed recipient, uint256 amount)'
)

const CHUNK = 10000n
const MAX_CHUNKS = 30
// Cache is scoped to the contract address: a new deployment must not reuse old payouts.
const CACHE_KEY = 'tallfenn_splits_v3_' + ART_VENDOR_ADDRESS.toLowerCase()

interface CachedRow {
  address: string
  total: string
  lastAmount: string
  count: number
}
interface Cache {
  lastBlock: string
  rows: CachedRow[]
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cache
    if (typeof parsed.lastBlock !== 'string' || !Array.isArray(parsed.rows)) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* storage unavailable: ignore */
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

export function usePayoutLogs() {
  const [rows, setRows] = useState<RecipientTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setPartial(false)
      setError(null)
      setProgress(null)

      try {
        const head = await client.getBlockNumber()
        const cache = readCache()

        const map = new Map<string, RecipientTotals>()
        let lastBlock = DEPLOY_BLOCK - 1n

        if (cache) {
          for (const row of cache.rows) {
            map.set(row.address.toLowerCase(), {
              address: row.address,
              total: BigInt(row.total),
              lastAmount: BigInt(row.lastAmount),
              count: row.count,
            })
          }
          lastBlock = BigInt(cache.lastBlock)
        }

        if (head <= lastBlock) {
          setRows([...map.values()].sort((a, b) => (a.total > b.total ? -1 : 1)))
          return
        }

        const start = lastBlock + 1n
        const totalBlocks = head - start + 1n
        const totalChunks = Number(totalBlocks / CHUNK) + (totalBlocks % CHUNK > 0n ? 1 : 0)
        const cappedChunks = Math.min(totalChunks, MAX_CHUNKS)
        let hadPartial = totalChunks > MAX_CHUNKS
        let scannedTo = lastBlock

        for (let i = 0; i < cappedChunks; i++) {
          if (cancelled) return

          const fromBlock = start + BigInt(i) * CHUNK
          const rawTo = fromBlock + CHUNK - 1n
          const toBlock = rawTo > head ? head : rawTo

          setProgress({ done: i, total: cappedChunks })

          try {
            const logs = await withRetry(() =>
              client.getLogs({
                address: ART_VENDOR_ADDRESS,
                event: PAYOUT_EVENT,
                fromBlock,
                toBlock,
              })
            )

            for (const log of logs) {
              const recipient = (log.args.recipient as string).toLowerCase()
              const amount = log.args.amount as bigint
              const existing = map.get(recipient)
              if (existing) {
                existing.total += amount
                existing.lastAmount = amount
                existing.count++
              } else {
                map.set(recipient, {
                  address: log.args.recipient as string,
                  total: amount,
                  lastAmount: amount,
                  count: 1,
                })
              }
            }
            scannedTo = toBlock
          } catch {
            hadPartial = true
            break
          }

          await new Promise((r) => setTimeout(r, 250))
        }

        if (cancelled) return

        const sorted = [...map.values()].sort((a, b) => (a.total > b.total ? -1 : 1))
        setPartial(hadPartial)
        setRows(sorted)
        setProgress({ done: cappedChunks, total: cappedChunks })

        if (scannedTo > lastBlock) {
          writeCache({
            lastBlock: scannedTo.toString(),
            rows: sorted.map((row) => ({
              address: row.address,
              total: row.total.toString(),
              lastAmount: row.lastAmount.toString(),
              count: row.count,
            })),
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error loading logs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function fmt(raw: bigint): string {
    const n = Number(raw) / 10 ** USDC_DECIMALS
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }

  return { rows, loading, partial, error, progress, fmt }
}
