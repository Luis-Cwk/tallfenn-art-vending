import { motion } from 'framer-motion'
import { useLang } from '@/contexts/LangContext'
import { ART_VENDOR_ADDRESS, EXPLORER_BASE } from '@/contracts/ArtVendor'

export default function ComoFunciona() {
  const { t } = useLang()

  // Split the body into paragraphs on double newline
  const paragraphs = t.how_body.split('\n\n').filter(Boolean)

  return (
    <div data-padded style={{ padding: '3.5rem 2rem 5rem', maxWidth: 680, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <h2 className="serif" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--ink)', margin: '0 0 2rem' }}>
          {t.how_title}
        </h2>

        {paragraphs.map((para, i) => (
          <p key={i} style={{
            fontSize: 15, lineHeight: 1.75, color: i === 0 ? 'var(--ink)' : 'var(--muted)',
            fontFamily: i === 0 ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif',
            margin: '0 0 1.4rem', maxWidth: '62ch',
          }}>
            {para}
          </p>
        ))}

        <div className="rule" style={{ margin: '2rem 0' }} />

        {/* Contract reference */}
        <p style={{ color: 'var(--subtle)', fontSize: 10, fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          {t.how_contract_label}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{ART_VENDOR_ADDRESS}</span>
          <span style={{ color: 'var(--subtle)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>Arc Testnet · 5042002</span>
          <a href={`${EXPLORER_BASE}/address/${ART_VENDOR_ADDRESS}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--ink)', fontSize: 11, fontFamily: 'system-ui, sans-serif', borderBottom: '1px solid var(--ink)', textDecoration: 'none' }}>
            {t.how_explorer}
          </a>
        </div>
      </motion.div>
    </div>
  )
}
