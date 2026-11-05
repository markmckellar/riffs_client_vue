// The sound riffs play with: one setting for every screen, remembered on this phone.
import { ref, watch } from 'vue'

function stored(): string {
  try { return localStorage.getItem('riffs_instrument') || 'piano' } catch { return 'piano' }
}

export const instrument = ref(stored())
watch(instrument, (id) => {
  try { localStorage.setItem('riffs_instrument', id) } catch { /* storage blocked: not remembered */ }
})
