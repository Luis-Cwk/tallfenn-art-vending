/**
 * ArtworkPreview: shows either a live ShaderCanvas (masas|) or an SVG (everything else).
 * For posters it uses the cached dataURL.
 */
import { useEffect, useState } from 'react'
import ShaderCanvas from './ShaderCanvas'
import { buildSvgFromHash } from '@/lib/tfSvg'
import { isMasasSeed, isPremiumSeed, sha256Hex } from '@/lib/seedHash'

interface ArtworkPreviewProps {
  seedInput: string
  seedHash: string   // 0x-prefixed onchain bytes32
  mode: 'live' | 'poster'
  posterUrl?: string  // supplied externally for masas posters
  className?: string
  paused?: boolean
}

export default function ArtworkPreview({ seedInput, seedHash, mode, posterUrl, className, paused }: ArtworkPreviewProps) {
  const [hash, setHash] = useState<string | null>(null)

  const isMasas = isMasasSeed(seedInput)
  // normalize seedHash to plain hex (strip 0x)
  const plainHash = seedHash.startsWith('0x') ? seedHash.slice(2) : seedHash

  // For SVG engine: compute synchronously from the plainHash (no async needed)
  const svgData = !isMasas ? buildSvgFromHash(plainHash) : null

  useEffect(() => {
    if (isMasas) {
      // For shader engine, derive hash from seedInput
      void sha256Hex(`${seedInput}|v1|tallfenn`).then((h) => { setHash(h) })
    }
  }, [seedInput, isMasas])

  if (isMasas) {
    if (mode === 'poster') {
      if (posterUrl) {
        return <img src={posterUrl} alt={seedInput} className={className} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
      }
      // silent placeholder: hairline frame, no text
      return <div className={className} style={{ background: 'var(--surface-muted)', width: '100%', height: '100%' }} />
    }
    // live
    if (!hash) return <div className={className} style={{ background: 'var(--surface-muted)', width: '100%', height: '100%' }} />
    return <ShaderCanvas hash={hash} premium={isPremiumSeed(seedInput)} className={className} paused={paused} />
  }

  // SVG engine
  if (!svgData) return <div className={className} style={{ background: 'var(--surface-muted)', width: '100%', height: '100%' }} />
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
  return <img src={svgUrl} alt={seedInput} className={className} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
}
