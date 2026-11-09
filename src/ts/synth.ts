// Playing riffs in the browser with the Web Audio API. Most instruments play recordings of the real thing
// (ts/samples.ts); each also has a sound made from oscillators and noise, used while its recordings load, if they
// can't be loaded, or when ENGINE says so (8-bit is always made: a chip's sound is an oscillator). Everything goes
// through a small room (reverb) and a gentle compressor, and riffs are played a little like a person would: notes
// slightly off the grid, the strong beats a little louder.
import { frequency } from './music'
import type { Note } from './api'
import { fetchSamples, hasSamples, loadSamples, nearest } from './samples'

/**
 * One list for both the sound and how notes are entered. Instruments with strings get a fretboard (open strings
 * low to high, as written pitches: guitar and bass music is written an octave above how it sounds, so they play
 * {@code transpose} -12), frets 0–4; the rest get piano keys, C4–G5 (sized for a phone). Each has its own range
 * (ts/instrument.ts), and a riff is moved to fit the one picked: guitar E3–G♯5, bass (the guitar's four low
 * strings) E3–B4, mandolin and violin (tuned alike, G3 D4 A4 E5, written as they sound, frets 0–5) G3–A5, cello (C G D A,
 * written an octave up like the guitar, so it fits the treble staff) C3–C♯5, banjo (open G, frets 0–8: a riff's widest
 * span plus one) D3–A♯4. A violin or cello has no frets ({@code fretless}): its spots are where a finger stops the string,
 * a half step apart. The banjo's short fifth string is a {@code drone}: a high g played only open.
 */
export interface Instrument {
  id: string; name: string; emoji: string; strings?: number[]; frets?: number; transpose?: number; fretless?: boolean; drone?: number
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'piano', name: 'Piano', emoji: '🎹' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', strings: [52, 57, 62, 67, 71, 76], frets: 4, transpose: -12 },
  { id: 'bass', name: 'Bass', emoji: '🎸', strings: [52, 57, 62, 67], frets: 4, transpose: -12 },
  { id: 'mandolin', name: 'Mandolin', emoji: '🪕', strings: [55, 62, 69, 76], frets: 5 },
  { id: 'violin', name: 'Violin', emoji: '🎻', strings: [55, 62, 69, 76], frets: 5, fretless: true },
  { id: 'cello', name: 'Cello', emoji: '🎻', strings: [48, 55, 62, 69], frets: 4, fretless: true, transpose: -12 },
  { id: 'banjo', name: 'Banjo', emoji: '🪕', strings: [50, 55, 59, 62], frets: 8, drone: 67 },
  { id: 'flute', name: 'Flute', emoji: '🪈' },
  { id: 'organ', name: 'Organ', emoji: '⛪' },
  { id: 'chip', name: '8-bit', emoji: '👾' },
  { id: 'bell', name: 'Bells', emoji: '🔔' },
]

/**
 * Recordings or the made sound, per instrument. Set one to 'synth' to go back to the made sound for it (a new
 * instrument without recordings uses the synth anyway). For comparing: open the page with ?sound=synth to hear every
 * instrument made, ?sound=samples to go back (remembered on the phone).
 */
const ENGINE: Record<string, 'samples' | 'synth'> = {
  piano: 'samples', guitar: 'samples', bass: 'samples', mandolin: 'samples', violin: 'samples', cello: 'samples', banjo: 'samples', flute: 'samples', organ: 'samples',
  bell: 'samples', chip: 'synth',
}

/** How much of each instrument goes to the room. */
const ROOM: Record<string, number> = { piano: 0.22, guitar: 0.16, bass: 0.12, mandolin: 0.18, violin: 0.28, cello: 0.26, banjo: 0.14, flute: 0.25, organ: 0.38, chip: 0.06, bell: 0.3 }

function allSynth(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('sound')
    if (q === 'synth' || q === 'samples') localStorage.setItem('riffs_sound', q)
    return localStorage.getItem('riffs_sound') === 'synth'
  } catch { return false }
}
const ALL_SYNTH = allSynth()

function usesSamples(id: string): boolean {
  return !ALL_SYNTH && ENGINE[id] === 'samples' && hasSamples(id)
}

/** Starts downloading an instrument's recordings, so they're ready by the time it plays. */
export function prepareInstrument(id: string) {
  if (usesSamples(id)) fetchSamples(id)
}

let ctx: AudioContext | null = null

/** The shared audio context, created (and resumed) on a user's tap, as phones require. */
export function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// ---------------------------------------------------------------------------------------------------- the room

interface Fx { dry: GainNode; room: ConvolverNode }
let fx: Fx | null = null

/**
 * A room's echo, made rather than recorded: a few early reflections, then a tail of noise that fades over about
 * 1.6 s and gets darker as it fades (walls soak up the highs first). Left and right differ, which makes it wide.
 */
function roomImpulse(c: BaseAudioContext, seconds = 1.6): AudioBuffer {
  const rate = c.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = c.createBuffer(2, len, rate)
  const decay = (3 * Math.LN10) / seconds    // -60 dB at the end
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / rate
      const k = 0.9 - 0.75 * (i / len)    // one-pole low-pass, closing as the tail fades
      lp += k * ((Math.random() * 2 - 1) - lp)
      d[i] = t < 0.012 ? 0 : lp * Math.exp(-decay * t) * 0.5
    }
    for (const [ms, level] of [[13, 0.5], [19, 0.35], [27, 0.3], [37, 0.2]] as const) {
      d[Math.floor(((ms + ch * 3) / 1000) * rate)] += (ch ? -level : level)
    }
  }
  return buf
}

function effects(c: AudioContext): Fx {
  if (fx) return fx
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 10
  comp.ratio.value = 3
  comp.attack.value = 0.004
  comp.release.value = 0.25
  comp.connect(c.destination)
  const dry = c.createGain()
  dry.connect(comp)
  const room = c.createConvolver()
  room.buffer = roomImpulse(c)
  const wet = c.createGain()
  wet.gain.value = 0.9
  room.connect(wet).connect(comp)
  fx = { dry, room }
  return fx
}

/** A bus for one riff (or one tapped note) that goes to the speakers dry and, some of it, to the room. */
function bus(c: AudioContext, inst: string, level: number): GainNode {
  const { dry, room } = effects(c)
  const g = c.createGain()
  g.gain.value = level
  g.connect(dry)
  const send = c.createGain()
  send.gain.value = ROOM[inst] ?? 0.2
  g.connect(send).connect(room)
  return g
}

// ------------------------------------------------------------------------------------------------- recordings

/** Recordings that come out quieter than the rest after evening out (a banjo's sharp attack limits how loud it can be made). */
const LEVEL: Record<string, number> = { banjo: 1.6 }

/** How long a note rings on after it's let go (a piano's damper, a hand on a string). Bells just ring out. */
const LET_GO: Record<string, number> = { piano: 0.12, guitar: 0.1, bass: 0.07, mandolin: 0.1, violin: 0.1, cello: 0.12, banjo: 0.1, flute: 0.05, organ: 0.06, bell: 0.8 }

function playSample(c: AudioContext, inst: string, s: { buffer: AudioBuffer; rate: number }, start: number, dur: number, vel: number, out: AudioNode) {
  const src = c.createBufferSource()
  src.buffer = s.buffer
  src.playbackRate.value = s.rate
  const length = s.buffer.duration / s.rate
  const amp = Math.pow(vel, 1.3) * (LEVEL[inst] ?? 1)
  const end = inst === 'bell' ? start + Math.max(dur, 1.2) : start + dur
  const tau = LET_GO[inst] ?? 0.08
  const g = c.createGain()
  g.gain.setValueAtTime(amp, start)
  g.gain.setValueAtTime(amp, end)
  g.gain.setTargetAtTime(0, end, tau)
  let node: AudioNode = src
  if (inst === 'piano' || inst === 'guitar' || inst === 'bass' || inst === 'mandolin' || inst === 'banjo') {
    // softer notes are darker as well as quieter
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800 + 16000 * Math.pow(vel, 3)
    lp.Q.value = 0.5
    node = node.connect(lp)
  }
  node.connect(g).connect(out)
  src.start(start)
  src.stop(Math.min(start + length, end + tau * 6) + 0.02)
}

// -------------------------------------------------------------------------------------------- made from scratch

let noiseBuf: AudioBuffer | null = null
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const len = c.sampleRate * 2
  noiseBuf = c.createBuffer(1, len, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

/** A short burst of filtered noise: a hammer's thump, a breath, a pipe's chiff. */
function burst(c: AudioContext, start: number, length: number, type: BiquadFilterType, f: number, q: number, level: number, out: AudioNode) {
  const src = c.createBufferSource()
  src.buffer = noise(c)
  const filt = c.createBiquadFilter()
  filt.type = type
  filt.frequency.value = Math.min(f, 16000)
  filt.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(level, start + Math.min(0.004, length / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, start + length)
  src.connect(filt).connect(g).connect(out)
  src.start(start, Math.random())
  src.stop(start + length + 0.02)
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

/** Holds at {@code level} from the attack until {@code end}, then fades with time constant {@code tau}. */
function hold(c: AudioContext, start: number, end: number, attack: number, level: number, tau: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(level, start + attack)
  g.gain.setValueAtTime(level, Math.max(start + attack, end))
  g.gain.setTargetAtTime(0, Math.max(start + attack, end), tau)
  return g
}

/**
 * Karplus–Strong plucked string: a burst of noise fed round a short delay line that averages neighbours, so it rings
 * at the line's pitch and the highs die first. The pluck is shaped by where the string is struck ({@code pick}, as a
 * fraction of its length: near the bridge is twangy) and how hard ({@code bright}); {@code t60} is how long it takes
 * to fade away (low strings ring longer). The line can only be a whole number of samples long, so the returned
 * {@code rate} plays it back at exactly the right pitch.
 */
function pluck(c: AudioContext, f: number, seconds: number, t60: number, pick: number, bright: number): { buffer: AudioBuffer; rate: number } {
  const sr = c.sampleRate
  const period = Math.max(4, Math.floor(sr / f - 0.5))
  const actual = sr / (period + 0.5)    // the averaging adds half a sample
  const ring = new Float32Array(period)
  let lp = 0
  for (let i = 0; i < period; i++) { lp += bright * ((Math.random() * 2 - 1) - lp); ring[i] = lp }
  const p = Math.max(1, Math.round(pick * period))
  const shaped = ring.map((v, i) => v - ring[(i - p + period) % period])
  let peak = 0
  for (const v of shaped) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < period; i++) ring[i] = shaped[i] / (peak || 1)
  const loss = Math.pow(0.001, 1 / (actual * t60))
  const buf = c.createBuffer(1, Math.ceil(sr * seconds), sr)
  const data = buf.getChannelData(0)
  let idx = 0
  for (let i = 0; i < data.length; i++) {
    const next = idx + 1 === period ? 0 : idx + 1
    data[i] = ring[idx]
    ring[idx] = loss * 0.5 * (ring[idx] + ring[next])
    idx = next
  }
  return { buffer: buf, rate: f / actual }
}

function playString(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode, bass: boolean) {
  const t60 = bass ? 3.5 * Math.pow(2, -Math.log2(f / 82) / 2) : 2.8 * Math.pow(2, -Math.log2(f / 165) / 1.5)
  const seconds = Math.min(dur + 0.5, 5)
  const s = pluck(c, f, seconds, t60, bass ? 0.22 : 0.13, bass ? 0.35 + 0.3 * vel : 0.5 + 0.5 * vel)
  const src = c.createBufferSource()
  src.buffer = s.buffer
  src.playbackRate.value = s.rate
  // the body: a hollow wooden box boosts a couple of low resonances
  let node: AudioNode = src
  for (const [bf, gain] of (bass ? [[90, 3], [700, -3]] : [[110, 4], [220, 3], [2600, 2]]) as [number, number][]) {
    const pk = c.createBiquadFilter()
    pk.type = 'peaking'
    pk.frequency.value = bf
    pk.Q.value = 1.4
    pk.gain.value = gain
    node = node.connect(pk)
  }
  if (bass) {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900 + 1500 * vel
    node = node.connect(lp)
  }
  const g = hold(c, start, start + dur, 0.002, (bass ? 0.9 : 0.6) * vel, 0.05)
  node.connect(g).connect(out)
  src.start(start)
  src.stop(start + seconds)
}

/**
 * A piano string is struck, not plucked: a thump, then a bright sound that drops quickly and a softer one that rings
 * on (longer for low notes). Its overtones are slightly sharp of whole multiples (stiff steel), each note has two or
 * three strings a hair apart in tune (that shimmer), and harder notes have louder high overtones.
 */
function playPiano(c: AudioContext, midi: number, start: number, dur: number, vel: number, out: AudioNode) {
  const f = frequency(midi)
  const end = start + dur
  const ring = 1.8 * Math.pow(2, -(midi - 60) / 18)
  const g = hold(c, start, end, 0.001, 0.22 * vel, 0.09)
  g.connect(out)
  const stop = end + 0.6
  for (let n = 1; n <= 10; n++) {
    const fn = n * f * Math.sqrt(1 + 0.0004 * n * n)
    if (fn > 14000) break
    const amp = Math.pow(n, -1.25) * Math.pow(vel, 0.6 * (n - 1))
    const pg = c.createGain()
    pg.gain.setValueAtTime(0, start)
    pg.gain.linearRampToValueAtTime(amp, start + 0.002)
    pg.gain.setTargetAtTime(amp * 0.3, start + 0.002, 0.12 / Math.sqrt(n))
    pg.gain.setTargetAtTime(0, start + 0.25, ring / Math.pow(n, 0.7))
    pg.connect(g)
    if (n <= 3) {
      osc(c, 'sine', fn, start, stop, pg, -1.3)
      osc(c, 'sine', fn, start, stop, pg, 1.3)
    } else {
      osc(c, 'sine', fn, start, stop, pg)
    }
  }
  burst(c, start, 0.025, 'bandpass', f * 3, 0.8, 0.08 * vel, out)
}

/** A flute: mostly a pure tone, slipping up into pitch, with breath around it and vibrato that comes in late. */
function playFlute(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  const end = start + dur
  const g = hold(c, start, end, 0.07, 0.32 * vel, 0.04)
  g.connect(out)
  const vib = c.createOscillator()
  vib.frequency.value = 5.2
  const depth = c.createGain()
  depth.gain.setValueAtTime(0, start)
  depth.gain.setValueAtTime(0, start + 0.22)
  depth.gain.linearRampToValueAtTime(f * 0.006, start + 0.6)
  vib.connect(depth)
  vib.start(start)
  vib.stop(end + 0.3)
  for (const [n, level] of [[1, 1], [2, 0.2], [3, 0.07]] as const) {
    const h = c.createGain()
    h.gain.value = level
    h.connect(g)
    const o = osc(c, 'sine', f * n, start, end + 0.3, h)
    o.frequency.setValueAtTime(f * n * 0.985, start)
    o.frequency.setTargetAtTime(f * n, start, 0.025)
    const dn = c.createGain()
    dn.gain.value = n
    depth.connect(dn).connect(o.frequency)
  }
  // breath: noise around the note's pitch for as long as it's held, and a puff at the start
  const air = c.createBufferSource()
  air.buffer = noise(c)
  air.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = f * 2
  bp.Q.value = 2
  const ag = c.createGain()
  ag.gain.value = 0.18
  air.connect(bp).connect(ag).connect(g)
  air.start(start, Math.random())
  air.stop(end + 0.3)
  burst(c, start, 0.07, 'highpass', 3000, 0.5, 0.03 * vel, out)
}

/**
 * A mandolin: pairs of strings tuned a hair apart (that jangle), plucked near the bridge with a pick, a short ring.
 */
function playMandolin(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  for (const cents of [-4, 4]) {
    const s = pluck(c, f * Math.pow(2, cents / 1200), Math.min(dur + 0.4, 3), 1.3 * Math.pow(2, -Math.log2(f / 196) / 2), 0.1, 0.6 + 0.4 * vel)
    const src = c.createBufferSource()
    src.buffer = s.buffer
    src.playbackRate.value = s.rate
    const body = c.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 400
    body.Q.value = 1.2
    body.gain.value = 4
    const g = hold(c, start, start + dur, 0.002, 0.4 * vel, 0.06)
    src.connect(body).connect(g).connect(out)
    src.start(start + (cents > 0 ? 0.004 : 0))    // the pick meets one string of the pair just after the other
    src.stop(start + Math.min(dur + 0.4, 3))
  }
}

/**
 * A violin: a bowed string is a sawtooth (the bow grabs and slips the string), shaped by the wooden body's
 * resonances, with bow noise, a slower start than a pluck, and vibrato that comes in once the note settles.
 */
function playViolin(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode, cello = false) {
  const end = start + dur
  const g = hold(c, start, end, 0.08, 0.16 * (0.6 + 0.4 * vel), 0.07)
  g.connect(out)
  const o = osc(c, 'sawtooth', f, start, end + 0.4, g)
  const vib = c.createOscillator(), depth = c.createGain()
  vib.frequency.value = 5.8
  depth.gain.setValueAtTime(0, start)
  depth.gain.setValueAtTime(0, start + 0.18)
  depth.gain.linearRampToValueAtTime(f * 0.007, start + 0.5)
  vib.connect(depth).connect(o.frequency)
  vib.start(start)
  vib.stop(end + 0.4)
  o.disconnect()
  let node: AudioNode = o
  // a cello's bigger body sits about an octave and a half lower
  const body = cello ? [[100, 5, 2], [220, 4, 2], [1200, 4, 1.2], [2500, -8, 1]] : [[280, 5, 2], [500, 3, 2], [2800, 6, 1.2], [4500, -8, 1]]
  for (const [bf, gain, q] of body as [number, number, number][]) {
    const pk = c.createBiquadFilter()
    pk.type = 'peaking'
    pk.frequency.value = bf
    pk.Q.value = q
    pk.gain.value = gain
    node = node.connect(pk)
  }
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cello ? 4000 : 7000
  node.connect(lp).connect(g)
  // the bow on the string: a little rosin noise through the note, more as it starts
  const air = c.createBufferSource()
  air.buffer = noise(c)
  air.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = Math.min(f * 4, 8000)
  bp.Q.value = 1.5
  const ag = c.createGain()
  ag.gain.value = 0.25
  air.connect(bp).connect(ag).connect(g)
  air.start(start, Math.random())
  air.stop(end + 0.4)
  burst(c, start, 0.06, 'bandpass', f * 6, 1, 0.03 * vel, out)
}

/** A banjo: a bright, twangy pluck that dies quickly (the strings drive a drum head, not a wooden box). */
function playBanjo(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  const seconds = Math.min(dur + 0.3, 2.5)
  const s = pluck(c, f, seconds, 0.9 * Math.pow(2, -Math.log2(f / 196) / 2), 0.08, 0.75 + 0.25 * vel)
  const src = c.createBufferSource()
  src.buffer = s.buffer
  src.playbackRate.value = s.rate
  const head = c.createBiquadFilter()
  head.type = 'peaking'
  head.frequency.value = 1800
  head.Q.value = 1
  head.gain.value = 6
  const thin = c.createBiquadFilter()
  thin.type = 'highpass'
  thin.frequency.value = 180
  const g = hold(c, start, start + dur, 0.001, 0.6 * vel, 0.05)
  src.connect(head).connect(thin).connect(g).connect(out)
  src.start(start)
  src.stop(start + seconds)
}

/** A pipe organ: several ranks of pipes at the octave and twelfth, a little out of tune with each other, and a chiff. */
function playOrgan(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  const end = start + dur
  const g = hold(c, start, end, 0.045, 0.12 * (0.7 + 0.3 * vel), 0.05)
  g.connect(out)
  for (const [mult, level, cents] of [[1, 1, 0], [1, 0.5, 4], [2, 0.55, -2], [3, 0.25, 1], [4, 0.25, 3], [6, 0.08, 0]] as const) {
    const h = c.createGain()
    h.gain.value = level
    h.connect(g)
    osc(c, 'sine', f * mult, start, end + 0.4, h, cents)
  }
  burst(c, start, 0.05, 'bandpass', f * 4, 1.5, 0.04, out)
}

let pulseWave: PeriodicWave | null = null
/** The 25 % pulse wave of an 8-bit console's sound chip (thinner and buzzier than a square). */
function pulse(c: AudioContext): PeriodicWave {
  if (pulseWave) return pulseWave
  const n = 64
  const real = new Float32Array(n), imag = new Float32Array(n)
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25)
  pulseWave = c.createPeriodicWave(real, imag)
  return pulseWave
}

function playChip(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  const end = start + dur * 0.92
  const g = c.createGain()
  const level = 0.16 * (0.75 + 0.25 * vel)
  g.gain.setValueAtTime(level, start)
  g.gain.setValueAtTime(level, start + 0.04)
  g.gain.linearRampToValueAtTime(level * 0.7, start + 0.15)
  g.gain.setValueAtTime(level * 0.7, Math.max(start + 0.15, end))
  g.gain.linearRampToValueAtTime(0, Math.max(start + 0.15, end) + 0.02)
  g.connect(out)
  const o = c.createOscillator()
  o.setPeriodicWave(pulse(c))
  o.frequency.value = f
  if (dur > 0.4) {
    const vib = c.createOscillator(), depth = c.createGain()
    vib.frequency.value = 6
    depth.gain.setValueAtTime(0, start)
    depth.gain.setValueAtTime(f * 0.008, start + 0.3)
    vib.connect(depth).connect(o.frequency)
    vib.start(start)
    vib.stop(end + 0.1)
  }
  o.connect(g)
  o.start(start)
  o.stop(end + 0.1)
}

/** A bell: FM (a sine whose pitch is wobbled by another at 3.5×) that rings on, with a second partial beating against it. */
function playBell(c: AudioContext, f: number, start: number, dur: number, vel: number, out: AudioNode) {
  const ring = Math.max(dur, 1.2)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(0.4 * vel, start + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, start + ring + 1.2)
  g.connect(out)
  const stop = start + ring + 1.3
  const carrier = osc(c, 'sine', f, start, stop, g)
  const second = c.createGain()
  second.gain.value = 0.25
  second.connect(g)
  osc(c, 'sine', f * 2.003, start, stop, second)
  const mod = c.createOscillator()
  const modGain = c.createGain()
  mod.frequency.value = f * 3.5
  modGain.gain.setValueAtTime(f * 2 * vel, start)
  modGain.gain.exponentialRampToValueAtTime(1, start + ring)
  mod.connect(modGain).connect(carrier.frequency)
  mod.start(start)
  mod.stop(stop)
}

function playSynth(c: AudioContext, inst: string, midi: number, start: number, dur: number, vel: number, out: AudioNode) {
  const f = frequency(midi)
  switch (inst) {
    case 'guitar': return playString(c, f, start, dur, vel, out, false)
    case 'bass': return playString(c, f, start, dur, vel, out, true)
    case 'mandolin': return playMandolin(c, f, start, dur, vel, out)
    case 'violin': return playViolin(c, f, start, dur, vel, out)
    case 'cello': return playViolin(c, f, start, dur, vel, out, true)
    case 'banjo': return playBanjo(c, f, start, dur, vel, out)
    case 'flute': return playFlute(c, f, start, dur, vel, out)
    case 'organ': return playOrgan(c, f, start, dur, vel, out)
    case 'chip': return playChip(c, f, start, dur, vel, out)
    case 'bell': return playBell(c, f, start, dur, vel, out)
    default: return playPiano(c, midi, start, dur, vel, out)
  }
}

/** One note: {@code midi} as written, held for {@code dur} seconds, {@code vel} 0–1 how hard. */
function playOne(c: AudioContext, inst: string, midi: number, start: number, dur: number, vel: number, out: AudioNode) {
  const sounding = midi + (INSTRUMENTS.find((i) => i.id === inst)?.transpose ?? 0)
  if (usesSamples(inst)) {
    const s = nearest(inst, sounding)
    if (s) return playSample(c, inst, s, start, dur, vel, out)
    void loadSamples(c, inst)    // the made sound this time, the recording next
  }
  playSynth(c, inst, sounding, start, dur, vel, out)
}

// ---------------------------------------------------------------------------------------------------- playing

/** How hard a note at this beat of the bar is played: the first beat strongest, then the third, off-beats softest. */
function velocityAt(beat: number): number {
  const inBar = ((beat % 4) + 4) % 4
  const near = (x: number) => Math.abs(inBar - x) < 0.01
  const base = near(0) ? 0.95 : near(2) ? 0.86 : Math.abs(inBar - Math.round(inBar)) < 0.01 ? 0.8 : 0.72
  return Math.min(1, Math.max(0.5, base + (Math.random() - 0.5) * 0.08))
}

/** A few milliseconds early or late, as a person plays (mostly near 0). */
function jitter(): number {
  return (Math.random() + Math.random() - 1) * 0.008
}

function samplesReady(c: AudioContext, inst: string): Promise<unknown> {
  if (!usesSamples(inst)) return Promise.resolve()
  // wait for the recordings, but not for ever: the made sound will do if they're slow
  return Promise.race([loadSamples(c, inst), new Promise((r) => setTimeout(r, 2500))])
}

export interface Playback { stop(): void; done: Promise<void> }

/**
 * Plays the notes at {@code bpm}. {@code onNote(i)} is called as note i starts (-1 when finished), for
 * highlighting it on the staff.
 */
export function play(notes: Note[], instrument: string, bpm = 100, onNote?: (i: number) => void): Playback {
  const c = audio()
  const master = bus(c, instrument, 0.9)
  const timers: number[] = []
  let stopped = false
  let finish!: () => void
  const done = new Promise<void>((resolve) => { finish = resolve })

  void samplesReady(c, instrument).then(() => {
    if (stopped) return
    const beat = 60 / bpm
    const t0 = c.currentTime + 0.08
    let t = t0, beats = 0
    notes.forEach((n, i) => {
      const dur = n.b * beat
      if (n.m !== null) playOne(c, instrument, n.m, Math.max(t0, t + (i ? jitter() : 0)), dur, velocityAt(beats), master)
      if (onNote) timers.push(window.setTimeout(() => onNote(i), (t - c.currentTime) * 1000))
      t += dur
      beats += n.b
    })
    timers.push(window.setTimeout(() => { onNote?.(-1); finish() }, (t - c.currentTime) * 1000 + 100))
    timers.push(window.setTimeout(() => master.disconnect(), (t - c.currentTime) * 1000 + 4000))
  })

  return {
    done,
    stop() {
      stopped = true
      timers.forEach(clearTimeout)
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.02)
      window.setTimeout(() => master.disconnect(), 200)
      onNote?.(-1)
      finish()
    },
  }
}

/**
 * One short note, for feedback while tapping on the staff or keys, or picking an instrument. Played the way the
 * instrument plays riffs: if its recordings are still loading (just picked), it waits for them rather than playing
 * the made sound.
 */
export function blip(midi: number, instrument: string) {
  const c = audio()
  const go = () => {
    const g = bus(c, instrument, 0.8)
    playOne(c, instrument, midi, c.currentTime + 0.01, 0.35, 0.85, g)
    window.setTimeout(() => g.disconnect(), 3500)
  }
  if (usesSamples(instrument) && !nearest(instrument, midi)) void samplesReady(c, instrument).then(go)
  else go()
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
  const noiseSrc = c.createBufferSource()
  noiseSrc.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1800
  const ng = c.createGain()
  ng.gain.value = 0.9
  noiseSrc.connect(hp).connect(ng).connect(out)
  noiseSrc.start(t)

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
