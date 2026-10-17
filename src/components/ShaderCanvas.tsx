/**
 * ShaderCanvas: live p5 WEBGL instance for the "Masas" shader engine.
 * Shaders are inlined as strings (no fetch required).
 * createShader is called in setup() AFTER createCanvas(), because the WebGL
 * context does not exist before that call (using preload() is wrong here).
 */
import { useEffect, useRef, useState } from 'react'
import type p5Type from 'p5'
import type { P5Shader } from '@/lib/p5shader'
import {
  SPHERE_VERT, SPHERE_FRAG,
  applyPalette, deriveTraits, deriveScore,
  TIME_SCALE, DETAIL,
  type Traits, type Score, type Palette,
} from '@/lib/tfEngine'

interface ShaderCanvasProps {
  hash: string
  className?: string
  paused?: boolean
}

interface GeoItem {
  restx: number; resty: number; restz: number
  posx: number; posy: number; posz: number
  radius: number
  rotx: number; roty: number; rotz: number
  freq: number; speed: number; phase: number
  drift: number; sway: number; breather: boolean
  cut: number; cycle: number; cphase: number
  catchFrac: number; swing: number
  prevx: number | null; prevy: number | null
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }
function wrapZ(z: number, depth: number) {
  const span = depth * 2.0
  if (z > depth) return z - span
  if (z < -depth) return z + span
  return z
}
function depthFade(z: number, depth: number) { return 1 - 0.72 * clamp01((z + depth) / (2 * depth)) }

function defineGeometry(p: p5Type, traits: Traits, score: Score): GeoItem[] {
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

/** Extract WebGL shader/program info log for diagnostics */
function getShaderDiagnostic(gl: WebGLRenderingContext, vert: string, frag: string): string {
  const v = gl.createShader(gl.VERTEX_SHADER)
  const f = gl.createShader(gl.FRAGMENT_SHADER)
  if (!v || !f) return 'Could not create shader objects'
  gl.shaderSource(v, vert); gl.compileShader(v)
  gl.shaderSource(f, frag); gl.compileShader(f)
  const vLog = gl.getShaderInfoLog(v) ?? ''
  const fLog = gl.getShaderInfoLog(f) ?? ''
  const prog = gl.createProgram()
  let linkLog = ''
  if (prog) {
    gl.attachShader(prog, v); gl.attachShader(prog, f)
    gl.linkProgram(prog)
    linkLog = gl.getProgramInfoLog(prog) ?? ''
    gl.deleteProgram(prog)
  }
  gl.deleteShader(v); gl.deleteShader(f)
  const parts: string[] = []
  if (vLog.trim()) parts.push('VERT: ' + vLog.trim())
  if (fLog.trim()) parts.push('FRAG: ' + fLog.trim())
  if (linkLog.trim()) parts.push('LINK: ' + linkLog.trim())
  return parts.length ? parts.join('\n') : 'No errors reported but shader is null'
}

export default function ShaderCanvas({ hash, className, paused }: ShaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5Ref = useRef<p5Type | null>(null)
  const pausedRef = useRef(paused ?? false)
  const [shaderError, setShaderError] = useState<string | null>(null)

  useEffect(() => { pausedRef.current = paused ?? false }, [paused])

  useEffect(() => {
    if (!containerRef.current || !hash) return
    const container = containerRef.current
    setShaderError(null)

    const seedInt = parseInt(hash.slice(0, 8), 16) || 1
    const traits = deriveTraits(hash, { mode: 'auto', count: 0 })
    const score = deriveScore(hash)
    const pal: Palette = applyPalette('auto', hash)

    let cleanup = false

    void import('p5').then(({ default: P5 }) => {
      if (cleanup) return

      // Capture setShaderError in a ref-like closure so the sketch can call it
      let reportError: ((msg: string) => void) | null = (msg) => setShaderError(msg)

      const sketch = (p: p5Type) => {
        let sh: P5Shader | null = null
        let geo: GeoItem[] = []

        p.setup = () => {
          // Use actual measured size; fall back gracefully if container hasn't laid out yet
          const w = container.getBoundingClientRect().width || container.clientWidth || 800
          const h = container.getBoundingClientRect().height || container.clientHeight || 600
          p.createCanvas(w || 800, h || 600, p.WEBGL)
          p.randomSeed(seedInt)
          geo = defineGeometry(p, traits, score)
          p.frameRate(60)

          // createShader MUST be called after createCanvas (WebGL context exists now)
          try {
            const created = (p as unknown as { createShader: (v: string, f: string) => P5Shader | null }).createShader(SPHERE_VERT, SPHERE_FRAG)
            if (!created) {
              // Extract raw WebGL context and compile manually for diagnostics
              const rawGL = (p as unknown as { drawingContext: WebGLRenderingContext }).drawingContext
              const diag = getShaderDiagnostic(rawGL, SPHERE_VERT, SPHERE_FRAG)
              console.error('[ShaderCanvas] createShader returned null\n' + diag)
              if (reportError) reportError('Shader compilation failed:\n' + diag)
              return
            }
            sh = created
          } catch (e) {
            const msg = String((e as Error)?.message ?? e)
            console.error('[ShaderCanvas] createShader threw:', msg)
            // Try to get WebGL logs too
            try {
              const rawGL = (p as unknown as { drawingContext: WebGLRenderingContext }).drawingContext
              const diag = getShaderDiagnostic(rawGL, SPHERE_VERT, SPHERE_FRAG)
              if (reportError) reportError('Shader error: ' + msg + '\n' + diag)
            } catch {
              if (reportError) reportError('Shader error: ' + msg)
            }
            return
          }
        }

        p.draw = () => {
          if (pausedRef.current || !sh) return
          const t = (p.millis() / 1000) * TIME_SCALE * traits.tempo
          drawBackground(p, sh, pal, traits, t)
          if (traits.mode === 'seccion') drawSeccion(p, sh, pal, traits, score, t, geo)
          else drawFiel(p, sh, pal, traits, t, geo)
        }

        p.windowResized = () => {
          const rw = container.getBoundingClientRect().width || container.clientWidth || 800
          const rh = container.getBoundingClientRect().height || container.clientHeight || 600
          p.resizeCanvas(rw || 800, rh || 600)
          p.randomSeed(seedInt)
          geo = defineGeometry(p, traits, score)
        }
      }

      p5Ref.current = new P5(sketch, container)
      // Detach error reporter once mounted (sketch owns the canvas now)
      reportError = null
    })

    return () => {
      cleanup = true
      p5Ref.current?.remove()
      p5Ref.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  if (shaderError) {
    return (
      <div className={className} style={{
        width: '100%', height: '100%', background: '#1a0505',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        <p style={{ color: '#f87171', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, margin: 0, marginBottom: 6 }}>
          shader error
        </p>
        <pre style={{
          color: '#fca5a5', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto',
          background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: 4, margin: 0,
        }}>
          {shaderError}
        </pre>
      </div>
    )
  }

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}

// --- Drawing helpers ---

function setColors(sh: P5Shader, pal: Palette) {
  sh.setUniform('uObjA', pal.objA)
  sh.setUniform('uObjB', pal.objB)
  sh.setUniform('uBgDark', pal.bgDark)
  sh.setUniform('uBgCrystal', pal.bgCrystal)
  sh.setUniform('uBgBright', pal.bgBright)
  sh.setUniform('uInner', pal.inner)
  sh.setUniform('uCamShift', [0, 0])
}

function drawBackground(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number) {
  p.push()
  p.noStroke()
  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal)
  sh.setUniform('uTime', t)
  sh.setUniform('uFade', 1)
  sh.setUniform('uStyle', traits.style)
  sh.setUniform('uIsBackground', 1.0)
  p.beginShape()
  p.vertex(-p.width / 2, -p.height / 2, 0, 0, 0)
  p.vertex(p.width / 2, -p.height / 2, 0, 1, 0)
  p.vertex(p.width / 2, p.height / 2, 0, 1, 1)
  p.vertex(-p.width / 2, p.height / 2, 0, 0, 1)
  p.endShape(p.CLOSE)
  if (traits.mode === 'vuelo') {
    const panel = Math.min(p.width, p.height) * 0.7
    p.rotateZ(t * 0.15)
    p.beginShape()
    p.vertex(-panel / 2, -panel / 2, 0, 0, 0)
    p.vertex(panel / 2, -panel / 2, 0, 1, 0)
    p.vertex(panel / 2, panel / 2, 0, 1, 1)
    p.vertex(-panel / 2, panel / 2, 0, 0, 1)
    p.endShape(p.CLOSE)
  }
  p.pop()
}

function drawSeccion(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, score: Score, t: number, geo: GeoItem[]) {
  const depth = Math.min(p.width, p.height) * 0.75
  const halfW = p.width * 0.6, halfH = p.height * 0.6

  // catch line
  const restZ = -depth * score.catchDepth
  p.push()
  p.blendMode(p.ADD)
  p.resetShader()
  p.noStroke()
  p.translate(0, 0, restZ)
  p.fill(150, 255, 220, 18)
  p.plane(p.width * 2.4, 2.0)
  p.fill(190, 255, 235, 26)
  p.plane(p.width * 2.4, 0.7)
  p.pop()
  p.blendMode(p.BLEND)

  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal)
  sh.setUniform('uStyle', 1)
  sh.setUniform('uIsBackground', 0.0)

  p.push()
  p.rotateY(Math.sin(t * 0.05) * 0.05 + score.swirl * t * 0.02)

  for (let i = 0; i < geo.length; i++) {
    const g = geo[i]
    let x: number, y: number, z: number, fade: number, sc = 1

    if (g.breather) {
      x = g.posx; y = g.posy + Math.cos(t * 0.3 + g.phase) * g.sway * 0.4; z = g.posz
      fade = 1; sc = 1 + 0.07 * Math.sin(t * 0.9 + g.phase)
    } else {
      const u = (((t / g.cycle) + g.cphase) % 1 + 1) % 1
      if (u < g.catchFrac) {
        const k = u / g.catchFrac
        const e = k * k * (0.55 + 0.45 * k)
        const yStart = -halfH * 1.35, zFar = depth * 1.15
        const xStart = g.restx + g.swing * halfW * 0.55
        x = xStart + (g.restx - xStart) * e + score.attractorX * Math.sin(Math.PI * e) * 60
        y = yStart + (g.resty - yStart) * e + score.attractorY * Math.sin(Math.PI * e) * 40
        z = zFar + (g.restz - zFar) * e
        fade = Math.min(1, k / 0.14)
      } else {
        x = g.restx + Math.sin(t * 0.22 + g.phase) * 6
        y = g.resty + Math.cos(t * 0.25 + g.phase) * 4
        z = g.restz + Math.sin(t * 0.30 + g.phase) * 5
        const r = (u - g.catchFrac) / (1 - g.catchFrac)
        fade = 1 - clamp01((r - 0.62) / 0.38)
      }
    }

    const vx = g.prevx === null ? 0 : x - g.prevx
    const vy = g.prevy === null ? 1 : y - g.prevy
    g.prevx = x; g.prevy = y
    const vl = Math.hypot(vx, vy)
    const dirx = vl > 1e-3 ? vx / vl : 0
    const diry = vl > 1e-3 ? vy / vl : 1

    sh.setUniform('uTime', t); sh.setUniform('uIndex', i)
    sh.setUniform('uFreq', g.freq); sh.setUniform('uSpeed', g.speed * 0.4)
    sh.setUniform('uCut', g.cut); sh.setUniform('uVel', [dirx, diry])
    sh.setUniform('uFade', fade * depthFade(z, depth))

    p.push()
    p.translate(x, y, z)
    p.rotateX(g.rotx + t * 0.04 * g.drift)
    p.rotateY(g.roty + t * 0.05 * g.drift)
    p.rotateZ(g.rotz + t * 0.03 * g.drift)
    if (sc !== 1) p.scale(sc)
    p.sphere(g.radius, DETAIL, DETAIL)
    p.pop()
  }
  p.pop()
}

const TRAVEL_SPEED = 30

function drawFiel(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number, geo: GeoItem[]) {
  const depth = Math.min(p.width, p.height) * 0.75
  const travel = (t * TRAVEL_SPEED) % (depth * 2.0)

  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal)
  sh.setUniform('uStyle', 0)
  sh.setUniform('uIsBackground', 0.0)

  for (let i = 0; i < geo.length; i++) {
    const g = geo[i]
    sh.setUniform('uTime', t); sh.setUniform('uIndex', i)
    sh.setUniform('uFreq', g.freq); sh.setUniform('uSpeed', g.speed * 0.4)
    sh.setUniform('uCut', 0); sh.setUniform('uVel', [0, 1])

    p.push()
    let x = g.posx, y = g.posy, z = g.posz
    if (traits.mode === 'vuelo') {
      z = wrapZ(g.posz + travel, depth)
      x = g.posx + Math.sin(t * 0.25 * g.drift + g.phase) * g.sway
      y = g.posy + Math.cos(t * 0.22 * g.drift + g.phase) * g.sway * 0.6
      p.translate(x, y, z)
      p.rotateX(g.rotx + t * 0.05 * g.drift)
      p.rotateY(g.roty + t * 0.04 * g.drift)
      p.rotateZ(g.rotz + t * 0.03 * g.drift)
    } else {
      p.translate(x, y, z)
      p.rotateX(g.rotx); p.rotateY(g.roty); p.rotateZ(g.rotz)
    }
    sh.setUniform('uFade', depthFade(z, depth))
    p.sphere(g.radius, DETAIL, DETAIL)
    p.pop()
  }
}
