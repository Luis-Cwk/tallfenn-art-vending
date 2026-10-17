/**
 * SeedsView: generative study page for masas|serie|A|01 through masas|serie|A|12.
 * No onchain calls. Renders posters via PosterQueue (same pipeline as Gallery)
 * and the live ShaderCanvas for the selected seed.
 */
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/contexts/LangContext'
import { sha256Hex, computeSeedHashInput } from '@/lib/seedHash'
import { deriveTraits, applyPalette } from '@/lib/tfEngine'
import PosterQueue from './PosterQueue'
import ShaderCanvas from './ShaderCanvas'

const SEED_INPUTS: string[] = Array.from({ length: 12 }, (_, i) =>
  `masas|serie|A|${String(i + 1).padStart(2, '0')}`
)

interface SeedEntry {
  seedInput: string
  hash: string       // hex, no 0x prefix
  seedHash: string   // same as hash (PosterQueue uses seedHash as cache key)
  mode: string
  hue: number | null
  count: number
}

export default function SeedsView() {
  const { t } = useLang()
  const [entries, setEntries] = useState<SeedEntry[]>([])
  const [posters, setPosters] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<SeedEntry | null>(null)

  // Compute all hashes and traits on mount
  useEffect(() => {
    let cancelled = false
    async function compute() {
      const results: SeedEntry[] = []
      for (const seedInput of SEED_INPUTS) {
        const hash = await sha256Hex(computeSeedHashInput(seedInput))
        const traits = deriveTraits(hash, { mode: 'auto', count: 0 })
        const pal = applyPalette('auto', hash)
        results.push({
          seedInput,
          hash,
          seedHash: hash,
          mode: traits.mode,
          hue: pal.hue,
          count: traits.count,
        })
      }
      if (!cancelled) setEntries(results)
    }
    void compute()
    return () => { cancelled = true }
  }, [])

  const handlePoster = useCallback((seedHash: string, url: string) => {
    setPosters(prev => ({ ...prev, [seedHash]: url }))
  }, [])

  const posterJobs = entries.map(e => ({ hash: e.hash, seedHash: e.seedHash }))

  if (selected) {
    return (
      <DetailView
        entry={selected}
        poster={posters[selected.seedHash]}
        onBack={() => setSelected(null)}
        backLabel={t.seeds_back}
        modeLabel={t.seeds_mode}
        hueLabel={t.seeds_hue}
        massesLabel={t.seeds_masses}
      />
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3.5rem 2rem 4rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--ink)', margin: '0 0 0.6rem' }}>
          {t.seeds_title}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'system-ui, sans-serif', margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
          {t.seeds_intro}
        </p>
      </div>

      {/* Poster pipeline (renders offscreen, sequential) */}
      <PosterQueue jobs={posterJobs} onPoster={handlePoster} />

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '2rem',
      }}>
        {entries.map((entry, idx) => (
          <SeedCard
            key={entry.seedInput}
            entry={entry}
            index={idx + 1}
            poster={posters[entry.seedHash]}
            modeLabel={t.seeds_mode}
            hueLabel={t.seeds_hue}
            massesLabel={t.seeds_masses}
            onClick={() => setSelected(entry)}
          />
        ))}

        {/* Skeleton placeholders while hashes are computing */}
        {entries.length === 0 && SEED_INPUTS.map((s) => (
          <div key={s} style={{
            aspectRatio: '1',
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
          }} />
        ))}
      </div>
    </div>
  )
}

// ---- Card ----

interface SeedCardProps {
  entry: SeedEntry
  index: number
  poster: string | undefined
  modeLabel: string
  hueLabel: string
  massesLabel: string
  onClick: () => void
}

function SeedCard({ entry, index, poster, modeLabel, hueLabel, massesLabel, onClick }: SeedCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
      aria-label={entry.seedInput}
    >
      {/* Poster frame */}
      <div style={{
        aspectRatio: '1',
        border: `1px solid ${hovered ? 'var(--ink)' : 'var(--border)'}`,
        overflow: 'hidden',
        background: 'var(--surface-muted)',
        transition: 'border-color 0.15s',
        position: 'relative',
      }}>
        {poster
          ? <img src={poster} alt={entry.seedInput} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
          : null
        }
        {/* Index number: top-left, ink color only on hover */}
        <span style={{
          position: 'absolute', top: 8, left: 10,
          fontFamily: 'system-ui, sans-serif', fontSize: 10,
          color: hovered ? 'var(--ink)' : 'var(--subtle)',
          letterSpacing: '0.06em', transition: 'color 0.15s',
          userSelect: 'none',
        }}>
          {String(index).padStart(2, '0')}
        </span>
      </div>

      {/* Metadata below frame */}
      <div style={{ paddingTop: '0.55rem' }}>
        <p className="mono" style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 0.3rem', lineHeight: 1.4, wordBreak: 'break-all' }}>
          {entry.seedInput}
        </p>
        <p style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'system-ui, sans-serif', margin: 0, lineHeight: 1.5 }}>
          {modeLabel} {entry.mode}
          {entry.hue !== null && <> · {hueLabel} {entry.hue}</>}
          {' '} · {massesLabel} {entry.count}
        </p>
      </div>
    </button>
  )
}

// ---- Detail view ----

interface DetailViewProps {
  entry: SeedEntry
  poster: string | undefined
  onBack: () => void
  backLabel: string
  modeLabel: string
  hueLabel: string
  massesLabel: string
}

function DetailView({ entry, onBack, backLabel, modeLabel, hueLabel, massesLabel }: DetailViewProps) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem 4rem' }}>

      {/* Back link */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: 'system-ui, sans-serif', fontSize: 12,
        color: 'var(--muted)', marginBottom: '2rem', display: 'block',
      }}>
        {backLabel}
      </button>

      {/* Live canvas in 4:3 frame */}
      <div style={{
        width: '100%', maxWidth: 700, margin: '0 auto',
        aspectRatio: '4/3',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--surface-muted)',
      }}>
        <ShaderCanvas hash={entry.hash} />
      </div>

      {/* Metadata */}
      <div style={{ maxWidth: 700, margin: '1.5rem auto 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', margin: 0, wordBreak: 'break-all' }}>
          {entry.seedInput}
        </p>
        <p style={{ fontSize: 12, color: 'var(--subtle)', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          {modeLabel} {entry.mode}
          {entry.hue !== null && <> · {hueLabel} {entry.hue}</>}
          {' '} · {massesLabel} {entry.count}
        </p>
        <p className="mono" style={{ fontSize: 10, color: 'var(--subtle)', margin: 0, wordBreak: 'break-all' }}>
          {entry.hash}
        </p>
      </div>

    </div>
  )
}
