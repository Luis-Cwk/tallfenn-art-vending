/**
 * ShaderCanvas: live p5 WEBGL canvas for the "Masas" shader engine.
 * Uses the shared sketch (src/lib/tfSketch.ts) so the app and posters
 * always render the same way. Premium seeds get the orbital sculpture look.
 */
import { useEffect, useRef, useState } from 'react'
import type p5Type from 'p5'
import { deriveScore, resolveLook } from '@/lib/tfEngine'
import { makeSketch } from '@/lib/tfSketch'

interface ShaderCanvasProps {
  hash: string
  premium?: boolean
  className?: string
  paused?: boolean
}

export default function ShaderCanvas({ hash, premium, className, paused }: ShaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5Ref = useRef<p5Type | null>(null)
  const pausedRef = useRef(paused ?? false)
  const [shaderError, setShaderError] = useState<string | null>(null)

  useEffect(() => { pausedRef.current = paused ?? false }, [paused])

  useEffect(() => {
    if (!containerRef.current || !hash) return
    const container = containerRef.current
    setShaderError(null)

    const { traits, pal } = resolveLook(hash, !!premium)
    const score = deriveScore(hash)

    let cleanup = false

    void import('p5').then(({ default: P5 }) => {
      if (cleanup) return
      const measure = () => {
        const w = container.getBoundingClientRect().width || container.clientWidth || 800
        const h = container.getBoundingClientRect().height || container.clientHeight || 600
        return { w: w || 800, h: h || 600 }
      }
      const sketch = makeSketch({
        hash, traits, score, pal, premium,
        getSize: measure,
        isPaused: () => pausedRef.current,
        onShaderError: (msg) => setShaderError(msg),
      })
      p5Ref.current = new P5(sketch, container)
    })

    return () => {
      cleanup = true
      p5Ref.current?.remove()
      p5Ref.current = null
    }
  }, [hash, premium])

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
