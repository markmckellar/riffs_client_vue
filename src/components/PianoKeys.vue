<template>
  <!-- A one-octave piano for entering notes: C to C, black keys for sharps, ‹ › to change octave. -->
  <div class="piano_wrap">
    <div class="piano_bar">
      <button type="button" class="piano_oct" :disabled="start - 12 < minStart" aria-label="Octave down" @click="emit('update:start', start - 12)">‹</button>
      <span class="piano_oct_label">Octave {{ Math.floor(start / 12) - 1 }}</span>
      <button type="button" class="piano_oct" :disabled="start + 12 > maxStart" aria-label="Octave up" @click="emit('update:start', start + 12)">›</button>
    </div>
    <div class="piano" role="group" aria-label="Piano keys">
      <button v-for="k in whites" :key="'w' + k.midi" type="button" :disabled="k.midi < lowest || k.midi > highest"
        :class="['pk_white', { pk_on: k.midi === current }]" :aria-label="noteName(k.midi)" @click="press(k.midi)">
        <span class="pk_name">{{ k.letter }}<small>{{ Math.floor(k.midi / 12) - 1 }}</small></span>
      </button>
      <button v-for="k in blacks" :key="'b' + k.midi" type="button" :disabled="k.midi < lowest || k.midi > highest"
        :class="['pk_black', { pk_on: k.midi === current }]" :style="{ left: `calc(${k.at} * (100% / ${whites.length}) - var(--bw) / 2)` }"
        :aria-label="noteName(k.midi)" @click="press(k.midi)">
        <span class="pk_sharp">♯</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { noteName } from '../ts/music'
import { blip } from '../ts/synth'

const props = withDefaults(defineProps<{
  /** MIDI number of the leftmost C */
  start: number
  lowest?: number
  highest?: number
  /** the selected slot's note, lit on the keys */
  current?: number | null
  instrument?: string
}>(), { lowest: 55, highest: 84, current: null, instrument: 'piano' })
const emit = defineEmits<{ press: [midi: number]; 'update:start': [start: number] }>()

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11]
/** C … B, then the next C */
const whites = computed(() => [...WHITE_STEPS.map((s, i) => ({ midi: props.start + s, letter: LETTERS[i] })), { midi: props.start + 12, letter: 'C' }])
/** black keys sit on the line between two white keys (at = how many white keys from the left edge) */
const blacks = computed(() => [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]].map(([s, at]) => ({ midi: props.start + s, at })))
const minStart = computed(() => Math.floor(props.lowest / 12) * 12)
const maxStart = computed(() => Math.floor(props.highest / 12) * 12 - 12)

function press(m: number) {
  blip(m, props.instrument)
  emit('press', m)
}
</script>

<style scoped>
.piano_wrap { display: grid; gap: 4px; }
.piano_bar { display: flex; align-items: center; justify-content: center; gap: 10px; }
.piano_oct {
  width: 40px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text);
  font-size: 1.3rem; line-height: 1; cursor: pointer;
}
.piano_oct:disabled { opacity: 0.35; cursor: default; }
.piano_oct_label { font-size: 0.8rem; color: var(--text-muted); min-width: 64px; text-align: center; }
.piano { --bw: 9%; position: relative; display: flex; height: 118px; user-select: none; -webkit-user-select: none; }
.pk_white {
  flex: 1 1 0; min-width: 0; position: relative; margin: 0 1px; padding: 0 0 8px; border: 1px solid #b9b2a0; border-radius: 0 0 7px 7px;
  background: linear-gradient(#fffdf6, #efe9da); color: #3a3352; display: flex; align-items: flex-end; justify-content: center; cursor: pointer;
  box-shadow: inset 0 -4px 0 #d8d0bc;
}
.pk_white:active:not(:disabled) { background: #e7dfc9; box-shadow: inset 0 -1px 0 #d8d0bc; }
.pk_black {
  position: absolute; top: 0; width: var(--bw); height: 62%; z-index: 2; border: 1px solid #000; border-radius: 0 0 5px 5px;
  background: linear-gradient(#3b3550, #15121f); color: #c8c2dd; display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 6px; cursor: pointer; box-shadow: inset 0 -3px 0 #000;
}
.pk_black:active:not(:disabled) { background: #2a2540; }
.pk_white:disabled, .pk_black:disabled { opacity: 0.3; cursor: default; }
.pk_name { font-size: 0.85rem; font-weight: 800; }
.pk_name small { font-size: 0.6rem; font-weight: 600; opacity: 0.6; }
.pk_sharp { font-size: 0.7rem; }
.pk_white.pk_on { background: linear-gradient(#ffe08a, var(--accent)); }
.pk_black.pk_on { background: linear-gradient(#d4a514, #8a6a00); color: #fff; }
</style>
