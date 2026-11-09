// How notes are entered (piano keys or a fretboard): one setting for every screen, remembered on this phone.
import { ref, watch } from 'vue'

/**
 * Strings are listed low to high, as written pitches: guitar and bass music is written an octave above how it
 * sounds, so the guitar's frets 0–5 in standard tuning (E A D G B E) are E3–A5 on the staff, the game's range.
 * The bass has the guitar's four low strings and enough frets (0–14) to reach the same top note.
 */
export interface InputMethod { id: string; name: string; emoji: string; strings?: number[]; frets?: number }

export const INPUT_METHODS: InputMethod[] = [
  { id: 'piano', name: 'Piano', emoji: '🎹' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', strings: [52, 57, 62, 67, 71, 76], frets: 5 },
  { id: 'bass', name: 'Bass', emoji: '🎸', strings: [52, 57, 62, 67], frets: 14 },
]

function stored(): string {
  try {
    const id = localStorage.getItem('riffs_input') || 'piano'
    return INPUT_METHODS.some((m) => m.id === id) ? id : 'piano'
  } catch { return 'piano' }
}

export const inputMethod = ref(stored())
watch(inputMethod, (id) => {
  try { localStorage.setItem('riffs_input', id) } catch { /* storage blocked: not remembered */ }
})
