/**
 * tfSketch: single drawing implementation for the "Masas semiredondas" engine.
 * ShaderCanvas (live) and PosterQueue (offscreen posters) both use makeSketch,
 * so the look stays identical in every surface.
 *
 * Modes: seccion | vuelo | campo (standard) and orbita (premium: orbital sculpture).
 * Drag to orbit the camera is available in every mode on the live canvas.
 */
import type p5Type from 'p5'
import type { P5Shader } from '@/lib/p5shader'
import { SPHERE_VERT, SPHERE_FRAG, DETAIL, TIME_SCALE, type Traits, type Score, type Palette } from '@/lib/tfEngine'

const TRAVEL_SPEED = 30

export interface GeoItem {
  orbitRadius: number
  orbitSpeed: number
  orbitAngle: number
  orbitTilt: number
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

export interface SketchOptions {
  hash: string
  traits: Traits
  score: Score
  pal: Palette
  premium?: boolean
  /** Live canvas size source. Omit for poster mode. */
  getSize?: () => { w: number; h: number }
  isPaused?: () => boolean
  posterSize?: number
  posterTime?: number
  onPoster?: (dataUrl: string) => void
  onShaderError?: (message: string) => void
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }

function wrapZ(z: number, depth: number) {
  const span = depth * 2.0
  if (z > depth) return z - span
  if (z < -depth) return z + span
  return z
}

function depthFade(z: number, depth: number) { return 1 - 0.72 * clamp01((z + depth) / (2 * depth)) }

export function defineGeometry(p: p5Type, traits: Traits, score: Score): GeoItem[] {
  const halfW = p.width * 0.6, halfH = p.height * 0.6
  const depth = Math.min(p.width, p.height) * 0.75
  const premiumOrbit = traits.mode === 'orbita'
  const geo: GeoItem[] = []
  for (let i = 0; i < traits.count; i++) {
    geo.push({
      orbitRadius: premiumOrbit ? 0.10 + p.random() * 0.42 : 0,
      orbitSpeed: premiumOrbit ? (0.06 + p.random() * 0.22) * (p.random() < 0.5 ? -1 : 1) : 0,
      orbitAngle: p.random() * p.TWO_PI,
      orbitTilt: premiumOrbit ? 0.25 + p.random() * 0.75 : 0,
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
export function getShaderDiagnostic(gl: WebGLRenderingContext, vert: string, frag: string): string {
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

function setColors(sh: P5Shader, pal: Palette, premium: boolean) {
  sh.setUniform('uObjA', pal.objA); sh.setUniform('uObjB', pal.objB)
  sh.setUniform('uBgDark', pal.bgDark); sh.setUniform('uBgCrystal', pal.bgCrystal)
  sh.setUniform('uBgBright', pal.bgBright); sh.setUniform('uInner', pal.inner)
  sh.setUniform('uPremium', premium ? 1 : 0)
  sh.setUniform('uAccent', pal.accent ?? pal.bgBright)
}

function drawBackground(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number, premium: boolean) {
  p.push(); p.noStroke()
  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal, premium)
  sh.setUniform('uTime', t); sh.setUniform('uFade', 1)
  sh.setUniform('uStyle', traits.style); sh.setUniform('uIsBackground', 1.0)
  p.beginShape()
  p.vertex(-p.width / 2, -p.height / 2, 0, 0, 0); p.vertex(p.width / 2, -p.height / 2, 0, 1, 0)
  p.vertex(p.width / 2, p.height / 2, 0, 1, 1); p.vertex(-p.width / 2, p.height / 2, 0, 0, 1)
  p.endShape(p.CLOSE)
  if (traits.mode === 'vuelo') {
    const panel = Math.min(p.width, p.height) * 0.7
    p.rotateZ(t * 0.15)
    p.beginShape()
    p.vertex(-panel / 2, -panel / 2, 0, 0, 0); p.vertex(panel / 2, -panel / 2, 0, 1, 0)
    p.vertex(panel / 2, panel / 2, 0, 1, 1); p.vertex(-panel / 2, panel / 2, 0, 0, 1)
    p.endShape(p.CLOSE)
  }
  p.pop()
}

function drawCatchLine(p: p5Type, score: Score, depth: number) {
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
}

function drawSeccion(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, score: Score, t: number, geo: GeoItem[], premium: boolean) {
  const depth = Math.min(p.width, p.height) * 0.75
  const halfW = p.width * 0.6, halfH = p.height * 0.6

  drawCatchLine(p, score, depth)

  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal, premium)
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
        const r = (u - g.catchFrac) / (1 - g.catchFrac)
        x = g.restx + Math.sin(t * 0.22 + g.phase) * 6
        y = g.resty + Math.cos(t * 0.25 + g.phase) * 4
        z = g.restz + Math.sin(t * 0.30 + g.phase) * 5
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

/** PREMIUM: a slow orbital sculpture of bodies around the centre. */
function drawOrbita(p: p5Type, sh: P5Shader, pal: Palette, t: number, geo: GeoItem[], premium: boolean) {
  const minSide = Math.min(p.width, p.height)
  const orbitScale = minSide * 0.95

  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal, premium)
  sh.setUniform('uStyle', 1)
  sh.setUniform('uIsBackground', 0.0)

  for (let i = 0; i < geo.length; i++) {
    const g = geo[i]
    const a = g.orbitAngle + t * g.orbitSpeed * 0.35
    const r = g.orbitRadius * orbitScale
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r * g.orbitTilt
    const z = g.posz * 0.45 + Math.sin(a * 1.7 + g.phase) * minSide * 0.06

    sh.setUniform('uTime', t); sh.setUniform('uIndex', i)
    sh.setUniform('uFreq', g.freq); sh.setUniform('uSpeed', g.speed * 0.4)
    sh.setUniform('uCut', g.cut); sh.setUniform('uVel', [Math.cos(a + 1.5708), Math.sin(a + 1.5708)])
    sh.setUniform('uFade', depthFade(z, minSide * 0.75))

    p.push()
    p.translate(x, y, z)
    p.rotateX(g.rotx + t * 0.25 * g.drift)
    p.rotateY(g.roty + t * 0.30 * g.drift)
    p.rotateZ(g.rotz + t * 0.20 * g.drift)
    p.sphere(g.radius, DETAIL, DETAIL)
    p.pop()
  }
}

function drawFiel(p: p5Type, sh: P5Shader, pal: Palette, traits: Traits, t: number, geo: GeoItem[], premium: boolean) {
  const depth = Math.min(p.width, p.height) * 0.75
  const travel = (t * TRAVEL_SPEED) % (depth * 2.0)

  p.shader(sh as unknown as Parameters<typeof p.shader>[0])
  setColors(sh, pal, premium)
  sh.setUniform('uStyle', 0); sh.setUniform('uIsBackground', 0.0)

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

/**
 * Shared sketch factory. createShader runs in setup() AFTER createCanvas(),
 * because the WebGL context does not exist before that call.
 */
export function makeSketch(opts: SketchOptions): (p: p5Type) => void {
  const premium = !!opts.premium
  return (p: p5Type) => {
    let sh: P5Shader | null = null
    let geo: GeoItem[] = []
    let camX = 0
    let camY = 0
    let captured = false
    const seedInt = parseInt(opts.hash.slice(0, 8), 16) || 1

    p.setup = () => {
      if (opts.posterSize) {
        p.createCanvas(opts.posterSize, opts.posterSize, p.WEBGL)
        p.frameRate(20)
      } else {
        const size = opts.getSize ? opts.getSize() : { w: p.windowWidth, h: p.windowHeight }
        p.createCanvas(size.w || 800, size.h || 600, p.WEBGL)
        p.frameRate(60)
      }
      p.randomSeed(seedInt)
      geo = defineGeometry(p, opts.traits, opts.score)

      try {
        const created = (p as unknown as { createShader: (v: string, f: string) => P5Shader | null }).createShader(SPHERE_VERT, SPHERE_FRAG)
        if (created) {
          sh = created
        } else if (opts.onShaderError) {
          const rawGL = (p as unknown as { drawingContext: WebGLRenderingContext }).drawingContext
          opts.onShaderError('Shader compilation failed:\n' + getShaderDiagnostic(rawGL, SPHERE_VERT, SPHERE_FRAG))
        }
      } catch (e) {
        if (opts.onShaderError) {
          const msg = String((e as Error)?.message ?? e)
          try {
            const rawGL = (p as unknown as { drawingContext: WebGLRenderingContext }).drawingContext
            opts.onShaderError('Shader error: ' + msg + '\n' + getShaderDiagnostic(rawGL, SPHERE_VERT, SPHERE_FRAG))
          } catch {
            opts.onShaderError('Shader error: ' + msg)
          }
        }
      }
    }

    p.draw = () => {
      if (!sh) return
      const t = opts.posterSize
        ? (opts.posterTime ?? 12)
        : (p.millis() / 1000) * TIME_SCALE * opts.traits.tempo

      if (!opts.posterSize && opts.isPaused?.()) return

      drawBackground(p, sh, opts.pal, opts.traits, t, premium)

      p.push()
      p.rotateY(camY)
      p.rotateX(camX)
      if (opts.traits.mode === 'orbita') drawOrbita(p, sh, opts.pal, t, geo, premium)
      else if (opts.traits.mode === 'seccion') drawSeccion(p, sh, opts.pal, opts.traits, opts.score, t, geo, premium)
      else drawFiel(p, sh, opts.pal, opts.traits, t, geo, premium)
      p.pop()

      if (opts.posterSize && !captured && p.frameCount >= 4) {
        captured = true
        const canvas = p.drawingContext.canvas as HTMLCanvasElement
        if (opts.onPoster) opts.onPoster(canvas.toDataURL('image/png'))
        p.remove()
      }
    }

    if (!opts.posterSize) {
      p.windowResized = () => {
        const size = opts.getSize ? opts.getSize() : { w: p.windowWidth, h: p.windowHeight }
        p.resizeCanvas(size.w || 800, size.h || 600)
        p.randomSeed(seedInt)
        geo = defineGeometry(p, opts.traits, opts.score)
      }

      // Drag to orbit the sculpture.
      p.mouseDragged = () => {
        camY += (p.mouseX - p.pmouseX) * 0.004
        camX += (p.mouseY - p.pmouseY) * 0.003
        camX = Math.max(-1.2, Math.min(1.2, camX))
      }
    }
  }
}
