<template>
  <div class="staff_editor">
    <div ref="scroller" class="staff_scroll">
      <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="staff_svg"
        role="img" :aria-label="ariaLabel" @pointerdown="onTap">
        <!-- the playing note's column -->
        <rect v-if="highlight >= 0 && highlight < slots.length" :x="colX(highlight) - COL / 2" y="0" :width="COL" :height="height" class="staff_playing" />
        <!-- the selected column -->
        <rect v-if="editable && selected >= 0 && selected < slots.length" :x="colX(selected) - COL / 2" y="4" :width="COL" :height="height - 8" rx="8" class="staff_selected" />
        <!-- staff lines: E4 G4 B4 D5 F5 -->
        <line v-for="s in [2, 4, 6, 8, 10]" :key="'l' + s" :x1="8" :x2="width - 8" :y1="y(s)" :y2="y(s)" class="staff_line" />
        <text :x="14" :y="y(2) + 12" class="staff_clef">𝄞</text>

        <g v-for="(n, i) in slots" :key="i">
          <!-- empty guess slot -->
          <g v-if="n.m === null && mode === 'guess'">
            <circle :cx="colX(i)" :cy="y(6)" r="9" class="staff_empty" />
            <text :x="colX(i)" :y="y(6) + 4" class="staff_empty_q">?</text>
          </g>
          <!-- rest -->
          <g v-else-if="n.m === null" class="staff_rest">
            <rect v-if="n.b >= 4" :x="colX(i) - 8" :y="y(8)" width="16" height="6" />
            <rect v-else-if="n.b >= 2" :x="colX(i) - 8" :y="y(6) - 6" width="16" height="6" />
            <path v-else-if="n.b >= 1" :d="quarterRest(colX(i))" class="staff_rest_line" />
            <g v-else>
              <circle :cx="colX(i) - 3" :cy="y(7)" r="3" />
              <path :d="`M${colX(i) - 3} ${y(7) + 2} L${colX(i) + 4} ${y(7) - 2} L${colX(i) - 2} ${y(3)}`" class="staff_rest_line" />
            </g>
          </g>
          <!-- note -->
          <g v-else :class="['staff_note', noteClass(i)]">
            <line v-for="l in ledgers(stepOf(n.m).step)" :key="'g' + l" :x1="colX(i) - 13" :x2="colX(i) + 13" :y1="y(l)" :y2="y(l)" class="staff_line" />
            <text v-if="stepOf(n.m).sharp" :x="colX(i) - 19" :y="y(stepOf(n.m).step) + 5" class="staff_sharp">♯</text>
            <ellipse :cx="colX(i)" :cy="y(stepOf(n.m).step)" rx="7.5" ry="5.5" :transform="`rotate(-20 ${colX(i)} ${y(stepOf(n.m).step)})`"
              :class="displayBeats(n) >= 2 ? 'staff_head_open' : 'staff_head'" />
            <template v-if="displayBeats(n) < 4">
              <line v-if="stemUp(n.m)" :x1="colX(i) + 6.5" :x2="colX(i) + 6.5" :y1="y(stepOf(n.m).step) - 2" :y2="y(stepOf(n.m).step) - 34" class="staff_stem" />
              <line v-else :x1="colX(i) - 6.5" :x2="colX(i) - 6.5" :y1="y(stepOf(n.m).step) + 2" :y2="y(stepOf(n.m).step) + 34" class="staff_stem" />
              <path v-if="displayBeats(n) < 1" :d="flag(colX(i), stepOf(n.m).step, stemUp(n.m))" class="staff_flag" />
              <path v-if="displayBeats(n) < 0.5" :d="flag(colX(i), stepOf(n.m).step + (stemUp(n.m) ? -1.6 : 1.6), stemUp(n.m))" class="staff_flag" />
            </template>
            <circle v-if="[0.75, 1.5, 3].includes(displayBeats(n))" :cx="colX(i) + 13" :cy="y(stepOf(n.m).step) - (stepOf(n.m).step % 2 === 0 ? 4 : 0)" r="2.2" class="staff_head" />
          </g>
          <!-- feedback from the last guess -->
          <g v-if="marks && marks[i]">
            <circle :cx="colX(i)" :cy="height - 14" r="7" :class="'mark_' + marks[i]" />
            <text v-if="markHints && markHints[i]" :x="colX(i)" :y="height - 10" class="mark_arrow">{{ markHints[i] === 'up' ? '↑' : '↓' }}</text>
          </g>
        </g>

        <!-- where the next note goes -->
        <g v-if="canAppend" class="staff_add">
          <rect :x="colX(slots.length) - COL / 2 + 4" y="10" :width="COL - 8" :height="height - 20" rx="8" />
          <text :x="colX(slots.length)" :y="y(6) + 6">+</text>
        </g>
      </svg>
    </div>
    <div v-if="editable && selectedNote && selectedNote.m !== null" class="staff_name">
      {{ noteName(selectedNote.m) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Mark, Note } from '../ts/api'
import { midiOfStep, noteName, stepOf } from '../ts/music'
import { blip } from '../ts/synth'

const props = withDefaults(defineProps<{
  modelValue: Note[]
  /** compose: add/edit notes and rests; guess: fixed slots (m null = not filled yet); view: read only */
  mode?: 'compose' | 'guess' | 'view'
  /** guess mode: notes the player already knows (shown green, can't be changed) */
  locked?: (number | null)[]
  marks?: Mark[] | null
  markHints?: (string | null)[] | null
  highlight?: number
  maxNotes?: number
  maxRests?: number
  lowest?: number
  highest?: number
  /** the length new notes get (compose mode) */
  newLength?: number
  instrument?: string
  /** guess mode: draw every note as a quarter (the rhythm isn't guessed) */
  plainRhythm?: boolean
}>(), {
  mode: 'compose', locked: () => [], marks: null, markHints: null, highlight: -1, maxNotes: 8, maxRests: 2,
  lowest: 55, highest: 84, newLength: 1, instrument: 'piano', plainRhythm: false,
})
const emit = defineEmits<{ 'update:modelValue': [Note[]] }>()
const selected = defineModel<number>('selected', { default: -1 })

const COL = 42
const LEFT = 52
const HALF = 8 // half a space: one diatonic step
const MAX_STEP = 16 // E6, room above C6
const MIN_STEP = -5 // F3, room below G3
const TOP = 10

const slots = computed(() => props.modelValue)
const editable = computed(() => props.mode !== 'view')
const soundingCount = computed(() => slots.value.filter((n) => n.m !== null).length)
const canAppend = computed(() => props.mode === 'compose' && soundingCount.value < props.maxNotes)
const width = computed(() => LEFT + COL * (slots.value.length + (canAppend.value ? 1 : 0)) + 12)
const height = computed(() => TOP + (MAX_STEP - MIN_STEP) * HALF + 34)
const selectedNote = computed(() => slots.value[selected.value])
const ariaLabel = computed(() => slots.value.map((n) => (n.m === null ? 'rest' : noteName(n.m))).join(', ') || 'empty staff')

const scroller = ref<HTMLElement | null>(null)
watch(() => slots.value.length, async (len, old) => {
  if (len > (old ?? 0)) { await nextTick(); scroller.value?.scrollTo({ left: scroller.value.scrollWidth, behavior: 'smooth' }) }
})

function y(step: number) { return TOP + (MAX_STEP - step) * HALF }
function colX(i: number) { return LEFT + COL * i + COL / 2 }
function stepFromY(py: number) { return Math.round(MAX_STEP - (py - TOP) / HALF) }
function stemUp(m: number) { return stepOf(m).step < 6 }
function displayBeats(n: Note) { return props.plainRhythm ? 1 : n.b }

function ledgers(step: number): number[] {
  const l: number[] = []
  for (let s = 0; s >= step; s -= 2) l.push(s) // C4, A3, F3
  for (let s = 12; s <= step; s += 2) l.push(s) // A5, C6, E6
  return l
}

function flag(x: number, step: number, up: boolean) {
  const yy = y(step)
  return up ? `M${x + 6.5} ${yy - 34} q 10 8 8 20` : `M${x - 6.5} ${yy + 34} q 10 -8 8 -20`
}

function quarterRest(x: number) {
  const t = y(9)
  return `M${x - 3} ${t} l 6 7 l -6 6 l 6 7 q -8 -3 -3 6`
}

function noteClass(i: number) {
  if (props.mode === 'guess' && props.locked[i] != null) return 'staff_note_locked'
  return ''
}

function clamp(m: number) { return Math.min(props.highest, Math.max(props.lowest, m)) }

function onTap(e: PointerEvent) {
  if (!editable.value) return
  const svg = e.currentTarget as SVGSVGElement
  const r = svg.getBoundingClientRect()
  const px = (e.clientX - r.left) * (width.value / r.width)
  const py = (e.clientY - r.top) * (height.value / r.height)
  const col = Math.floor((px - LEFT) / COL)
  if (col < 0) return
  const pitch = clamp(midiOfStep(stepFromY(py)))
  const notes = slots.value.map((n) => ({ ...n }))
  if (col < notes.length) {
    if (props.mode === 'guess' && props.locked[col] != null) { selected.value = col; blip(props.locked[col]!, props.instrument); return }
    notes[col] = { m: pitch, b: notes[col].b }
    selected.value = col
  } else if (canAppend.value && col === notes.length) {
    notes.push({ m: pitch, b: props.newLength })
    selected.value = notes.length - 1
  } else return
  blip(pitch, props.instrument)
  emit('update:modelValue', notes)
}
</script>

<style scoped>
.staff_editor { position: relative; }
.staff_scroll {
  overflow-x: auto;
  background: var(--paper);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--paper-edge);
  touch-action: pan-x;
}
.staff_svg { display: block; cursor: pointer; user-select: none; -webkit-user-select: none; }
.staff_line { stroke: var(--ink-soft); stroke-width: 1.2; }
.staff_clef { font-size: 64px; fill: var(--ink); font-family: "Noto Music", "Bravura", serif; }
.staff_head { fill: var(--ink); }
.staff_head_open { fill: var(--paper); stroke: var(--ink); stroke-width: 2; }
.staff_stem { stroke: var(--ink); stroke-width: 1.6; }
.staff_flag { fill: none; stroke: var(--ink); stroke-width: 2.2; }
.staff_sharp { fill: var(--ink); font-size: 17px; font-weight: 700; }
.staff_rest rect, .staff_rest circle { fill: var(--ink); }
.staff_rest_line { fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linejoin: round; }
.staff_note_locked .staff_head { fill: var(--good); }
.staff_note_locked .staff_head_open { stroke: var(--good); }
.staff_note_locked .staff_stem, .staff_note_locked .staff_flag { stroke: var(--good); }
.staff_empty { fill: none; stroke: var(--ink-soft); stroke-dasharray: 3 3; stroke-width: 1.5; }
.staff_empty_q { fill: var(--ink-soft); font-size: 12px; text-anchor: middle; }
.staff_playing { fill: var(--accent); opacity: 0.25; }
.staff_selected { fill: var(--accent-2); opacity: 0.14; }
.staff_add rect { fill: none; stroke: var(--ink-soft); stroke-dasharray: 4 4; opacity: 0.6; }
.staff_add text { fill: var(--ink-soft); font-size: 22px; text-anchor: middle; }
.mark_exact { fill: var(--good); }
.mark_octave { fill: var(--accent-2); }
.mark_close { fill: var(--accent); }
.mark_miss { fill: var(--bad); }
.mark_arrow { fill: #1b1530; font-size: 12px; font-weight: 800; text-anchor: middle; }
.staff_name {
  position: absolute; top: 8px; right: 10px; padding: 2px 8px; border-radius: 999px;
  background: var(--ink); color: var(--paper); font-size: 0.8rem; font-weight: 700; pointer-events: none;
}
</style>
