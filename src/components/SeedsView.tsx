/**
 * SeedsView: generative study page with the two masas collections.
 *   Study:   masas|serie|A|01   .. 12
 *   Premium: masas|premium|001  .. 12 (orbital sculpture, luxury palettes)
 * No onchain calls. Posters come from the shared PosterQueue pipeline.
 */
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/contexts/LangContext'
import { sha256Hex, computeSeedHashInput } from '@/lib/seedHash'
import { resolveLook } from '@/lib/tfEngine'
import PosterQueue, { type PosterJob } from './PosterQueue'
import ShaderCanvas from './ShaderCanvas'

const STUDIO_SEEDS: string[] = Array.from({ length: 12 }, (_, i) =>
  `masas|serie|A|${String(i + 1).padStart(2, '0')}`
)
const PREMIUM_SEEDS: string[] = Array.from({ length: 12 }, (_, i) =>
  `masas|premium|${String(i + 1).padStart(3, '0')}`
)

interface SeedEntry {
  seedInput: string
  hash: string       // hex, no 0x prefix
  seedHash: string   // same as hash (PosterQueue cache key)
  mode: string
  hue: number | null
  paletteName: string | null
  count: number
  premium: boolean
}

async function buildEntries(seeds: string[], premium: boolean): Promise<SeedEntry[]> {
  const results: SeedEntry[] = []
  for (const seedInput of seeds) {
    const hash = await sha256Hex(computeSeedHashInput(seedInput))
    const { traits, pal } = resolveLook(hash, premium)
    results.push({
      seedInput,
      hash,
      seedHash: hash,
      mode: traits.mode,
      hue: pal.hue,
      paletteName: premium ? pal.name : null,
      count: traits.count,
      premium,
    })
  }
  return results
}

export default function SeedsView() {
  const { t } = useLang()
  const [premiumEntries, setPremiumEntries] = useState<SeedEntry[]>([])
  const [studioEntries, setStudioEntries] = useState<SeedEntry[]>([])
  const [posters, setPosters] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<SeedEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [premium, studio] = await Promise.all([
        buildEntries(PREMIUM_SEEDS, true),
        buildEntries(STUDIO_SEEDS, false),
      ])
      if (cancelled) return
      setPremiumEntries(premium)
      setStudioEntries(studio)
    })()
    return () => { cancelled = true }
  }, [])

  const handlePoster = useCallback((seedHash: string, url: string) => {
    setPosters(prev => ({ ...prev, [seedHash]: url }))
  }, [])

  const posterJobs: PosterJob[] = [...premiumEntries, ...studioEntries].map(e => ({
    hash: e.hash, seedHash: e.seedHash, premium: e.premium,
  }))

  if (selected) {
    return (
      <DetailView
        entry={selected}
        onBack={() => setSelected(null)}
        backLabel={t.seeds_back}
        modeLabel={t.seeds_mode}
        hueLabel={t.seeds_hue}
        paletteLabel={t.seeds_palette}
        massesLabel={t.seeds_masses}
      />
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3.5rem 2rem 4rem' }}>

      {/* Poster pipeline (renders offscreen, sequential) */}
      <PosterQueue jobs={posterJobs} onPoster={handlePoster} />

      <SeedGroup
        title={t.seeds_premium_title}
        intro={t.seeds_premium_intro}
        entries={premiumEntries}
        expected={PREMIUM_SEEDS.length}
        posters={posters}
        onSelect={setSelected}
        labels={{ mode: t.seeds_mode, hue: t.seeds_hue, palette: t.seeds_palette, masses: t.seeds_masses }}
      />

      <div style={{ height: '3.5rem' }} />

      <SeedGroup
        title={t.seeds_studio_title}
        intro={t.seeds_intro}
        entries={studioEntries}
        expected={STUDIO_SEEDS.length}
        posters={posters}
        onSelect={setSelected}
        labels={{ mode: t.seeds_mode, hue: t.seeds_hue, palette: t.seeds_palette, masses: t.seeds_masses }}
      />
    </div>
  )
}

// ---- Group ----

interface SeedGroupProps {
  title: string
  intro: string
  entries: SeedEntry[]
  expected: number
  posters: Record<string, string>
  onSelect: (e: SeedEntry) => void
  labels: { mode: string; hue: string; palette: string; masses: string }
}

function SeedGroup({ title, intro, entries, expected, posters, onSelect, labels }: SeedGroupProps) {
  return (
    <section>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--ink)', margin: '0 0 0.6rem' }}>
          {title}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'system-ui, sans-serif', margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
          {intro}
        </p>
      </div>

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
            labels={labels}
            onClick={() => onSelect(entry)}
          />
        ))}

        {entries.length === 0 && Array.from({ length: expected }).map((_, i) => (
          <div key={i} style={{
            aspectRatio: '1',
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
          }} />
        ))}
      </div>
    </section>
  )
}

// ---- Card ----

interface SeedCardProps {
  entry: SeedEntry
  index: number
  poster: string | undefined
  labels: { mode: string; hue: string; palette: string; masses: string }
  onClick: () => void
}

function SeedCard({ entry, index, poster, labels, onClick }: SeedCardProps) {
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
          {entry.premium
            ? <>{labels.palette} {entry.paletteName}</>
            : <>{labels.mode} {entry.mode}{entry.hue !== null ? <> · {labels.hue} {entry.hue}</> : null}</>
          }
          {' '} · {labels.masses} {entry.count}
        </p>
      </div>
    </button>
  )
}

// ---- Detail view ----

interface DetailViewProps {
  entry: SeedEntry
  onBack: () => void
  backLabel: string
  modeLabel: string
  hueLabel: string
  paletteLabel: string
  massesLabel: string
}

function DetailView({ entry, onBack, backLabel, modeLabel, hueLabel, paletteLabel, massesLabel }: DetailViewProps) {
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

      {/* Live canvas in 4:3 frame (drag to orbit) */}
      <div style={{
        width: '100%', maxWidth: 700, margin: '0 auto',
        aspectRatio: '4/3',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--surface-muted)',
        cursor: 'grab',
      }}>
        <ShaderCanvas hash={entry.hash} premium={entry.premium} />
      </div>

      {/* Metadata */}
      <div style={{ maxWidth: 700, margin: '1.5rem auto 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', margin: 0, wordBreak: 'break-all' }}>
          {entry.seedInput}
        </p>
        <p style={{ fontSize: 12, color: 'var(--subtle)', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          {entry.premium
            ? <>{paletteLabel} {entry.paletteName}</>
            : <>{modeLabel} {entry.mode}{entry.hue !== null ? <> · {hueLabel} {entry.hue}</> : null}</>
          }
          {' '} · {massesLabel} {entry.count}
        </p>
        <p className="mono" style={{ fontSize: 10, color: 'var(--subtle)', margin: 0, wordBreak: 'break-all' }}>
          {entry.hash}
        </p>
      </div>

    </div>
  )
}
