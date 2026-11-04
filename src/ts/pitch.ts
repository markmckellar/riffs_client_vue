// Listening to the microphone and turning what's played or sung into notes.
// Pitch: autocorrelation of ~45 ms frames (good for one voice or instrument at a time). Notes: a pitch held
// steady for a few frames starts a note; silence or a new steady pitch ends it. Lengths are measured in beats
// at the chosen tempo and snapped to the allowed lengths.
import { midiFromFrequency, quantizeBeats } from './music'
import { audio } from './synth'
import type { Note } from './api'

/** The fundamental frequency of this frame, or null if it's quiet or unclear. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / buf.length)
  if (rms < 0.015) return null

  const n = buf.length
  const minLag = Math.floor(sampleRate / 1200) // up to ~1200 Hz (D6)
  const maxLag = Math.floor(sampleRate / 80) // down to 80 Hz
  const corr = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += buf[i] * buf[i + lag]
    corr[lag] = s
  }
  let energy = 0
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i]
  // the first peak that is close to the highest one (avoids picking an octave too low)
  let best = -1, bestVal = 0
  for (let lag = minLag; lag <= maxLag; lag++) if (corr[lag] > bestVal) { bestVal = corr[lag]; best = lag }
  if (best < 0 || bestVal / energy < 0.3) return null
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > 0.9 * bestVal && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) { best = lag; break }
  }
  // parabolic interpolation around the peak for a finer estimate
  const a = corr[best - 1] ?? 0, b = corr[best], c = corr[best + 1] ?? 0
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
  return sampleRate / (best + (Number.isFinite(shift) ? shift : 0))
}

export interface Recorder { stop(): Note[]; level: () => number; current: () => number | null }

/** Starts listening. {@code onNotes} is told each time a note is finished. */
export async function startRecording(bpm: number, lowest: number, highest: number, onNotes: (n: Note[]) => void): Promise<Recorder> {
  const c = audio()
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const src = c.createMediaStreamSource(stream)
  const analyser = c.createAnalyser()
  analyser.fftSize = 2048
  src.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  const frameMs = 30
  const beatMs = 60000 / bpm

  const notes: Note[] = []
  let cur: { midi: number; start: number } | null = null
  let candidate: { midi: number; frames: number } | null = null
  let silentSince: number | null = null
  let lastLevel = 0
  let lastPitch: number | null = null

  const close = (end: number) => {
    if (!cur) return
    const beats = quantizeBeats((end - cur.start) / beatMs)
    notes.push({ m: cur.midi, b: beats })
    cur = null
    onNotes([...notes])
  }

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf)
    let rms = 0
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
    lastLevel = Math.sqrt(rms / buf.length)
    const f = detectPitch(buf, c.sampleRate)
    const now = performance.now()
    let midi = f === null ? null : Math.round(midiFromFrequency(f))
    while (midi !== null && midi < lowest) midi += 12 // fold a low voice up into the staff
    while (midi !== null && midi > highest) midi -= 12
    lastPitch = midi
    if (midi === null) {
      candidate = null
      silentSince ??= now
      if (cur && now - silentSince > 90) close(silentSince)
      return
    }
    // a gap (a rest) between notes of more than half a beat becomes a rest
    if (!cur && silentSince !== null && notes.length > 0 && now - silentSince > beatMs * 0.75) {
      const restBeats = quantizeBeats((now - silentSince) / beatMs, [0.5, 1, 2])
      if (notes[notes.length - 1].m !== null) notes.push({ m: null, b: restBeats })
    }
    silentSince = null
    if (cur && midi === cur.midi) { candidate = null; return }
    if (candidate && candidate.midi === midi) candidate.frames++
    else candidate = { midi, frames: 1 }
    if (candidate.frames >= 3) { // ~90 ms steady: a new note
      const start = now - 2 * frameMs
      close(start)
      cur = { midi, start }
      candidate = null
    }
  }, frameMs)

  return {
    level: () => lastLevel,
    current: () => lastPitch,
    stop() {
      clearInterval(timer)
      close(performance.now())
      stream.getTracks().forEach((t) => t.stop())
      src.disconnect()
      while (notes.length && notes[notes.length - 1].m === null) notes.pop()
      return notes
    },
  }
}
