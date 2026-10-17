/**
 * MintedEditions: receipts minted for one artwork, read from ArtworkSold events.
 * Shows edition number, token id, owner and the transaction.
 */
import { useLang } from '@/contexts/LangContext'
import { useSales } from '@/hooks/useSales'
import { EXPLORER_BASE } from '@/contracts/ArtVendor'

interface MintedEditionsProps {
  artworkId: bigint
}

function short(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export default function MintedEditions({ artworkId }: MintedEditionsProps) {
  const { t } = useLang()
  const { sales, loading } = useSales()
  const rows = sales.filter((s) => BigInt(s.artworkId) === artworkId)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <p className="ficha-label" style={{ marginBottom: '0.6rem' }}>
        {t.minted_title}
      </p>

      {loading && rows.length === 0 && (
        <p style={{ color: 'var(--subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          {t.minted_loading}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <p style={{ color: 'var(--subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          {t.minted_empty}
        </p>
      )}

      {rows.map((sale) => (
        <div
          key={sale.tokenId.toString()}
          style={{
            display: 'grid',
            gridTemplateColumns: '52px 64px 1fr auto',
            alignItems: 'center',
            gap: 10,
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          <span>{t.minted_edition} {sale.edition}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--subtle)' }}>#{sale.tokenId.toString()}</span>
          <span className="mono" style={{ fontSize: 10 }}>{short(sale.buyer)}</span>
          <a
            href={`${EXPLORER_BASE}/tx/${sale.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--ink)', textDecoration: 'underline', fontSize: 11 }}
          >
            tx
          </a>
        </div>
      ))}
    </div>
  )
}
