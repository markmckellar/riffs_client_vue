// Playing riffs in the browser with the Web Audio API. Every instrument is made from oscillators or a short
// generated buffer, so nothing has to be downloaded and the server only ever sends notes.
import { frequency } from './music'
import type { Note } from './api'

/**
 * One list for both the sound and how notes are entered. Instruments with strings get a fretboard (open strings
 * low to high, as written pitches: guitar and bass music is written an octave above how it sounds, so a guitar's
 * frets 0–5 in standard tuning are E3–A5, the game's range); the rest get piano keys. The bass has the guitar's
 * four low strings and frets 0–14, to reach the same top note.
 */
export interface Instrument { id: string; name: string; emoji: string; strings?: number[]; frets?: number }

export const INSTRUMENTS: Instrument[] = [
  { id: 'piano', name: 'Piano', emoji: '🎹' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', strings: [52, 57, 62, 67, 71, 76], frets: 5 },
  { id: 'bass', name: 'Bass', emoji: '🎸', strings: [52, 57, 62, 67], frets: 14 },
  { id: 'flute', name: 'Flute', emoji: '🪈' },
  { id: 'organ', name: 'Organ', emoji: '⛪' },
  { id: 'chip', name: '8-bit', emoji: '👾' },
  { id: 'bell', name: 'Bells', emoji: '🔔' },
]

let ctx: AudioContext | null = null

/** The shared audio context, created (and resumed) on a user's tap, as phones require. */
export function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function envelope(c: AudioContext, start: number, dur: number, attack: number, peak: number, sustain: number, release: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), start + Math.max(attack + 0.01, dur))
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release)
  return g
}

function osc(c: AudioContext, type: OscillatorType, f: number, start: number, stop: number, out: AudioNode, detune = 0) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = f
  o.detune.value = detune
  o.connect(out)
  o.start(start)
  o.stop(stop)
  return o
}

/** Karplus–Strong plucked string: a burst of noise fed through a short averaging delay line. */
function pluckBuffer(c: AudioContext, f: number, seconds: number): AudioBuffer {
  const rate = c.sampleRate
  const buf = c.createBuffer(1, Math.ceil(rate * seconds), rate)
  const data = buf.getChannelData(0)
  const period = Math.max(2, Math.round(rate / f))
  const ring = new Float32Array(period)
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1
  let idx = 0
  for (let i = 0; i < data.length; i++) {
    const next = (idx + 1) % period
    const v = 0.5 * (ring[idx] + ring[next]) * 0.996
    data[i] = ring[idx]
    ring[idx] = v
    idx = next
  }
  return buf
}

function playOne(c: AudioContext, inst: string, midi: number, start: number, dur: number, out: AudioNode) {
  const f = frequency(midi)
  switch (inst) {
    case 'guitar': {
      const src = c.createBufferSource()
      src.buffer = pluckBuffer(c, f, dur + 0.6)
      const g = envelope(c, start, dur, 0.003, 0.9, 0.5, 0.15)
      src.connect(g).connect(out)
      src.start(start)
      src.stop(start + dur + 0.6)
      break
    }
    case 'bass': {
      // a plucked string an octave down (bass is written an octave above how it sounds), with the brightness rolled off
      const src = c.createBufferSource()
      src.buffer = pluckBuffer(c, f / 2, dur + 0.8)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = Math.min(2000, f * 3)
      const g = envelope(c, start, dur, 0.004, 1.2, 0.6, 0.15)
      src.connect(lp).connect(g).connect(out)
      src.start(start)
      src.stop(start + dur + 0.8)
      break
    }
    case 'flute': {
      const g = envelope(c, start, dur, 0.08, 0.5, 0.85, 0.12)
      g.connect(out)
      const o = osc(c, 'sine', f, start, start + dur + 0.2, g)
      const lfo = c.createOscillator()
      const depth = c.createGain()
      lfo.frequency.value = 5
      depth.gain.value = f * 0.006
      lfo.connect(depth).connect(o.frequency)
      lfo.start(start)
      lfo.stop(start + dur + 0.2)
      break
    }
    case 'organ': {
      const g = envelope(c, start, dur, 0.02, 0.22, 1, 0.06)
      g.connect(out)
      for (const [mult, level] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]] as const) {
        const h = c.createGain()
        h.gain.value = level
        h.connect(g)
        osc(c, 'sine', f * mult, start, start + dur + 0.1, h)
      }
      break
    }
    case 'chip': {
      const g = envelope(c, start, dur * 0.9, 0.005, 0.18, 0.7, 0.03)
      g.connect(out)
      osc(c, 'square', f, start, start + dur, g)
      break
    }
    case 'bell': {
      // FM: a sine carrier whose frequency is wobbled by a sine at 3.5× the pitch
      const g = envelope(c, start, Math.max(dur, 0.8), 0.002, 0.5, 0.05, 0.6)
      g.connect(out)
      const carrier = osc(c, 'sine', f, start, start + dur + 1.5, g)
      const mod = c.createOscillator()
      const modGain = c.createGain()
      mod.frequency.value = f * 3.5
      modGain.gain.setValueAtTime(f * 2, start)
      modGain.gain.exponentialRampToValueAtTime(1, start + dur + 1.2)
      mod.connect(modGain).connect(carrier.frequency)
      mod.start(start)
      mod.stop(start + dur + 1.5)
      break
    }
    default: { // piano-ish: bright attack that decays
      const g = envelope(c, start, dur, 0.005, 0.55, 0.25, 0.25)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(f * 8, start)
      lp.frequency.exponentialRampToValueAtTime(f * 2, start + dur + 0.2)
      g.connect(lp).connect(out)
      osc(c, 'triangle', f, start, start + dur + 0.3, g)
      osc(c, 'sine', f * 2, start, start + dur + 0.3, g, 3)
    }
  }
}

export interface Playback { stop(): void; done: Promise<void> }

/**
 * Plays the notes at {@code bpm}. {@code onNote(i)} is called as note i starts (-1 when finished), for
 * highlighting it on the staff.
 */
export function play(notes: Note[], instrument: string, bpm = 100, onNote?: (i: number) => void): Playback {
  const c = audio()
  const master = c.createGain()
  master.gain.value = 0.8
  master.connect(c.destination)
  const beat = 60 / bpm
  const t0 = c.currentTime + 0.08
  let t = t0
  const timers: number[] = []
  notes.forEach((n, i) => {
    const dur = n.b * beat
    if (n.m !== null) playOne(c, instrument, n.m, t, dur * 0.95, master)
    if (onNote) timers.push(window.setTimeout(() => onNote(i), (t - c.currentTime) * 1000))
    t += dur
  })
  let finish!: () => void
  const done = new Promise<void>((resolve) => { finish = resolve })
  const end = window.setTimeout(() => { onNote?.(-1); finish() }, (t - c.currentTime) * 1000 + 100)
  return {
    done,
    stop() {
      timers.forEach(clearTimeout)
      clearTimeout(end)
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.02)
      window.setTimeout(() => master.disconnect(), 200)
      onNote?.(-1)
      finish()
    },
  }
}

/** One short note, for feedback while tapping on the staff. */
export function blip(midi: number, instrument: string) {
  const c = audio()
  const g = c.createGain()
  g.gain.value = 0.7
  g.connect(c.destination)
  playOne(c, instrument, midi, c.currentTime + 0.01, 0.35, g)
}

/**
 * A guitar string breaking: a sharp crack (a burst of high noise) and a twang that slides down as the loose
 * string goes slack. Made on the fly like the instruments, nothing to download.
 */
export function snap(delay = 0) {
  const c = audio()
  const t = c.currentTime + 0.02 + delay
  const out = c.createGain()
  out.gain.value = 0.6
  out.connect(c.destination)

  // the crack
  const len = Math.floor(c.sampleRate * 0.06)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const noise = c.createBufferSource()
  noise.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1800
  const ng = c.createGain()
  ng.gain.value = 0.9
  noise.connect(hp).connect(ng).connect(out)
  noise.start(t)

  // the twang, sliding down
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(420, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.45)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(3000, t)
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.45)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.35, t + 0.005)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  o.connect(lp).connect(og).connect(out)
  o.start(t)
  o.stop(t + 0.55)
  window.setTimeout(() => out.disconnect(), (delay + 0.8) * 1000)
}
