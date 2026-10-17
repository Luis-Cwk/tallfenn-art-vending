/**
 * Tall Fenn: Art Vending Machine
 * Arc mainnet · USDC
 */
import { useState, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import { motion, AnimatePresence } from 'framer-motion'
import GalleryView from './components/GalleryView'
import BuyPanel from './components/BuyPanel'
import SplitsView from './components/SplitsView'
import ArtistPanel from './components/ArtistPanel'
import ComoFunciona from './components/ComoFunciona'
import SeedsView from './components/SeedsView'
import { useArtworks, useContractOwner } from './hooks/useArtworks'
import { useLang } from './contexts/LangContext'
import { StudioWatermark } from './main'

type Route = 'gallery' | 'buy' | 'seeds' | 'splits' | 'artista' | 'como'

export default function App() {
  const [route, setRoute] = useState<Route>('gallery')
  const [buyArtworkId, setBuyArtworkId] = useState<bigint | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, lang, setLang } = useLang()

  const { artworks, isLoading, refetch } = useArtworks()
  const { data: ownerAddress } = useContractOwner()

  const handleBuy = useCallback((id: bigint) => {
    setBuyArtworkId(id)
    setRoute('buy')
  }, [])
  const handleBack = useCallback(() => {
    setBuyArtworkId(null)
    setRoute('gallery')
  }, [])
  const handleBuySuccess = useCallback(() => { void refetch() }, [refetch])
  const navigate = (id: Route) => {
    setRoute(id); setMenuOpen(false)
    if (id !== 'buy') setBuyArtworkId(null)
  }

  const buyArtwork = buyArtworkId !== null ? artworks.find((a) => a.id === buyArtworkId) : undefined

  const navItems: { id: Route; label: string }[] = [
    { id: 'gallery', label: t.nav_gallery },
    { id: 'seeds', label: t.nav_seeds },
    { id: 'splits', label: t.nav_splits },
    { id: 'artista', label: t.nav_artist },
    { id: 'como', label: t.nav_how },
  ]

  const isGalleryActive = route === 'gallery' || route === 'buy'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header strip */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', height: 52, maxWidth: 1400, margin: '0 auto', width: '100%' }}>

          {/* Wordmark */}
          <button onClick={() => navigate('gallery')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span className="serif" style={{ fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Tall Fenn
            </span>
            <span style={{ color: 'var(--subtle)', fontSize: 9, marginLeft: 7, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t.nav_testnet}
            </span>
          </button>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 0 }} className="desktop-nav">
            {navItems.map((n) => {
              const active = n.id === 'gallery' ? isGalleryActive : route === n.id
              return (
                <button key={n.id} onClick={() => navigate(n.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 14px', fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: active ? 500 : 400,
                }}>
                  {n.label}
                </button>
              )
            })}
          </nav>

          {/* Wallet + mobile hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ConnectKitButton label={t.connect_wallet} />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="mobile-menu-btn"
              aria-label="menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: 4, display: 'none', fontSize: 18, lineHeight: 1 }}>
              {menuOpen ? '×' : '≡'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
              {navItems.map((n) => {
                const active = n.id === 'gallery' ? isGalleryActive : route === n.id
                return (
                  <button key={n.id} onClick={() => navigate(n.id)} style={{
                    display: 'block', width: '100%', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: '14px 2rem', textAlign: 'left', cursor: 'pointer',
                    fontSize: 14, fontFamily: 'system-ui, sans-serif',
                    color: active ? 'var(--ink)' : 'var(--muted)',
                    fontWeight: active ? 500 : 400,
                  }}>
                    {n.label}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {(route === 'gallery') && (
            <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <GalleryView artworks={artworks} isLoading={isLoading} onBuy={handleBuy} />
            </motion.div>
          )}
          {route === 'buy' && buyArtwork && (
            <motion.div key="buy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <BuyPanel artwork={buyArtwork} onBack={handleBack} onSuccess={handleBuySuccess} />
            </motion.div>
          )}
          {route === 'seeds' && (
            <motion.div key="seeds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <SeedsView />
            </motion.div>
          )}
          {route === 'splits' && (
            <motion.div key="splits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <SplitsView />
            </motion.div>
          )}
          {route === 'artista' && (
            <motion.div key="artista" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <ArtistPanel artworks={artworks} ownerAddress={ownerAddress} onRefetch={() => { void refetch() }} />
            </motion.div>
          )}
          {route === 'como' && (
            <motion.div key="como" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <ComoFunciona />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer: credit · watermark · language toggle */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '1.25rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem',
        maxWidth: 1400, margin: '0 auto', width: '100%',
      }}>
        {/* Left: name + inline Arc Studio badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: 'var(--subtle)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>
            Tall Fenn · Arc
          </span>
          <StudioWatermark />
        </div>
        {/* Right: language switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(['en', 'es'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '3px 7px', fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.08em',
              color: lang === l ? 'var(--ink)' : 'var(--subtle)',
              borderBottom: lang === l ? '1px solid var(--ink)' : '1px solid transparent',
              textTransform: 'uppercase',
            }}>
              {l === 'en' ? t.lang_toggle_en : t.lang_toggle_es}
            </button>
          ))}
        </div>
      </footer>

      <style>{`
        @media (max-width: 680px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
