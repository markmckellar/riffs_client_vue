<template>
  <div class="staff_editor">
    <div ref="scroller" class="staff_scroll">
      <svg :viewBox="`0 0 ${width} ${height}`" class="staff_svg"
        role="img" :aria-label="ariaLabel" @pointerdown="onTap">
        <!-- the playing note's column -->
        <rect v-if="highlight >= 0 && highlight < slots.length" :x="colX(highlight) - COL / 2" y="0" :width="COL" :height="height" class="staff_playing" />
        <!-- the selected column -->
        <rect v-if="editable && selected >= 0 && selected < slots.length" :x="colX(selected) - COL / 2" y="4" :width="COL" :height="height - 8" rx="8" class="staff_selected" />
        <!-- staff lines: E4 G4 B4 D5 F5 -->
        <line v-for="s in [2, 4, 6, 8, 10]" :key="'l' + s" :x1="8" :x2="width - 8" :y1="y(s)" :y2="y(s)" class="staff_line" />
        <text :x="14" :y="y(2) + 12" class="staff_clef">𝄞</text>

        <!-- learner: where the selected note could still be -->
        <g v-if="possibleSteps.length" class="staff_possible">
          <rect v-for="p in possibleSteps" :key="'p' + p.step" :x="colX(selected) - 15" :y="y(p.step) - 4" width="30" height="8" rx="4"
            :class="{ staff_possible_sharp: p.sharpOnly }" />
        </g>
        <!-- learner: the melody's shape -->
        <g v-if="contour" class="staff_contour">
          <text v-for="(c, i) in contour" v-show="c" :key="'c' + i" :x="colX(i) - COL / 2" :y="NAME_ROW + 19">{{ c === 'up' ? '↗' : c === 'down' ? '↘' : '→' }}</text>
        </g>
        <!-- every note's name above the staff, for learning the notes -->
        <g class="staff_names">
          <text v-for="(n, i) in slots" :key="'n' + i" :x="colX(i)" :y="NAME_ROW"
            :class="{ staff_names_sel: editable && i === selected, staff_names_locked: mode === 'guess' && locked[i] != null, staff_names_dim: n.m === null }">
            <template v-if="n.m !== null">{{ letterOf(n.m) }}<tspan class="staff_names_oct" dy="2">{{ octaveOf(n.m) }}</tspan></template>
            <template v-else>{{ mode === 'guess' ? '?' : 'rest' }}</template>
          </text>
        </g>

        <!-- developers: the answer, faint grey, under each note not yet known -->
        <g v-if="peek" class="staff_peek">
          <template v-for="(m, i) in peek" :key="'pk' + i">
            <g v-if="m != null">
              <line v-for="l in ledgers(stepOf(m).step)" :key="'pl' + l" :x1="colX(i) - 13" :x2="colX(i) + 13" :y1="y(l)" :y2="y(l)" />
              <text v-if="stepOf(m).sharp" :x="colX(i) - 19" :y="y(stepOf(m).step) + 5">♯</text>
              <ellipse :cx="colX(i)" :cy="y(stepOf(m).step)" rx="7.5" ry="5.5" :transform="`rotate(-20 ${colX(i)} ${y(stepOf(m).step)})`" />
            </g>
          </template>
        </g>
        <g v-for="(n, i) in slots" :key="i">
          <!-- empty guess slot -->
          <g v-if="n.m === null && mode === 'guess'">
            <text :x="colX(i)" :y="y(6) + 9" class="staff_empty_q">?</text>
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
            <circle v-if="lengthMarks && lengthMarks[i] === 'wrong'" :cx="colX(i)" :cy="height - 14" r="11" class="mark_length" />
            <text v-if="markHints && markHints[i]" :x="colX(i)" :y="height - 10" class="mark_arrow">{{ markHints[i] === 'up' ? '↑' : '↓' }}</text>
          </g>
        </g>

        <!-- where the next note goes -->
        <g v-if="canAppend" class="staff_add">
          <rect :x="colX(slots.length) - COL / 2 + 4" y="10" :width="COL - 8" :height="height - 20" rx="8" />
          <text v-if="ghost == null" :x="colX(slots.length)" :y="y(6) + 6">+</text>
        </g>
        <!-- the note being added, before its length is chosen -->
        <g v-if="ghost != null && canAppend" class="staff_ghost">
          <line v-for="l in ledgers(stepOf(ghost).step)" :key="'gl' + l" :x1="colX(slots.length) - 13" :x2="colX(slots.length) + 13" :y1="y(l)" :y2="y(l)" class="staff_line" />
          <text v-if="stepOf(ghost).sharp" :x="colX(slots.length) - 19" :y="y(stepOf(ghost).step) + 5" class="staff_sharp">♯</text>
          <ellipse :cx="colX(slots.length)" :cy="y(stepOf(ghost).step)" rx="7.5" ry="5.5" :transform="`rotate(-20 ${colX(slots.length)} ${y(stepOf(ghost).step)})`" />
          <text :x="colX(slots.length)" :y="NAME_ROW" class="staff_ghost_name">{{ letterOf(ghost) }}<tspan class="staff_names_oct" dy="2">{{ octaveOf(ghost) }}</tspan></text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
  /** per note: 'wrong' when the guessed length was wrong (a red ring around the dot) */
  lengthMarks?: (string | null)[] | null
  markHints?: (string | null)[] | null
  highlight?: number
  maxNotes?: number
  maxRests?: number
  lowest?: number
  highest?: number
  /** the length new notes get (compose mode) */
  newLength?: number
  /** compose mode: tapping + adds a rest instead of a note */
  newRest?: boolean
  /** compose mode: a faint note at + where the player tapped, while they choose its length */
  ghost?: number | null
  instrument?: string
  /** guess mode: draw every note as a quarter (the rhythm isn't guessed) */
  plainRhythm?: boolean
  /** learner mode: the melody's shape, per note: up / down / same than the note before (first: null) */
  contour?: (string | null)[] | null
  /** learner mode: pitches the selected note could still be, from the feedback so far */
  possible?: number[] | null
  /** developers: the hidden answer per note (null where not shown), drawn faintly under the guess */
  peek?: (number | null)[] | null
}>(), {
  mode: 'compose', locked: () => [], marks: null, lengthMarks: null, markHints: null, highlight: -1, maxNotes: 8, maxRests: 2,
  lowest: 55, highest: 84, newLength: 1, newRest: false, ghost: null, instrument: 'piano', plainRhythm: false, contour: null, possible: null, peek: null,
})
const emit = defineEmits<{ 'update:modelValue': [Note[]]; add: [pitch: number]; cancel: [] }>()
const selected = defineModel<number>('selected', { default: -1 })

const COL = 36
const LEFT = 48
const HALF = 9 // half a space: one diatonic step (a bit taller, since the staff is scaled to fit the screen)
// just room for the game's notes, G3 (step -3) to C6 (step 14), with their ledger lines: no stems any more
const MAX_STEP = 15 // a step above C6
const MIN_STEP = -4 // a step below G3

const slots = computed(() => props.modelValue)
const editable = computed(() => props.mode !== 'view')
const soundingCount = computed(() => slots.value.filter((n) => n.m !== null).length)
const restCount = computed(() => slots.value.length - soundingCount.value)
const canAppend = computed(() => props.mode === 'compose'
  && (soundingCount.value < props.maxNotes || restCount.value < props.maxRests))
/**
 * The staff is scaled to the screen width (never scrolls) and always has room for the biggest riff, so every staff
 * looks the same however many notes it holds. Writing: 8 notes, 2 rests and the + column. Guessing / viewing: 8 notes
 * (more columns only if a riff with rests needs them).
 */
const columns = computed(() => (props.mode === 'compose'
  ? props.maxNotes + props.maxRests + 1
  : Math.max(slots.value.length, props.maxNotes)))
const width = computed(() => LEFT + COL * columns.value + 12)
// above the staff: a row of note names, and in learner mode a row of shape arrows under it
const NAME_ROW = 18
const TOP = computed(() => (props.contour ? 44 : 26))
function letterOf(m: number) { return noteName(m).replace(/-?\d+$/, '') }
function octaveOf(m: number) { return String(Math.floor(m / 12) - 1) }
// under the staff: the row of feedback dots when guessing, otherwise just a little margin
const BOTTOM = computed(() => (props.mode === 'guess' ? 30 : 12))
const height = computed(() => TOP.value + (MAX_STEP - MIN_STEP) * HALF + BOTTOM.value)
/** the staff positions (steps) the selected note could be at, and whether only as a sharp */
const possibleSteps = computed(() => {
  if (!props.possible || selected.value < 0) return []
  const m = new Map<number, boolean>()
  for (const p of props.possible) { const s = stepOf(p); m.set(s.step, (m.get(s.step) ?? true) && s.sharp) }
  return [...m.entries()].map(([step, sharpOnly]) => ({ step, sharpOnly }))
})
const ariaLabel = computed(() => slots.value.map((n) => (n.m === null ? 'rest' : noteName(n.m))).join(', ') || 'empty staff')

const scroller = ref<HTMLElement | null>(null)

function y(step: number) { return TOP.value + (MAX_STEP - step) * HALF }
function colX(i: number) { return LEFT + COL * i + COL / 2 }
function stepFromY(py: number) { return Math.round(MAX_STEP - (py - TOP.value) / HALF) }
function stemUp(m: number) { return stepOf(m).step < 6 }
/** with plainRhythm (every note the same length) notes are drawn as open heads with no stem, a "full note" */
function displayBeats(n: Note) { return props.plainRhythm ? 4 : n.b }

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
    // composing: tapping a note you aren't editing starts editing it (it doesn't move); while editing, a tap on
    // it moves it. Guessing: a tap always places or moves the note at once (there's nothing else to edit).
    if (props.mode === 'compose' && col !== selected.value) {
      selected.value = col
      if (notes[col].m !== null) blip(notes[col].m!, props.instrument)
      return
    }
    notes[col] = { m: pitch, b: notes[col].b }
    selected.value = col
  } else if (canAppend.value && col === notes.length) {
    // adding: the composer asks which length (a ghost note shows where); nothing is selected meanwhile
    selected.value = -1
    blip(pitch, props.instrument)
    emit('add', pitch)
    return
  } else {
    if (props.mode === 'compose') { selected.value = -1; emit('cancel') }    // a tap on empty space: stop
    return
  }
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
.staff_svg { display: block; width: 100%; height: auto; cursor: pointer; user-select: none; -webkit-user-select: none; }
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
.staff_empty_q { fill: var(--ink-soft); opacity: 0.55; font-size: 26px; font-weight: 800; text-anchor: middle; }
.staff_playing { fill: var(--accent); opacity: 0.25; }
.staff_selected { fill: var(--accent-2); opacity: 0.14; }
.staff_add rect { fill: none; stroke: var(--ink-soft); stroke-dasharray: 4 4; opacity: 0.6; }
.staff_ghost ellipse { fill: #c2410c; opacity: 0.55; }
.staff_ghost .staff_sharp { fill: #c2410c; }
.staff_ghost_name { fill: #c2410c; font-size: 15px; font-weight: 800; text-anchor: middle; }
.staff_add text { fill: var(--ink-soft); font-size: 22px; text-anchor: middle; }
.mark_exact { fill: var(--good); }
.mark_octave { fill: var(--accent-2); }
.mark_close { fill: var(--accent); }
.mark_miss { fill: var(--bad); }
.mark_length { fill: none; stroke: var(--bad); stroke-width: 2.5; stroke-dasharray: 3 2; }
.mark_arrow { fill: #1b1530; font-size: 12px; font-weight: 800; text-anchor: middle; }
.staff_possible rect { fill: var(--good); opacity: 0.35; }
.staff_possible rect.staff_possible_sharp { fill: none; stroke: var(--good); stroke-width: 1.5; stroke-dasharray: 3 2; opacity: 0.8; }
.staff_names text { fill: var(--ink); font-size: 15px; font-weight: 800; text-anchor: middle; }
.staff_names .staff_names_oct { font-size: 10px; font-weight: 600; fill: var(--ink-soft); }
.staff_names .staff_names_sel { fill: #c2410c; }
.staff_names .staff_names_locked { fill: #15803d; }
.staff_names .staff_names_dim { fill: var(--ink-soft); font-size: 11px; font-weight: 600; }
.staff_peek { opacity: 0.35; }
.staff_peek ellipse { fill: none; stroke: #6f6a80; stroke-width: 2; }
.staff_peek line { stroke: #6f6a80; stroke-width: 1.2; }
.staff_peek text { fill: #6f6a80; font-size: 17px; font-weight: 700; }
.staff_contour text { fill: #6b5bb5; font-size: 17px; font-weight: 800; text-anchor: middle; }
</style>
