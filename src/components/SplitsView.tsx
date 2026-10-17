import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { usePayoutLogs } from '@/hooks/usePayoutLogs'
import { useLang } from '@/contexts/LangContext'

export default function SplitsView() {
  const { rows, loading, partial, error, progress, fmt } = usePayoutLogs()
  const { t } = useLang()

  return (
    <div data-padded style={{ padding: '3.5rem 2rem 5rem', maxWidth: 860, margin: '0 auto' }}>
      <h2 className="serif" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--ink)', margin: '0 0 8px' }}>
        {t.splits_title}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'system-ui, sans-serif', margin: '0 0 2.5rem', maxWidth: '58ch', lineHeight: 1.6 }}>
        {t.splits_subtitle}
      </p>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          {progress
            ? `${t.splits_loading} (${progress.done}/${progress.total})`
            : t.splits_loading}
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{t.splits_error}</p>
      )}

      {/* Non-fatal partial note, shown alongside results */}
      {partial && !loading && (
        <p style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', margin: '0 0 1rem', fontStyle: 'italic' }}>
          {t.splits_partial}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p style={{ color: 'var(--subtle)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{t.splits_empty}</p>
      )}

      {rows.length > 0 && (
        <div>
          {/* Table header */}
          <div className="splits-header" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 60px', gap: 0, padding: '6px 0 6px', borderBottom: '1px solid var(--ink)' }}>
            {([t.col_recipient, t.col_total, t.col_last, t.col_count] as string[]).map((h) => (
              <span key={h} style={{ color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>

          {rows.map((row, i) => (
            <motion.div key={row.address}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="splits-row"
              style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 60px', gap: 0, padding: '11px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span className="mono" style={{ color: 'var(--ink)', fontSize: 11 }}>
                {row.address.slice(0, 10)}…{row.address.slice(-6)}
              </span>
              <span className="serif" style={{ color: 'var(--ink)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(row.total)} USDC
              </span>
              <span className="splits-row-last" style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(row.lastAmount)} USDC
              </span>
              <span className="splits-row-count" style={{ color: 'var(--subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{row.count}</span>
            </motion.div>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', marginTop: '1.5rem' }}>
        {t.splits_footer}
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
