/**
 * usePayoutLogs: reads PayoutSent events from ArtVendor and aggregates per recipient.
 *
 * Arc mainnet RPC rejects eth_getLogs ranges larger than ~2000 blocks (-32012).
 * We scan in chunks of 1500 blocks from DEPLOY_BLOCK to the current head, cap
 * at MAX_CHUNKS for safety, and surface partial-data warnings instead of aborting.
 */
import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { ART_VENDOR_ADDRESS, USDC_DECIMALS, DEPLOY_BLOCK } from '@/contracts/ArtVendor'

export interface RecipientTotals {
  address: string
  total: bigint
  lastAmount: bigint
  count: number
}

const client = createPublicClient({ chain: arc, transport: http() })

const PAYOUT_EVENT = parseAbiItem(
  'event PayoutSent(uint256 indexed artworkId, address indexed recipient, uint256 amount)'
)

const CHUNK = 1500n
const MAX_CHUNKS = 200

export function usePayoutLogs() {
  const [rows, setRows] = useState<RecipientTotals[]>([])
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)   // non-fatal: some chunks failed
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
        const start = DEPLOY_BLOCK

        if (head < start) {
          // Nothing to scan yet
          setRows([])
          return
        }

        const totalBlocks = head - start + 1n
        const totalChunks = Number(totalBlocks / CHUNK) + (totalBlocks % CHUNK > 0n ? 1 : 0)
        const cappedChunks = Math.min(totalChunks, MAX_CHUNKS)

        const map = new Map<string, RecipientTotals>()
        let hadPartial = false

        for (let i = 0; i < cappedChunks; i++) {
          if (cancelled) return

          const fromBlock = start + BigInt(i) * CHUNK
          // For the last chunk we scan up to head, not an arbitrary ceiling
          const toBlock = i === cappedChunks - 1 ? head : fromBlock + CHUNK - 1n

          setProgress({ done: i, total: cappedChunks })

          try {
            const logs = await client.getLogs({
              address: ART_VENDOR_ADDRESS,
              event: PAYOUT_EVENT,
              fromBlock,
              toBlock,
            })

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
          } catch {
            // Non-fatal: mark partial and continue with the next chunk
            hadPartial = true
          }
        }

        if (cancelled) return
        setPartial(hadPartial)
        setRows([...map.values()].sort((a, b) => (a.total > b.total ? -1 : 1)))
        setProgress({ done: cappedChunks, total: cappedChunks })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error loading logs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  function fmt(raw: bigint): string {
    const n = Number(raw) / 10 ** USDC_DECIMALS
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }

  return { rows, loading, partial, error, progress, fmt }
}
