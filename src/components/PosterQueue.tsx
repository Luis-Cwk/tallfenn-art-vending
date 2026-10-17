/**
 * PosterQueue: renders offscreen 512×512 poster images sequentially.
 * Caches in localStorage keyed by seedHash.
 *
 * createShader() is called in setup(), AFTER createCanvas() (the WebGL context
 * does not exist before that call, so preload() is the wrong place for it.
 */
import { useEffect, useRef } from 'react'
import type p5Type from 'p5'
import type { P5Shader } from '@/lib/p5shader'
import {
  SPHERE_VERT, SPHERE_FRAG,
  applyPalette, deriveTraits, deriveScore, getPosterTime,
  DETAIL,
  type Traits, type Score, type Palette,
} from '@/lib/tfEngine'

const CACHE_PREFIX = 'tallfenn_poster_v1_'

function cacheKey(seedHash: string) { return CACHE_PREFIX + seedHash.slice(0, 16) }
function getCached(seedHash: string): string | null {
  try { return localStorage.getItem(cacheKey(seedHash)) } catch { return null }
}
function setCached(seedHash: string, url: string) {
  try { localStorage.setItem(cacheKey(seedHash), url) } catch { /* storage full */ }
}

interface PosterJob { hash: string; seedHash: string }
interface PosterQueueProps {
  jobs: PosterJob[]
  onPoster: (seedHash: string, url: string) => void
}

export default function PosterQueue({ jobs, onPoster }: PosterQueueProps) {
  const queueRef = useRef<PosterJob[]>([])
  const busyRef = useRef(false)
  const onPosterRef = useRef(onPoster)
  const processedRef = useRef<Set<string>>(new Set())
  useEffect(() => { onPosterRef.current = onPoster }, [onPoster])

  useEffect(() => {
    const uncached: PosterJob[] = []
    for (const job of jobs) {
      if (processedRef.current.has(job.seedHash)) continue
      processedRef.current.add(job.seedHash)
      const cached = getCached(job.seedHash)
      if (cached) {
        onPosterRef.current(job.seedHash, cached)
      } else {
        uncached.push(job)
      }
    }
    if (uncached.length > 0) {
      queueRef.current.push(...uncached)
      processNext()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  function processNext() {
    if (busyRef.current || queueRef.current.length === 0) return
    busyRef.current = true

    const job = queueRef.current.shift()
    if (!job) { busyRef.current = false; return }

    const { hash, seedHash } = job
    const traits = deriveTraits(hash, { mode: 'auto', count: 0 })
    const score = deriveScore(hash)
    const pal: Palette = applyPalette('auto', hash)
    const seedInt = parseInt(hash.slice(0, 8), 16) || 1
    const posterTime = getPosterTime(hash)

    let captured = false

    void import('p5').then(({ default: P5 }) => {
      const div = document.createElement('div')
      div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:512px;height:512px;'
      document.body.appendChild(div)

      new P5((p: p5Type) => {
        let sh: P5Shader | null = null

        p.setup = () => {
          p.createCanvas(512, 512, p.WEBGL)
          p.randomSeed(seedInt)
          p.frameRate(20)

          // createShader MUST run after createCanvas (WebGL context must exist)
          try {
            const created = (p as unknown as { createShader: (v: string, f: string) => P5Shader | null }).createShader(SPHERE_VERT, SPHERE_FRAG)
            if (created) {
              sh = created
            } else {
              console.error('[PosterQueue] createShader returned null for', seedHash)
              p.remove(); div.remove()
              busyRef.current = false; processNext()
            }
          } catch (e) {
            console.error('[PosterQueue] createShader threw:', e)
            p.remove(); div.remove()
            busyRef.current = false; processNext()
          }
        }

        p.draw = () => {
          if (captured || !sh) return
          const t = posterTime
          const geo = buildGeo(p, traits, score, seedInt)
          drawBackground(p, sh, pal, traits, t)
          if (traits.mode === 'seccion') drawSeccion(p, sh, pal, score, t, geo)
          else drawFiel(p, sh, pal, traits, t, geo)

          if (p.frameCount >= 3) {
            captured = true
            const canvas = p.drawingContext.canvas as HTMLCanvasElement
            const url = canvas.toDataURL('image/png')
            setCached(seedHash, url)
            onPosterRef.current(seedHash, url)
            p.remove()
            div.remove()
            busyRef.current = false
            processNext()
          }
        }
      }, div)
    })
  }

  return null
}

// --- Typed drawing helpers ---

interface GeoItem {
  restx: number; resty: number; restz: number
  posx: number; posy: number; posz: number
  radius: number; rotx: number; roty: number; rotz: number
  freq: number; speed: number; phase: number; drift: number; sway: number
  breather: boolean; cut: number; cycle: number; cphase: number
  catchFrac: number; swing: number; prevx: null; prevy: null
}

function buildGeo(p: p5Type, traits: Traits, score: Score, seedInt: number): GeoItem[] {
  p.randomSeed(seedInt)
  const halfW = p.width * 0.6, halfH = p.height * 0.6
  const depth = Math.min(p.width, p.height) * 0.75
  const geo: GeoItem[] = []
  for (let i = 0; i < traits.count; i++) {
    geo.push({
      restx: p.random(-halfW * 0.85, halfW * 0.85),
      resty: p.random(-halfH * 0.62, halfH * 0.62),
      restz: -depth * score.catchDepth + p.random(-depth * 0.12, depth * 0.12),
      posx: p.random(-halfW, halfW), posy: p.random(-halfH, halfH), posz: p.random(-depth, depth),
      radius: p.random(1, 75),
      rotx: p.random(-p.PI, p.PI), roty: p.random(-p.PI, p.PI), rotz: p.random(-p.PI, p.PI),
      freq: p.random(10, 100), speed: p.random(1, 10), phase: p.random(p.TWO_PI),
      drift: p.random(0.6, 1.6), sway: p.random(10, 45),
      breather: p.random() < score.breath,
      cut: p.random() < traits.cut ? 1 : 0,
      cycle: p.random(9, 17), cphase: p.random(),
      catchFrac: 0.34 + p.random() * 0.42, swing: p.random(-1, 1),
      prevx: null, prevy: null,
    })
  }
  return geo
}

function setColors(sh: P5Shader, pal: Palette) {
  sh.setUniform('uObjA', pal.objA); sh.setUniform('uObjB', pal.objB)
  sh.setUniform('uBgDark', pal.bgDark); sh.setUniform('uBgCrystal', pal.bgCrystal)
  sh.setUniform('uBgBright', pal.bgBright); sh.setUniform('uInner', pal.inner)
  sh.setUniform('uCamShift', [0, 0])
}

function drawBackground(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number) {
  p.push(); p.noStroke()
  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal)
  sh.setUniform('uTime', t); sh.setUniform('uFade', 1)
  sh.setUniform('uStyle', traits.style); sh.setUniform('uIsBackground', 1.0)
  p.beginShape()
  p.vertex(-p.width / 2, -p.height / 2, 0, 0, 0); p.vertex(p.width / 2, -p.height / 2, 0, 1, 0)
  p.vertex(p.width / 2, p.height / 2, 0, 1, 1); p.vertex(-p.width / 2, p.height / 2, 0, 0, 1)
  p.endShape(p.CLOSE); p.pop()
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }
function depthFade(z: number, depth: number) { return 1 - 0.72 * clamp01((z + depth) / (2 * depth)) }

function drawSeccion(p: p5Type, sh: P5Shader, pal: Palette, score: Score, t: number, geo: GeoItem[]) {
  const depth = Math.min(p.width, p.height) * 0.75
  const halfH = p.height * 0.6
  p.shader(sh as unknown as Parameters<typeof p.shader>[0]); setColors(sh, pal)
  sh.setUniform('uStyle', 1); sh.setUniform('uIsBackground', 0.0)
  p.push()
  for (const g of geo) {
    const u = (((t / g.cycle) + g.cphase) % 1 + 1) % 1
    let x: number, y: number, z: number, fade: number
    if (u < g.catchFrac) {
      const k = u / g.catchFrac, e = k * k * (0.55 + 0.45 * k)
      x = g.restx + score.attractorX * Math.sin(Math.PI * e) * 60
      y = -halfH * 1.35 + (g.resty + halfH * 1.35) * e + score.attractorY * Math.sin(Math.PI * e) * 40
      z = depth * 1.15 + (g.restz - depth * 1.15) * e; fade = Math.min(1, k / 0.14)
    } else {
      x = g.restx; y = g.resty; z = g.restz; fade = 1
    }
    sh.setUniform('uTime', t); sh.setUniform('uIndex', 0)
    sh.setUniform('uFreq', g.freq); sh.setUniform('uSpeed', g.speed * 0.4)
    sh.setUniform('uCut', g.cut); sh.setUniform('uVel', [0, 1])
    sh.setUniform('uFade', fade * depthFade(z, depth))
    p.push(); p.translate(x, y, z)
    p.rotateX(g.rotx); p.rotateY(g.roty); p.rotateZ(g.rotz)
    p.sphere(g.radius, DETAIL, DETAIL); p.pop()
  }
  p.pop()
}

function drawFiel(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number, geo: GeoItem[]) {
  const depth = Math.min(p.width, p.height) * 0.75
  p.shader(sh as unknown as Parameters<typeof p.shader>[0]); setColors(sh, pal)
  sh.setUniform('uStyle', 0); sh.setUniform('uIsBackground', 0.0)
  for (const g of geo) {
    const z = traits.mode === 'vuelo' ? ((g.posz + t * 30) % (depth * 2)) - depth : g.posz
    sh.setUniform('uTime', t); sh.setUniform('uIndex', 0)
    sh.setUniform('uFreq', g.freq); sh.setUniform('uSpeed', g.speed * 0.4)
    sh.setUniform('uCut', 0); sh.setUniform('uVel', [0, 1])
    sh.setUniform('uFade', depthFade(z, depth))
    p.push(); p.translate(g.posx, g.posy, z)
    p.rotateX(g.rotx); p.rotateY(g.roty); p.rotateZ(g.rotz)
    p.sphere(g.radius, DETAIL, DETAIL); p.pop()
  }
}
