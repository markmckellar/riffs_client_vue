// Recorded instrument samples: src/samples/<instrument>/<midi>.mp3, made by tools/make_samples.bash (credits in
// src/samples/CREDITS.md). Each instrument has a recording every 3–4 half steps; a note in between plays the nearest
// one a little faster or slower. Vite gives the files fingerprinted names under /assets/, so phones keep them. An
// instrument's files (a few hundred KB) are fetched only once it's picked, and decoded once there's an audio context.

const URLS = import.meta.glob('../samples/*/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export interface Sample { midi: number; buffer: AudioBuffer }

function files(id: string): { midi: number; url: string }[] {
  const prefix = `../samples/${id}/`
  return Object.entries(URLS)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, url]) => ({ midi: Number(path.slice(prefix.length, -4)), url }))
    .sort((a, b) => a.midi - b.midi)
}

export function hasSamples(id: string): boolean {
  return files(id).length > 0
}

const fetched = new Map<string, Promise<{ midi: number; data: ArrayBuffer }[]>>()
const decoding = new Map<string, Promise<Sample[] | null>>()
const ready = new Map<string, Sample[]>()

/** Starts downloading an instrument's samples (no audio context needed, so it can run before the first tap). */
export function fetchSamples(id: string) {
  if (fetched.has(id) || !hasSamples(id)) return
  const p = Promise.all(files(id).map(async (f) => {
    const res = await fetch(f.url)
    if (!res.ok) throw new Error(`${f.url}: ${res.status}`)
    return { midi: f.midi, data: await res.arrayBuffer() }
  }))
  p.catch(() => fetched.delete(id))    // try again next time
  fetched.set(id, p)
}

/** The instrument's samples, decoded; null if they couldn't be loaded (the synth plays instead). */
export function loadSamples(c: BaseAudioContext, id: string): Promise<Sample[] | null> {
  const have = ready.get(id)
  if (have) return Promise.resolve(have)
  let p = decoding.get(id)
  if (!p) {
    fetchSamples(id)
    const raw = fetched.get(id)
    if (!raw) return Promise.resolve(null)
    p = raw
      .then((list) => Promise.all(list.map(async (s) => ({ midi: s.midi, buffer: await c.decodeAudioData(s.data) }))))
      .then((list) => { ready.set(id, list); return list })
      .catch((e) => { console.warn('samples', id, e); decoding.delete(id); fetched.delete(id); return null })
    decoding.set(id, p)
  }
  return p
}

/** The recording to play this (sounding) note with, and how fast to play it; null until loaded. */
export function nearest(id: string, midi: number): { buffer: AudioBuffer; rate: number } | null {
  const list = ready.get(id)
  if (!list?.length) return null
  let best = list[0]
  for (const s of list) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s
  return { buffer: best.buffer, rate: Math.pow(2, (midi - best.midi) / 12) }
}
