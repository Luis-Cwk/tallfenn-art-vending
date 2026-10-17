import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi, decodeEventLog } from 'viem'
import { Loader2 } from 'lucide-react'
import ArtworkPreview from './ArtworkPreview'
import { ART_VENDOR_ADDRESS, ART_VENDOR_ABI, USDC_ADDRESS, USDC_DECIMALS, ART_VENDOR_CHAIN_ID, EXPLORER_BASE } from '@/contracts/ArtVendor'
import { useLang } from '@/contexts/LangContext'
import type { ArtworkData } from '@/hooks/useArtworks'

interface BuyPanelProps {
  artwork: ArtworkData
  onBack: () => void
  onSuccess: () => void
}

function fmtPrice(price: bigint): string {
  return (Number(price) / 10 ** USDC_DECIMALS).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseOnchainError(error: unknown, t: ReturnType<typeof useLang>['t']): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return t.err_cancelled
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) return t.err_balance
  if (msg.includes('blocked')) return t.err_blocked
  if (msg.includes('reverted')) {
    const m = msg.match(/reason="([^"]+)"/)
    return m ? t.err_reverted(m[1]) : t.err_generic
  }
  return t.err_generic
}

export default function BuyPanel({ artwork, onBack, onSuccess }: BuyPanelProps) {
  const { t } = useLang()
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [errorMsg, setErrorMsg] = useState('')
  const [errorVisible, setErrorVisible] = useState(false)
  const [receipt, setReceipt] = useState<{ hash: string; edition: number; tokenId: bigint } | null>(null)

  const isWrongChain = !!address && chainId !== ART_VENDOR_CHAIN_ID
  const soldOut = artwork.sold >= artwork.editions

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance',
    args: address ? [address, ART_VENDOR_ADDRESS] : undefined,
    chainId: ART_VENDOR_CHAIN_ID, query: { enabled: !!address },
  })
  const needsApproval = allowance !== undefined && allowance < artwork.price

  const { writeContract: approve, data: approveHash, isPending: approvePending, error: approveError, reset: resetApprove } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { writeContract: buy, data: buyHash, isPending: buyPending, error: buyError, reset: resetBuy } = useWriteContract()
  const { isLoading: buyConfirming, isSuccess: buySuccess, data: buyReceipt } = useWaitForTransactionReceipt({ hash: buyHash })

  const refetchRef = useRef(refetchAllowance)
  useEffect(() => { refetchRef.current = refetchAllowance }, [refetchAllowance])
  useEffect(() => { if (approveSuccess) void refetchRef.current() }, [approveSuccess])

  const approveErrorRef = useRef(approveError)
  const buyErrorRef = useRef(buyError)
  useEffect(() => {
    if (approveError && approveError !== approveErrorRef.current) {
      approveErrorRef.current = approveError
      const msg = parseOnchainError(approveError, t)
      setTimeout(() => { setErrorMsg(msg); setErrorVisible(true) }, 0)
    }
  }, [approveError, t])
  useEffect(() => {
    if (buyError && buyError !== buyErrorRef.current) {
      buyErrorRef.current = buyError
      const msg = parseOnchainError(buyError, t)
      setTimeout(() => { setErrorMsg(msg); setErrorVisible(true) }, 0)
    }
  }, [buyError, t])

  const buySuccessHandled = useRef(false)
  useEffect(() => {
    if (buySuccess && buyReceipt && buyHash && !buySuccessHandled.current) {
      buySuccessHandled.current = true
      let edition = 0; let tokenId = 0n
      for (const log of buyReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: ART_VENDOR_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === 'ArtworkSold') {
            edition = Number((decoded.args as { editionNumber: number }).editionNumber)
            tokenId = (decoded.args as { tokenId: bigint }).tokenId
          }
        } catch { /* skip */ }
      }
      setTimeout(() => { setReceipt({ hash: buyHash, edition, tokenId }); onSuccess() }, 0)
    }
  }, [buySuccess, buyReceipt, buyHash, onSuccess])

  function handlePrimary() {
    if (!address) return
    if (isWrongChain) { switchChain({ chainId: ART_VENDOR_CHAIN_ID }); return }
    setErrorVisible(false)
    if (needsApproval) {
      approve({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [ART_VENDOR_ADDRESS, artwork.price] })
    } else {
      buy({ address: ART_VENDOR_ADDRESS, abi: ART_VENDOR_ABI, functionName: 'buy', args: [artwork.id] })
    }
  }
  function handleBuyAfterApprove() {
    setErrorVisible(false)
    buy({ address: ART_VENDOR_ADDRESS, abi: ART_VENDOR_ABI, functionName: 'buy', args: [artwork.id] })
  }

  const isBusy = approvePending || approveConfirming || buyPending || buyConfirming
  const showSuccess = buySuccess && receipt

  const ctaLabel = () => {
    if (!address) return t.cta_connect
    if (isWrongChain) return t.cta_wrong_chain
    if (approvePending) return t.cta_approving_wallet
    if (approveConfirming) return t.cta_approving
    if (approveSuccess && !buyHash) return t.confirm_purchase
    if (buyPending) return t.cta_buying_wallet
    if (buyConfirming) return t.cta_buying
    if (needsApproval) return t.cta_needs_approval
    return t.cta_buy
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Back link */}
      <div data-padded style={{ padding: '1.25rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
          {t.back_to_gallery}
        </button>
      </div>

      <div className="buy-grid" data-padded style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 40, maxWidth: 1100, margin: '0 auto', padding: '0 2rem 4rem', alignItems: 'start' }}>
        {/* Left: artwork frame */}
        <div className="artwork-frame" style={{ aspectRatio: '4/3', width: '100%', position: 'sticky', top: 80, overflow: 'hidden' }}>
          <ArtworkPreview seedInput={artwork.seedInput} seedHash={artwork.seedHash} mode="live" paused={false} />
        </div>

        {/* Right: details + buy */}
        <div>
          {/* Ficha */}
          <p className="ficha-label" style={{ marginBottom: 4 }}>{artwork.seriesName}</p>
          <p className="serif" style={{ fontSize: 20, color: 'var(--ink)', margin: '0 0 4px' }}>{t.artist_name}</p>
          <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: '0 0 24px' }}>
            {t.available_editions(artwork.editions - artwork.sold, artwork.editions)}
          </p>

          <div className="rule" style={{ margin: '0 0 20px' }} />

          {/* Price row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.price_label}</span>
            <span className="serif" style={{ fontSize: 22, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(artwork.price)} <span style={{ fontSize: 12 }}>USDC</span></span>
          </div>

          {/* Splits table */}
          <p style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {t.automatic_split}
          </p>
          {artwork.recipients.map((r, i) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--subtle)' }}>{r.slice(0, 8)}…{r.slice(-4)}</span>
              <span style={{ color: 'var(--ink)', fontSize: 12, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{(artwork.sharesBps[i] / 100).toFixed(0)}%</span>
            </div>
          ))}

          {needsApproval && address && (
            <p style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
              {t.step_approve}
            </p>
          )}

          <div className="rule" style={{ margin: '20px 0 18px' }} />

          {/* CTA area */}
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div key="success" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="serif" style={{ color: 'var(--ink)', fontSize: 16, margin: '0 0 6px' }}>{t.purchase_confirmed}</p>
                <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: '0 0 8px' }}>
                  {t.receipt_edition(receipt.edition, receipt.tokenId.toString())}
                </p>
                <a href={`${EXPLORER_BASE}/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ink)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', textDecoration: 'underline', wordBreak: 'break-all' }}>
                  {receipt.hash.slice(0, 20)}…
                </a>
                <br />
                <a href={`${EXPLORER_BASE}/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ink)', fontSize: 12, fontFamily: 'system-ui, sans-serif', borderBottom: '1px solid var(--ink)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
                  {t.view_explorer}
                </a>
              </motion.div>
            ) : errorVisible ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p style={{ color: 'var(--danger)', fontSize: 13, fontFamily: 'system-ui, sans-serif', margin: '0 0 12px' }}>{errorMsg}</p>
                <button onClick={() => { setErrorVisible(false); resetApprove(); resetBuy() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontFamily: 'system-ui, sans-serif', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}>
                  {t.retry}
                </button>
              </motion.div>
            ) : approveSuccess && !buyHash ? (
              <motion.div key="buynow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: '0 0 12px' }}>{t.usdc_approved}</p>
                <button onClick={handleBuyAfterApprove} disabled={isBusy}
                  style={{ background: 'none', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'system-ui, sans-serif', color: 'var(--ink)', borderBottom: '1px solid var(--ink)' }}>
                  {isBusy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  {t.confirm_purchase}
                </button>
              </motion.div>
            ) : !address ? (
              <div key="connect">
                <ConnectKitButton label={t.cta_connect} />
              </div>
            ) : (
              <motion.button key="cta" onClick={handlePrimary} disabled={isBusy || soldOut}
                style={{
                  background: 'none', border: 'none',
                  cursor: (isBusy || soldOut) ? 'not-allowed' : 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 14, fontFamily: 'system-ui, sans-serif', color: 'var(--ink)',
                  borderBottom: soldOut ? '1px solid var(--border)' : '1px solid var(--ink)',
                  opacity: isBusy ? 0.6 : 1,
                }}>
                {isBusy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {ctaLabel()}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 680px) { .buy-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
