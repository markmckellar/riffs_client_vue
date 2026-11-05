// Pitches, names and where notes sit on a treble staff.

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

export function noteName(midi: number): string {
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1)
}

export function frequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiFromFrequency(f: number): number {
  return 69 + 12 * Math.log2(f / 440)
}

/** Diatonic step from C4 (C4 = 0, D4 = 1 … B3 = -1) of the natural note at or below this pitch. */
export function stepOf(midi: number): { step: number; sharp: boolean } {
  const octave = Math.floor(midi / 12) - 5 // C4 (60) → 0
  const pc = ((midi % 12) + 12) % 12
  let deg = DEGREE_SEMITONES.length - 1
  while (DEGREE_SEMITONES[deg] > pc) deg--
  return { step: octave * 7 + deg, sharp: DEGREE_SEMITONES[deg] !== pc }
}

export function midiOfStep(step: number, sharp = false): number {
  const octave = Math.floor(step / 7)
  const deg = ((step % 7) + 7) % 7
  return 60 + 12 * octave + DEGREE_SEMITONES[deg] + (sharp ? 1 : 0)
}

/** Can this natural note take a sharp (not E or B)? */
export function canSharp(step: number): boolean {
  const deg = ((step % 7) + 7) % 7
  return deg !== 2 && deg !== 6
}

/** The note lengths the composer offers. A beat is one tap of your foot. */
/** frac: the note's name as a fraction of a whole note (how musicians name them), shown on the buttons. */
export const LENGTHS: { beats: number; label: string; long: string; frac: string }[] = [
  { beats: 0.5, label: 'Eighth note', long: '½ beat, quick', frac: '⅛' },
  { beats: 1, label: 'Quarter note', long: '1 beat', frac: '¼' },
  { beats: 1.5, label: 'Dotted quarter', long: '1½ beats (the dot adds half)', frac: '⅜' },
  { beats: 2, label: 'Half note', long: '2 beats', frac: '½' },
  { beats: 3, label: 'Dotted half', long: '3 beats (the dot adds half)', frac: '¾' },
  { beats: 4, label: 'Whole note', long: '4 beats, a whole bar', frac: '1' },
]

/** The nearest allowed length to a measured number of beats. */
export function quantizeBeats(beats: number, allowed = [0.5, 1, 1.5, 2, 3, 4]): number {
  let best = allowed[0]
  for (const a of allowed) if (Math.abs(Math.log(a / beats)) < Math.abs(Math.log(best / beats))) best = a
  return best
}

export const TIER_LABEL: Record<string, string> = {
  noise: 'Noise?', ok: 'OK', musical: 'Musical', catchy: 'Catchy!',
}
