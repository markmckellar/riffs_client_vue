// The instrument: what riffs sound like and how notes are entered (piano keys or a fretboard). One setting for
// every screen, remembered on this phone.
import { ref, watch } from 'vue'
import { INSTRUMENTS } from './synth'

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
