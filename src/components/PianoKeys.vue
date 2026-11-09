<template>
  <!-- The piano keys (C4 to G5: 12 white keys, big enough to tap on a phone; ts/instrument.ts), across the full width:
       black keys for sharps, a letter on every white key, the octave number on the C keys. -->
  <div class="piano" role="group" aria-label="Piano keys">
    <button v-for="k in whites" :key="'w' + k.midi" type="button"
      :class="['pk_white', { pk_on: k.midi === current, pk_c: k.letter === 'C' }]" :aria-label="noteName(k.midi)" @click="press(k.midi)">
      <span class="pk_name">{{ k.letter }}<small v-if="k.letter === 'C'">{{ Math.floor(k.midi / 12) - 1 }}</small></span>
    </button>
    <button v-for="k in blacks" :key="'b' + k.midi" type="button" :class="['pk_black', { pk_on: k.midi === current }]"
      :style="{ left: `calc(${k.at} * (100% / ${whites.length}) - var(--bw) / 2)` }" :aria-label="noteName(k.midi)" @click="press(k.midi)">
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { noteName } from '../ts/music'
import { blip } from '../ts/synth'

const props = withDefaults(defineProps<{
  lowest?: number
  highest?: number
  /** the selected slot's note, lit on the keys */
  current?: number | null
  instrument?: string
}>(), { lowest: 60, highest: 79, current: null, instrument: 'piano' })
const emit = defineEmits<{ press: [midi: number] }>()

const LETTER: Record<number, string> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' }
const isWhite = (m: number) => ((m % 12) + 12) % 12 in LETTER
/** every white key from the lowest note to the highest */
const whites = computed(() => {
  const l: { midi: number; letter: string }[] = []
  for (let m = props.lowest; m <= props.highest; m++) if (isWhite(m)) l.push({ midi: m, letter: LETTER[((m % 12) + 12) % 12] })
  return l
})
/** black keys sit on the line between two white keys (at = how many white keys from the left edge) */
const blacks = computed(() => {
  const l: { midi: number; at: number }[] = []
  for (let m = props.lowest; m <= props.highest; m++) {
    if (isWhite(m)) continue
    const left = whites.value.findIndex((w) => w.midi === m - 1)
    if (left >= 0) l.push({ midi: m, at: left + 1 })
  }
  return l
})

function press(m: number) {
  blip(m, props.instrument)
  emit('press', m)
}
</script>

<style scoped>
/* black keys are a bit over half a white key wide */
.piano { --bw: calc(100% / v-bind('whites.length') * 0.62); position: relative; display: flex; height: 130px; user-select: none; -webkit-user-select: none; }
.pk_white {
  flex: 1 1 0; min-width: 0; position: relative; margin: 0 0.5px; padding: 0 0 6px; border: 1px solid #b9b2a0; border-radius: 0 0 5px 5px;
  background: linear-gradient(#fffdf6, #efe9da); color: #5a5274; display: flex; align-items: flex-end; justify-content: center; cursor: pointer;
  box-shadow: inset 0 -3px 0 #d8d0bc; overflow: hidden;
}
.pk_white:active { background: #e7dfc9; box-shadow: inset 0 -1px 0 #d8d0bc; }
.pk_black {
  position: absolute; top: 0; width: var(--bw); height: 60%; z-index: 2; border: 1px solid #000; border-radius: 0 0 4px 4px;
  background: linear-gradient(#3b3550, #15121f); cursor: pointer; box-shadow: inset 0 -3px 0 #000; padding: 0;
}
.pk_black:active { background: #2a2540; }
.pk_name { font-size: 0.62rem; font-weight: 700; line-height: 1; }
.pk_c .pk_name { color: #241d3a; font-weight: 800; }
.pk_name small { font-size: 0.55rem; }
.pk_white.pk_on { background: linear-gradient(#ffe08a, var(--accent)); }
.pk_black.pk_on { background: linear-gradient(#d4a514, #8a6a00); }
</style>
