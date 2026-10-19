/**
 * LiveView: full-screen live render of a piece, addressed by seed hash.
 * NFT animation_url target: /live?h=<seedHash without 0x>&e=<edition>
 * With an edition number, the render derives a unique variant per edition:
 * hash = sha256(seedInput + "|ed|" + edition + "|v1|tallfenn").
 */
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'
import { useArtworks } from '@/hooks/useArtworks'
import ShaderCanvas from './ShaderCanvas'
import { isMasasSeed, isPremiumSeed, sha256Hex } from '@/lib/seedHash'

interface LiveViewProps {
  hash: string
}

export default function LiveView({ hash }: LiveViewProps) {
  const { t } = useLang()
  const edition = new URLSearchParams(window.location.search).get('e')
  const { artworks, isLoading } = useArtworks()
  const normalized = hash.replace(/^0x/, '').toLowerCase()
  const artwork = artworks.find((a) => a.seedHash.replace(/^0x/, '').toLowerCase() === normalized)

  const [renderHash, setRenderHash] = useState<string | null>(null)

  useEffect(() => {
    if (!artwork) return
    let cancelled = false
    const seed = edition ? `${artwork.seedInput}|ed|${edition}` : artwork.seedInput
    void sha256Hex(seed + '|v1|tallfenn').then((h) => {
      if (!cancelled) setRenderHash(h)
    })
    return () => {
      cancelled = true
    }
  }, [artwork, edition])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: 52, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          <a href="/" className="serif" style={{ fontSize: 17, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-0.01em' }}>
            Tall Fenn
          </a>
          <a href="/" style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', textDecoration: 'underline' }}>
            {t.live_back}
          </a>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {(isLoading || (artwork && !renderHash)) && (
          <p style={{ color: 'var(--subtle)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{t.loading}</p>
        )}

        {!isLoading && !artwork && (
          <p style={{ color: 'var(--subtle)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
            {t.live_not_found} <span className="mono" style={{ fontSize: 11 }}>{normalized.slice(0, 16)}…</span>
          </p>
        )}

        {artwork && renderHash && (
          <div style={{ width: '100%', maxWidth: 1100 }}>
            <div className="artwork-frame" style={{ aspectRatio: '4/3', width: '100%', overflow: 'hidden' }}>
              {isMasasSeed(artwork.seedInput) ? (
                <ShaderCanvas hash={renderHash} premium={isPremiumSeed(artwork.seedInput)} />
              ) : (
                <img
                  src={`/posters/${normalized}.png`}
                  alt={artwork.seriesName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>
            <div className="rule" style={{ margin: '1rem 0 0.6rem' }} />
            <p className="ficha-label" style={{ margin: 0 }}>{artwork.seriesName}</p>
            <p className="mono" style={{ color: 'var(--subtle)', fontSize: 11, margin: '4px 0 0' }}>
              {t.seed_label}: {artwork.seedInput}
              {edition ? ` · ${t.live_edition} ${edition}` : ''}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
