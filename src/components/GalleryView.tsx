import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ArtworkPreview from './ArtworkPreview'
import PosterQueue from './PosterQueue'
import MintedEditions from './MintedEditions'
import { isMasasSeed } from '@/lib/seedHash'
import { USDC_DECIMALS } from '@/contracts/ArtVendor'
import { useLang } from '@/contexts/LangContext'
import type { ArtworkData } from '@/hooks/useArtworks'

interface GalleryViewProps {
  artworks: ArtworkData[]
  isLoading: boolean
  onBuy: (id: bigint) => void
}

function fmtPrice(price: bigint): string {
  return (Number(price) / 10 ** USDC_DECIMALS).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function shortSeed(s: string) { return s.length > 28 ? s.slice(0, 26) + '…' : s }
function shortHash(h: string) {
  const plain = h.startsWith('0x') ? h.slice(2) : h
  return plain.slice(0, 8)
}

export default function GalleryView({ artworks, isLoading, onBuy }: GalleryViewProps) {
  const { t } = useLang()
  const [selectedId, setSelectedId] = useState<number>(0)
  const [posters, setPosters] = useState<Record<string, string>>({})
  const picked = useRef(false)

  // The gallery is a generative space: feature a different work on each visit.
  useEffect(() => {
    if (!picked.current && artworks.length > 1) {
      picked.current = true
      setSelectedId(Math.floor(Math.random() * artworks.length))
    }
  }, [artworks.length])

  const handlePoster = useCallback((seedHash: string, url: string) => {
    setPosters((prev) => ({ ...prev, [seedHash]: url }))
  }, [])

  const posterJobs = artworks
    .filter((a) => isMasasSeed(a.seedInput))
    .map((a) => ({ hash: a.seedHash.startsWith('0x') ? a.seedHash.slice(2) : a.seedHash, seedHash: a.seedHash }))

  const featured = artworks[selectedId] ?? artworks[0]
  const soldOut = featured ? featured.sold >= featured.editions : false
  const left = featured ? featured.editions - featured.sold : 0

  return (
    <div style={{ background: 'var(--bg)' }}>
      <PosterQueue jobs={posterJobs} onPoster={handlePoster} />

      {/* Featured: framed work on wall */}
      <section data-padded style={{ padding: '3.5rem 2rem 2.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          {featured && (
            <motion.div key={featured.id.toString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              {/* The frame */}
              <div className="artwork-frame" style={{ aspectRatio: '4/3', width: '100%', maxHeight: '72vh', position: 'relative', overflow: 'hidden' }}>
                <ArtworkPreview
                  seedInput={featured.seedInput}
                  seedHash={featured.seedHash}
                  mode="live"
                  posterUrl={posters[featured.seedHash]}
                  paused={false}
                />
              </div>

              {/* Divider rule */}
              <div className="rule" style={{ margin: '1.25rem 0 1rem' }} />

              {/* Museum label (ficha) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                  <p className="ficha-label">{featured.seriesName}</p>
                  <p className="serif ficha-title">{t.artist_name}</p>
                  <p className="mono" style={{ color: 'var(--subtle)', fontSize: 10, marginTop: 4, marginBottom: 0 }}>
                    {t.seed_label}: {shortSeed(featured.seedInput)}
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    {shortHash(featured.seedHash)}
                  </p>
                </div>
                <div className="ficha-right" style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', margin: '0 0 2px' }}>
                    {t.editions_left(left, featured.editions)}
                  </p>
                  <p className="serif" style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPrice(featured.price)} USDC
                  </p>
                  {!soldOut ? (
                    <button onClick={() => onBuy(featured.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: 'var(--ink)', fontSize: 13, fontFamily: 'system-ui, sans-serif',
                      borderBottom: '1px solid var(--ink)', lineHeight: 1.4,
                    }}>
                      {t.acquire}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>{t.sold_out}</span>
                  )}
                </div>
              </div>

              {/* Minted receipts for this work */}
              <MintedEditions />
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && !featured && (
          <div style={{ aspectRatio: '4/3', maxHeight: '72vh', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>{t.loading}</span>
          </div>
        )}
      </section>

      {/* Catalogue: index of works */}
      {artworks.length > 0 && (
        <section data-padded style={{ padding: '2rem 2rem 4rem', maxWidth: 1100, margin: '0 auto', borderTop: '1px solid var(--border)' }}>
          <p className="ficha-label" style={{ marginBottom: '1.25rem' }}>{t.catalogue_title}</p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {artworks.map((art, idx) => {
              const isSelected = idx === selectedId
              const artLeft = art.editions - art.sold
              return (
                        <motion.button
                  key={art.id.toString()}
                  onClick={() => setSelectedId(idx)}
                  className="catalogue-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 56px 1fr 110px 72px',
                    alignItems: 'center',
                    gap: '0.875rem',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    borderTop: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  {/* Index */}
                  <span style={{ color: isSelected ? 'var(--ink)' : 'var(--subtle)', fontSize: 11, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Thumbnail */}
                  <div style={{ width: 56, height: 40, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface-muted)' }}>
                    <ArtworkPreview
                      seedInput={art.seedInput}
                      seedHash={art.seedHash}
                      mode="poster"
                      posterUrl={posters[art.seedHash]}
                    />
                  </div>

                  {/* Title + seed */}
                  <div style={{ minWidth: 0 }}>
                    <p className="serif" style={{ fontSize: 14, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {art.seriesName}
                    </p>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--subtle)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {art.seedInput}
                    </p>
                  </div>

                  {/* Price */}
                  <span className="cat-price" style={{ color: 'var(--ink)', fontSize: 13, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {fmtPrice(art.price)} USDC
                  </span>

                  {/* Editions left */}
                  <span className="cat-editions" style={{ color: artLeft === 0 ? 'var(--subtle)' : 'var(--muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif', textAlign: 'right' }}>
                    {artLeft === 0 ? t.sold_out : t.editions_abbr(artLeft)}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {!isLoading && artworks.length === 0 && (
            <p style={{ color: 'var(--subtle)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{t.no_works}</p>
          )}
        </section>
      )}
    </div>
  )
}
