import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Check, X, Loader2, Plus, Trash2, Lock } from 'lucide-react'
import { ART_VENDOR_ADDRESS, ART_VENDOR_ABI, USDC_DECIMALS, ART_VENDOR_CHAIN_ID } from '@/contracts/ArtVendor'
import { useLang } from '@/contexts/LangContext'
import type { ArtworkData } from '@/hooks/useArtworks'

interface ArtistPanelProps {
  artworks: ArtworkData[]
  ownerAddress: string | undefined
  onRefetch: () => void
}

function parseOnchainError(error: unknown, t: ReturnType<typeof useLang>['t']): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return t.err_cancelled
  if (msg.includes('not the owner') || msg.includes('ownable')) return t.err_owner
  return t.err_generic
}

interface Recipient { address: string; share: string }

function RecipientRow({ index, address, share, onAddress, onShare, onRemove, removable }: {
  index: number; address: string; share: string
  onAddress: (v: string) => void; onShare: (v: string) => void
  onRemove: () => void; removable: boolean
}) {
  const { t } = useLang()
  const inp: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    padding: '7px 10px', color: 'var(--ink)', fontSize: 12,
    fontFamily: 'system-ui, sans-serif', outline: 'none', width: '100%', borderRadius: 0,
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
      <input type="text" placeholder={t.address_placeholder(index)} value={address} onChange={(e) => onAddress(e.target.value)} style={{ ...inp, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
      <input type="number" placeholder="%" value={share} onChange={(e) => onShare(e.target.value)} min="1" max="100" style={{ ...inp, textAlign: 'right' }} />
      <button onClick={onRemove} disabled={!removable} style={{ background: 'none', border: 'none', cursor: removable ? 'pointer' : 'not-allowed', color: removable ? 'var(--danger)' : 'var(--subtle)', padding: 4 }}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function useListArtworkForm(onSuccess: () => void, t: ReturnType<typeof useLang>['t']) {
  const [price, setPrice] = useState('')
  const [editions, setEditions] = useState('')
  const [seedInput, setSeedInput] = useState('')
  const [seriesName, setSeriesName] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: '', share: '100' }])
  const [status, setStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess && status === 'confirming') { setStatus('success'); onSuccess() }
  if (error && status !== 'error') { setStatus('error'); setErrorMsg(parseOnchainError(error, t)) }
  if (isPending && status === 'idle') setStatus('pending')
  if (isConfirming && !isPending && status === 'pending') setStatus('confirming')

  function submit() {
    const priceRaw = BigInt(Math.round(parseFloat(price) * 10 ** USDC_DECIMALS))
    const editionsNum = parseInt(editions, 10)
    const addrs = recipients.map((r) => r.address.trim() as `0x${string}`)
    const sharesBps = recipients.map((r) => parseInt(r.share, 10) * 100) as unknown as readonly number[]
    writeContract({ address: ART_VENDOR_ADDRESS, abi: ART_VENDOR_ABI, functionName: 'listArtwork', args: [priceRaw, editionsNum, seedInput.trim(), seriesName.trim(), addrs, sharesBps] })
    setStatus('pending')
  }

  return { price, setPrice, editions, setEditions, seedInput, setSeedInput, seriesName, setSeriesName, recipients, setRecipients, status, setStatus, errorMsg, submit, isBusy: isPending || isConfirming }
}

export default function ArtistPanel({ artworks, ownerAddress, onRefetch }: ArtistPanelProps) {
  const { t } = useLang()
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase()
  const isWrongChain = !!address && chainId !== ART_VENDOR_CHAIN_ID

  const form = useListArtworkForm(onRefetch, t)

  const [updateId, setUpdateId] = useState('')
  const [updateRecipients, setUpdateRecipients] = useState<Recipient[]>([{ address: '', share: '100' }])
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>('idle')
  const [updateError, setUpdateError] = useState('')

  const { writeContract: updateWrite, data: updateHash, isPending: updatePending, error: updateErr } = useWriteContract()
  const { isLoading: updateConfirming, isSuccess: updateSuccess } = useWaitForTransactionReceipt({ hash: updateHash })
  if (updateSuccess && updateStatus === 'confirming') { setUpdateStatus('success'); onRefetch() }
  if (updateErr && updateStatus !== 'error') { setUpdateStatus('error'); setUpdateError(parseOnchainError(updateErr, t)) }
  if (updatePending && updateStatus === 'idle') setUpdateStatus('pending')
  if (updateConfirming && !updatePending && updateStatus === 'pending') setUpdateStatus('confirming')

  function submitUpdate() {
    const id = BigInt(parseInt(updateId, 10))
    const addrs = updateRecipients.map((r) => r.address.trim() as `0x${string}`)
    const sharesBps = updateRecipients.map((r) => parseInt(r.share, 10) * 100)
    updateWrite({ address: ART_VENDOR_ADDRESS, abi: ART_VENDOR_ABI, functionName: 'updateArtworkRecipients', args: [id, addrs, sharesBps as unknown as readonly number[]] })
    setUpdateStatus('pending')
  }

  const inp: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 0,
    padding: '8px 10px', color: 'var(--ink)', fontSize: 13,
    fontFamily: 'system-ui, sans-serif', outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = { color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

  return (
    <div data-padded style={{ padding: '3.5rem 2rem 5rem', maxWidth: 660, margin: '0 auto' }}>
      <h2 className="serif" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--ink)', margin: '0 0 6px' }}>
        {t.artist_title}
      </h2>
      <p style={{ color: 'var(--subtle)', fontSize: 11, fontFamily: 'system-ui, sans-serif', margin: '0 0 2.5rem' }}>
        {t.owner_label}: <span className="mono" style={{ fontSize: 10 }}>{ownerAddress ?? '…'}</span>
      </p>

      {!address && (
        <div style={{ marginBottom: 24 }}>
          <ConnectKitButton label={t.connect_wallet} />
        </div>
      )}

      {address && !isOwner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Lock size={14} color="var(--subtle)" />
          <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: 0 }}>{t.not_owner}</p>
        </div>
      )}

      {isWrongChain && address && (
        <button onClick={() => switchChain({ chainId: ART_VENDOR_CHAIN_ID })}
          style={{ display: 'block', width: '100%', marginBottom: 16, padding: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', textAlign: 'left' }}>
          {t.wrong_chain}
        </button>
      )}

      {/* List artwork */}
      <section style={{ marginBottom: 36 }}>
        <p className="serif" style={{ fontSize: 15, color: 'var(--ink)', margin: '0 0 16px' }}>{t.list_artwork_title}</p>
        <div className="artist-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>{t.price_usdc}</label>
            <input type="number" placeholder="0.50" value={form.price} onChange={(e) => form.setPrice(e.target.value)} style={inp} disabled={!isOwner} min="0" step="0.01" />
          </div>
          <div>
            <label style={lbl}>{t.editions_label}</label>
            <input type="number" placeholder="25" value={form.editions} onChange={(e) => form.setEditions(e.target.value)} style={inp} disabled={!isOwner} min="1" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>{t.seed_input_label}</label>
          <input type="text" placeholder="masas|serie|A|01" value={form.seedInput} onChange={(e) => form.setSeedInput(e.target.value)} style={{ ...inp, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} disabled={!isOwner} />
          <p style={{ color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', margin: '3px 0 0' }}>{t.seed_hint}</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{t.series_name_label}</label>
          <input type="text" placeholder="Masas Semiredondas" value={form.seriesName} onChange={(e) => form.setSeriesName(e.target.value)} style={inp} disabled={!isOwner} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{t.recipients_label}</label>
          {form.recipients.map((r, i) => (
            <RecipientRow key={i} index={i} address={r.address} share={r.share}
              onAddress={(v) => { const n = [...form.recipients]; n[i] = { ...n[i], address: v }; form.setRecipients(n) }}
              onShare={(v) => { const n = [...form.recipients]; n[i] = { ...n[i], share: v }; form.setRecipients(n) }}
              onRemove={() => form.setRecipients(form.recipients.filter((_, j) => j !== i))}
              removable={form.recipients.length > 1}
            />
          ))}
          {isOwner && form.recipients.length < 4 && (
            <button onClick={() => form.setRecipients([...form.recipients, { address: '', share: '0' }])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'system-ui, sans-serif', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={11} /> {t.add_recipient}
            </button>
          )}
          <p style={{ color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', margin: '6px 0 0' }}>{t.shares_hint}</p>
        </div>

        <AnimatePresence>
          {form.status === 'success' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginBottom: 10 }}>
              <Check size={13} /> {t.work_registered}
            </motion.div>
          )}
          {form.status === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginBottom: 10 }}>
              <X size={13} /> {form.errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={form.submit} disabled={!isOwner || form.isBusy}
          style={{ background: 'none', border: 'none', cursor: (!isOwner || form.isBusy) ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: isOwner ? 'var(--ink)' : 'var(--subtle)', borderBottom: isOwner ? '1px solid var(--ink)' : 'none', opacity: form.isBusy ? 0.6 : 1 }}>
          {form.isBusy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {t.register_work}
        </button>
      </section>

      <div className="rule" />

      {/* Update recipients */}
      <section style={{ marginTop: 28 }}>
        <p className="serif" style={{ fontSize: 15, color: 'var(--ink)', margin: '0 0 16px' }}>{t.update_recipients_title}</p>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>{t.editions_label} ID</label>
          <select value={updateId} onChange={(e) => setUpdateId(e.target.value)} style={{ ...inp, cursor: 'pointer' }} disabled={!isOwner}>
            <option value="">{t.select_work}</option>
            {artworks.map((a) => (
              <option key={a.id.toString()} value={a.id.toString()}>#{a.id.toString()} ({a.seedInput})</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{t.recipients_label}</label>
          {updateRecipients.map((r, i) => (
            <RecipientRow key={i} index={i} address={r.address} share={r.share}
              onAddress={(v) => { const n = [...updateRecipients]; n[i] = { ...n[i], address: v }; setUpdateRecipients(n) }}
              onShare={(v) => { const n = [...updateRecipients]; n[i] = { ...n[i], share: v }; setUpdateRecipients(n) }}
              onRemove={() => setUpdateRecipients(updateRecipients.filter((_, j) => j !== i))}
              removable={updateRecipients.length > 1}
            />
          ))}
          {isOwner && updateRecipients.length < 4 && (
            <button onClick={() => setUpdateRecipients([...updateRecipients, { address: '', share: '0' }])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'system-ui, sans-serif', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={11} /> {t.add_recipient}
            </button>
          )}
        </div>

        <AnimatePresence>
          {updateStatus === 'success' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginBottom: 10 }}>
              <Check size={13} /> {t.recipients_updated}
            </motion.div>
          )}
          {updateStatus === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginBottom: 10 }}>
              <X size={13} /> {updateError}
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={submitUpdate} disabled={!isOwner || updatePending || updateConfirming || !updateId}
          style={{ background: 'none', border: 'none', cursor: (!isOwner || !updateId) ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: (isOwner && updateId) ? 'var(--ink)' : 'var(--subtle)', borderBottom: (isOwner && updateId) ? '1px solid var(--ink)' : 'none', opacity: (updatePending || updateConfirming) ? 0.6 : 1 }}>
          {(updatePending || updateConfirming) && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {t.update_btn}
        </button>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
