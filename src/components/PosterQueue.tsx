/**
 * PosterQueue: renders offscreen 512×512 poster images sequentially.
 * Caches in localStorage keyed by seedHash.
 * Uses the shared sketch (src/lib/tfSketch.ts); premium jobs render the
 * orbital sculpture look, so gallery thumbnails match the live view.
 */
import { useEffect, useRef } from 'react'
import { deriveScore, getPosterTime, resolveLook } from '@/lib/tfEngine'
import { makeSketch } from '@/lib/tfSketch'

const CACHE_PREFIX = 'tallfenn_poster_v1_'
const SIZE = 512

function cacheKey(seedHash: string) { return CACHE_PREFIX + seedHash.slice(0, 16) }
function getCached(seedHash: string): string | null {
  try { return localStorage.getItem(cacheKey(seedHash)) } catch { return null }
}
function setCached(seedHash: string, url: string) {
  try { localStorage.setItem(cacheKey(seedHash), url) } catch { /* storage full */ }
}

export interface PosterJob { hash: string; seedHash: string; premium?: boolean }
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

    const { hash, seedHash, premium } = job
    const { traits, pal } = resolveLook(hash, !!premium)
    const score = deriveScore(hash)
    const posterTime = getPosterTime(hash)

    void import('p5').then(({ default: P5 }) => {
      const div = document.createElement('div')
      div.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${SIZE}px;height:${SIZE}px;`
      document.body.appendChild(div)

      const sketch = makeSketch({
        hash, traits, score, pal, premium,
        posterSize: SIZE,
        posterTime,
        onPoster: (url) => {
          setCached(seedHash, url)
          onPosterRef.current(seedHash, url)
          div.remove()
          busyRef.current = false
          processNext()
        },
        onShaderError: (msg) => {
          console.error('[PosterQueue]', seedHash, msg)
          div.remove()
          busyRef.current = false
          processNext()
        },
      })

      new P5(sketch, div)
    })
  }

  return null
}
