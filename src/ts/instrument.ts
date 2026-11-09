// The instrument: what riffs sound like and how notes are entered (piano keys or a fretboard). One setting for
// every screen, remembered on this phone.
//
// Instruments reach different notes (a bass with 4 frets: E3–B4; the piano keys, sized for a phone: C4–G5), so a
// riff is shown, played and entered moved to fit the instrument picked: not at all if it fits, else by whole octaves,
// else by the fewest half steps (the same riff in another key; the first note is always given, so the guess works the
// same). The server keeps the riff as written; guesses are moved back before they're sent.
import { computed, ref, watch } from 'vue'
import { INSTRUMENTS, prepareInstrument, type Instrument } from './synth'

function stored(): string {
  try {
    const id = localStorage.getItem('riffs_instrument') || 'piano'
    return INSTRUMENTS.some((i) => i.id === id) ? id : 'piano'
  } catch { return 'piano' }
}

export const instrument = ref(stored())
watch(instrument, (id) => {
  try { localStorage.setItem('riffs_instrument', id) } catch { /* storage blocked: not remembered */ }
})
watch(instrument, prepareInstrument, { immediate: true })    // fetch its recordings before the first riff plays

export interface Range { lowest: number; highest: number }

/** The piano keys: C4 to G5, 12 white keys, about as many as fit a phone's width. */
export const PIANO: Range = { lowest: 60, highest: 79 }

export function instrumentOf(id: string): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]
}

/** The notes an instrument can play: open strings to the top fret (and a drone string, open), or the piano keys. */
export function rangeOf(id: string): Range {
  const i = instrumentOf(id)
  if (!i.strings) return PIANO
  const top = i.strings[i.strings.length - 1] + (i.frets ?? 4)
  return { lowest: i.strings[0], highest: Math.max(top, i.drone ?? top) }
}

/** The picked instrument's range. */
export const range = computed(() => rangeOf(instrument.value))

/**
 * How far to move these pitches so they fit the range: 0 if they fit, else the whole number of octaves closest to 0
 * that fits, else the fewest half steps. A riff too wide for the range (only riffs from before ranges differed) is
 * lined up with its bottom.
 */
export function fitShift(pitches: (number | null | undefined)[], r: Range): number {
  const ps = pitches.filter((p): p is number => p != null)
  if (!ps.length) return 0
  const lo = Math.min(...ps), hi = Math.max(...ps)
  const min = r.lowest - lo, max = r.highest - hi    // any shift in [min, max] fits
  if (min > max) return min
  if (min <= 0 && max >= 0) return 0
  const target = min > 0 ? min : max    // the end of [min, max] nearest 0
  const octave = (min > 0 ? Math.ceil(min / 12) : Math.floor(max / 12)) * 12
  return octave >= min && octave <= max ? octave : target
}

/** The range, widened if needed to hold these (already moved) pitches: only for riffs too wide to fit. */
export function rangeFor(r: Range, pitches: (number | null | undefined)[]): Range {
  const ps = pitches.filter((p): p is number => p != null)
  return ps.length ? { lowest: Math.min(r.lowest, ...ps), highest: Math.max(r.highest, ...ps) } : r
}
