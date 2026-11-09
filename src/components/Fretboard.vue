<template>
  <!-- A fretboard across the full width, seen as when playing: the highest string on top (like tab), open strings left
       of the nut, then frets 1, 2, 3 … Every spot is a button with its note's letter; the selected note lights up
       everywhere it can be played. -->
  <div :class="['fretboard', { fretless }]" role="group" :aria-label="`${name} ${fretless ? 'fingerboard' : 'fretboard'}`"
    :style="{ gridTemplateColumns: `0.8fr repeat(${frets}, 1fr)`, gridTemplateRows: `repeat(${rows.length + (drone != null ? 1 : 0)}, var(--row)) 14px` }">
    <template v-for="s in rows" :key="s.open">
      <button v-for="f in frets + 1" :key="f" type="button"
        :class="['fb_spot', { fb_open: f === 1, fb_on: s.open + f - 1 === current }]"
        :style="{ '--gauge': `${s.gauge}px` }" :disabled="!inRange(s.open + f - 1)"
        :aria-label="`${noteName(s.open + f - 1)}, ${s.label} string, ${f === 1 ? 'open' : (fretless ? 'half step ' : 'fret ') + (f - 1)}`"
        @click="press(s.open + f - 1)">
        <span v-if="inRange(s.open + f - 1)" class="fb_name">{{ letter(s.open + f - 1) }}</span>
      </button>
    </template>
    <!-- a banjo's short fifth string: only played open, so just the open spot (it starts at the 5th fret) -->
    <template v-if="drone != null">
      <button type="button" :class="['fb_spot', 'fb_open', { fb_on: drone === current }]" :style="{ '--gauge': '1px' }"
        :disabled="!inRange(drone)" :aria-label="`${noteName(drone)}, short fifth string, open`" @click="press(drone)">
        <span v-if="inRange(drone)" class="fb_name">{{ letter(drone) }}</span>
      </button>
      <span class="fb_drone_rest" :style="{ gridColumn: `2 / span ${frets}` }"></span>
    </template>
    <!-- fret numbers, with the usual inlay dots at 3, 5, 7, 9, 12 (a violin has neither: half steps up the string) -->
    <span v-for="f in frets + 1" :key="'n' + f" :class="['fb_num', { fb_dot: !fretless && INLAYS.includes(f - 1) }]">{{ f === 1 ? '' : f - 1 }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { noteName } from '../ts/music'
import { blip } from '../ts/synth'

const props = withDefaults(defineProps<{
  /** open-string pitches, lowest string first */
  strings: number[]
  /** the highest fret (fret 0 = the open string) */
  frets: number
  name?: string
  lowest?: number
  highest?: number
  /** the selected slot's note, lit everywhere it can be played */
  current?: number | null
  instrument?: string
  /** no frets (a violin): no fret wires or inlays, a dark ebony fingerboard */
  fretless?: boolean
  /** a short string played only open (a banjo's high fifth string), drawn under the others as in banjo tab */
  drone?: number | null
}>(), { name: 'Guitar', lowest: 0, highest: 127, current: null, instrument: 'piano', fretless: false, drone: null })
const emit = defineEmits<{ press: [midi: number] }>()

const INLAYS = [3, 5, 7, 9, 12]
/** the highest string on top; lower strings drawn thicker */
const rows = computed(() => props.strings.map((open, i) => ({
  open, label: letter(open), gauge: 1 + (props.strings.length - 1 - i) * (props.strings.length > 4 ? 0.4 : 0.6) + (props.strings.length > 4 ? 0 : 1),
})).reverse())

function letter(m: number) { return noteName(m).replace(/-?\d+$/, '') }
function inRange(m: number) { return m >= props.lowest && m <= props.highest }
function press(m: number) {
  blip(m, props.instrument)
  emit('press', m)
}
</script>

<style scoped>
.fretboard {
  --row: v-bind("rows.length + (drone != null ? 1 : 0) > 4 ? '22px' : '30px'");
  display: grid; user-select: none; -webkit-user-select: none; padding: 4px 0 0;
  background: linear-gradient(#4a3020, #3a2416); border-radius: 6px; overflow: hidden;
}
.fb_spot {
  position: relative; min-width: 0; padding: 0; margin: 0; border: 0; border-left: 2px solid #b8b0a0; background: transparent;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
/* the string, through the middle of every spot */
.fb_spot::before {
  content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--gauge); transform: translateY(-50%);
  background: linear-gradient(#f4ecd8, #a89878); pointer-events: none;
}
/* the open strings sit left of the nut: a thick bone-coloured bar */
.fb_open { border-left: 0; border-right: 5px solid #ece4cf; background: #2c1c12; }
.fb_open + .fb_spot { border-left: 0; }
.fb_spot:active:not(:disabled) { background: rgba(255, 207, 74, 0.25); }
.fb_spot:disabled { cursor: default; opacity: 0.35; }
.fb_name {
  position: relative; z-index: 1; font-size: 0.6rem; font-weight: 700; line-height: 1; color: #f2eefe;
  background: rgba(30, 20, 14, 0.75); border-radius: 999px; padding: 2px 3px; min-width: 13px; text-align: center;
}
.fb_on .fb_name { background: var(--accent); color: var(--accent-contrast); font-size: 0.7rem; padding: 3px 4px; box-shadow: 0 0 0 2px #fff6; }
.fb_drone_rest { background: #2c1c12; }
.fretless { background: linear-gradient(#26201c, #15110e); }
.fretless .fb_spot:not(.fb_open) { border-left-color: transparent; }
.fretless .fb_num { background: #15110e; color: #a8998a; }
.fb_num { font-size: 0.6rem; color: #d9c9a8; text-align: center; line-height: 14px; background: #2c1c12; }
.fb_dot { color: var(--accent); font-weight: 800; }
</style>
