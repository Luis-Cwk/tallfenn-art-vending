/**
 * Tall Fenn SVG engine: "caidas" family (non-masas seeds).
 * Ported from context/art.ts: buildSeedPack + buildSvgPreview.
 */
import { sha256Hex } from './seedHash'

function hueFromHash(hex: string, index: number): number {
  const slice = hex.slice(index * 2, index * 2 + 4)
  return parseInt(slice || '0', 16) % 360
}

function paletteFromHash(hash: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => `hsl(${hueFromHash(hash, i)}, 72%, 58%)`)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function buildSvgFromSeed(seedInput: string): Promise<string> {
  const hash = await sha256Hex(`${seedInput}|v1|tallfenn`)
  return buildSvgFromHash(hash)
}

export function buildSvgFromHash(seedHash: string): string {
  const palette = paletteFromHash(seedHash)
  return buildSvgPreview(seedHash, palette)
}

export function buildSvgPreview(seedHash: string, palette: string[]): string {
  const seed = parseInt(seedHash.slice(0, 8), 16) || 1
  const rand = mulberry32(seed)
  const pick = (i: number) => palette[i % palette.length] ?? '#888'

  const points: Array<[number, number]> = []
  let x = 120 + rand() * 270
  let y = 50 + rand() * 50
  for (let i = 0; i < 12; i++) {
    points.push([x, y])
    x = Math.min(460, Math.max(50, x + (rand() - 0.5) * 110))
    y += 22 + rand() * 16
  }
  const wake = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

  const marks = points
    .map(([px, py], i) => {
      const len = 10 + rand() * 16
      const tilt = -18 + rand() * 36
      const width = 2.5 + rand() * 2.5
      const x1 = px - len / 2
      const x2 = px + len / 2
      return `<line x1="${x1.toFixed(1)}" y1="${py.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${py.toFixed(1)}" transform="rotate(${tilt.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" stroke="${pick(i)}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="0.9"/>`
    })
    .join('\n  ')

  const catchY = 400 + rand() * 40
  const catchLine = `<line x1="40" y1="${catchY.toFixed(1)}" x2="472" y2="${catchY.toFixed(1)}" stroke="${pick(2)}" stroke-width="1" stroke-dasharray="6 8" opacity="0.55"/>`

  const particles = Array.from({ length: 22 }, (_, i) => {
    const px = rand() * 512
    const py = rand() * 512
    const radius = 0.8 + rand() * 1.8
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${radius.toFixed(2)}" fill="${pick(i)}" opacity="0.6"/>`
  }).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0f"/>
  <polyline points="${wake}" fill="none" stroke="${pick(0)}" stroke-width="1" opacity="0.45"/>
  ${particles}
  ${marks}
  ${catchLine}
  <text x="16" y="492" fill="#666" font-family="monospace" font-size="11">${seedHash.slice(0, 16)}</text>
</svg>`
}
