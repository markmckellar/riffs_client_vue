<template>
  <section class="guesser">
    <header class="guesser_head">
      <h2>Guess the riff</h2>
      <span class="muted">{{ round.length }} notes · first note given</span>
      <HelpSheet title="How to guess a riff" storage-key="riffs_help_guess">
        <p>Listen to the riff, then write it down on the staff. The <b>first note is given</b> (green), so you can
          work out the rest from it: is the next one higher or lower, a small step or a jump?</p>
        <h3>Buttons</h3>
        <dl>
          <dt>▶</dt><dd><b>Play the riff</b> as often as you like. Slide Tempo left to slow it down.</dd>
          <dt>?</dt><dd>An empty slot. Tap the staff above it to put a note there; tap again to move it.</dd>
          <dt>▲♯ ▼♭</dt><dd>Move the selected note up or down a half step (sharps and flats).</dd>
          <dt>▶ My</dt><dd>Play your guess with the riff's rhythm, to compare by ear.</dd>
          <dt>Clear</dt><dd>Empty your guess notes. Known (green) notes stay.</dd>
          <dt>Guess!</dt><dd>Check it. Every note gets a coloured dot.</dd>
        </dl>
        <h3>The dots</h3>
        <dl>
          <dt><i class="dot mark_exact"></i></dt><dd><b>Right.</b> It stays filled in.</dd>
          <dt><i class="dot mark_octave"></i></dt><dd>Right note name, wrong octave: try 8 notes higher or lower.</dd>
          <dt><i class="dot mark_close"></i></dt><dd><b>Close</b> (1–2 half steps off). The arrow says go higher ↑ or lower ↓.</dd>
          <dt><i class="dot mark_miss"></i></dt><dd>Miss.</dd>
        </dl>
        <h3>Strings and Encores</h3>
        <p>Each wrong guess snaps a guitar string. Run out of strings and you lose an Encore 🎤; lose all your Encores and the
          game is over. Either way, after the riff it's your turn to write one.</p>
        <dl>
          <dt>💡</dt><dd><b>Hint:</b> fills in one note.</dd>
          <dt>🎸</dt><dd><b>+String:</b> one more guess this round.</dd>
        </dl>
        <p class="muted">You earn Hints and Strings by writing musical riffs.</p>
        <h3>🎓 Learner mode</h3>
        <dl>
          <dt>↗ ↘ →</dt><dd>The melody's shape: up, down or the same from one note to the next.</dd>
          <dt>👂</dt><dd>Select a note slot and hear just that note of the riff.</dd>
          <dt><i class="bar"></i></dt><dd>Green bars: where the selected note can still be. Dashed = only as a sharp.</dd>
          <dt>🎁</dt><dd>A free note after every 2 wrong guesses. Guessed riffs earn half points.</dd>
        </dl>
      </HelpSheet>
    </header>
    <label class="learner_switch">
      <input type="checkbox" :checked="me.learner" :disabled="busy" @change="emit('learner', !me.learner)" />
      🎓 Learner mode <small class="muted">shape arrows, hear one note, where it could be, a free note every {{ FREE_EVERY }} misses (half points)</small>
    </label>

    <div class="row">
      <button type="button" class="btn btn_primary" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play the riff' }}</button>
      <label class="tempo">Tempo <input v-model.number="bpm" type="range" min="50" max="160" step="5" /></label>
    </div>

    <GuitarStrings :total="round.strings" :left="round.stringsLeft" />

    <StaffEditor v-model="slots" v-model:selected="selected" mode="guess" plain-rhythm :locked="round.revealed"
      :marks="lastGuess?.marks" :mark-hints="lastGuess?.hints" :highlight="playingSlot"
      :contour="me.learner ? contour : null" :possible="me.learner ? possible : null"
      :lowest="rules.lowest" :highest="rules.highest" :instrument="instrument" />

    <div class="toolbar">
      <div class="tools">
        <button type="button" class="tool" :disabled="!editable" @click="nudge(1)">▲ ♯</button>
        <button type="button" class="tool" :disabled="!editable" @click="nudge(-1)">▼ ♭</button>
        <button type="button" class="tool" :disabled="!slots.length" @click="playGuess">▶ My guess</button>
        <button type="button" class="tool" :disabled="!canClear" title="Empty your guess notes (known green notes stay)" @click="clearGuess">Clear</button>
        <button v-if="me.learner" type="button" class="tool tool_learn" :disabled="selected < 0" @click="hearOne">
          👂 {{ selected < 0 ? 'Tap a note, then hear it' : `Hear note ${selected + 1}` }}
        </button>
      </div>
      <div class="tools">
        <button type="button" class="tool" :disabled="!me.hints || busy" title="Reveal one note" @click="emit('hint')">💡 Hint ×{{ me.hints }}</button>
        <button type="button" class="tool" :disabled="!me.extraStrings || busy" title="One more wrong guess allowed" @click="emit('extraString')">🎸 +String ×{{ me.extraStrings }}</button>
      </div>
    </div>

    <p v-if="me.learner" class="learn_tip">{{ learnTip }}</p>

    <div class="legend">
      <span><i class="dot mark_exact"></i>right</span><span><i class="dot mark_octave"></i>right note, wrong octave</span>
      <span><i class="dot mark_close"></i>close (arrow shows which way)</span><span><i class="dot mark_miss"></i>miss</span>
    </div>

    <button type="button" class="btn btn_primary btn_big" :disabled="!complete || busy" @click="submit">
      {{ complete ? 'Guess!' : `Fill in ${missing} more note${missing === 1 ? '' : 's'}` }}
    </button>

    <GuessHistory v-if="round.guesses.length" :guesses="round.guesses" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { Note, Player, Round, Rules } from '../ts/api'
import { play, type Playback } from '../ts/synth'
import StaffEditor from './StaffEditor.vue'
import GuitarStrings from './GuitarStrings.vue'
import GuessHistory from './GuessHistory.vue'
import HelpSheet from './HelpSheet.vue'

const props = defineProps<{ round: Round; rules: Rules; instrument: string; me: Player; busy: boolean }>()
const emit = defineEmits<{ guess: [number[]]; hint: []; extraString: []; learner: [boolean] }>()
const FREE_EVERY = 2

const slots = ref<Note[]>([])
const selected = ref(-1)
const bpm = ref(90)
// shallowRef: a plain ref would wrap the object in a proxy, and "playback.value === p" below would never match
const playback = shallowRef<Playback | null>(null)
const playingSlot = ref(-1)

const lastGuess = computed(() => props.round.guesses[props.round.guesses.length - 1] ?? null)
const missing = computed(() => slots.value.filter((n) => n.m === null).length)
const complete = computed(() => missing.value === 0)
const editable = computed(() => selected.value >= 0 && props.round.revealed[selected.value] == null && slots.value[selected.value]?.m != null)

// start each guess from what's known, plus the last guess's notes to edit
// (a string key: a new array each time would count as a change on every reload and wipe the notes being entered)
watch(() => `${props.round.number}|${props.round.guesses.length}|${props.round.revealed.join()}`, () => {
  slots.value = props.round.revealed.map((r, i) => ({ m: r ?? lastGuess.value?.notes[i] ?? null, b: 1 }))
}, { immediate: true })

// ---- learner mode helpers (the phone already has the riff's notes, to play them)
const answer = computed(() => (props.round.riff ?? []).filter((n) => n.m !== null).map((n) => n.m as number))
/** up / down / same, from each note to the next: the melody's shape */
const contour = computed(() => answer.value.map((m, i) => (i === 0 ? null : m > answer.value[i - 1] ? 'up' : m < answer.value[i - 1] ? 'down' : 'same')))

/** Could the real note be p, given this guess's mark for the slot? (the same rules the server marks by) */
function fits(p: number, slot: number): boolean {
  return props.round.guesses.every((g) => {
    const n = g.notes[slot]
    switch (g.marks[slot]) {
      case 'exact': return p === n
      case 'octave': return p !== n && (((p - n) % 12) + 12) % 12 === 0
      case 'close': return g.hints[slot] === 'up' ? p > n && p - n <= 2 : p < n && n - p <= 2
      default: return Math.abs(p - n) > 2 && (((p - n) % 12) + 12) % 12 !== 0
    }
  })
}
/** Does p agree with the melody's shape next to notes already known? (the arrows the learner sees) */
function fitsShape(p: number, s: number): boolean {
  const known = props.round.revealed, c = contour.value
  const prev = known[s - 1], next = known[s + 1]
  if (prev != null && !(c[s] === 'up' ? p > prev : c[s] === 'down' ? p < prev : p === prev)) return false
  if (next != null && !(c[s + 1] === 'up' ? next > p : c[s + 1] === 'down' ? next < p : next === p)) return false
  return true
}
/** where the selected note could still be: from the feedback and the shape next to known notes */
const possible = computed(() => {
  const s = selected.value
  if (s < 0 || props.round.revealed[s] != null) return null
  const l: number[] = []
  for (let p = props.rules.lowest; p <= props.rules.highest; p++) if (fits(p, s) && fitsShape(p, s)) l.push(p)
  return l.length < props.rules.highest - props.rules.lowest + 1 ? l : null    // nothing ruled out yet: no bars
})
const learnTip = computed(() => {
  const r = props.round
  if (r.freeNotes && lastGuess.value && !lastGuess.value.correct && r.guesses.length % FREE_EVERY === 0)
    return '🎁 Free note! One more note is filled in for you.'
  if (!r.guesses.length) return 'Listen for the shape first: the arrows show where the melody goes up, down or stays. Tap a note to see where it could be (green), press 👂 to hear just that note, and tap the staff until yours sounds the same.'
  return 'Green bars show where the selected note can still be (from your guesses and the arrows). Tap a slot to see them.'
})
function hearOne() {
  const m = answer.value[selected.value]
  if (m === undefined) return
  playback.value?.stop()
  play([{ m, b: 1.5 }], props.instrument, 90)
}

/** Empty every guessed note the player could still change (the known ones stay). */
const canClear = computed(() => slots.value.some((n, i) => n.m !== null && props.round.revealed[i] == null))
function clearGuess() {
  slots.value = slots.value.map((n, i) => (props.round.revealed[i] == null ? { m: null, b: n.b } : n))
  selected.value = -1
}

function nudge(d: number) {
  slots.value = slots.value.map((n, i) => (i === selected.value && n.m !== null
    ? { ...n, m: Math.min(props.rules.highest, Math.max(props.rules.lowest, n.m + d)) } : n))
}

/** Index of the sounding note (guess slot) for an index into the riff, which may contain rests. */
function slotOf(riffIndex: number): number {
  if (riffIndex < 0 || !props.round.riff) return -1
  if (props.round.riff[riffIndex].m === null) return -1
  return props.round.riff.slice(0, riffIndex).filter((n) => n.m !== null).length
}

function togglePlay() {
  if (playback.value) { playback.value.stop(); playback.value = null; return }
  if (!props.round.riff) return
  const p = play(props.round.riff, props.instrument, bpm.value, (i) => { playingSlot.value = slotOf(i) })
  playback.value = p
  void p.done.then(() => { if (playback.value === p) playback.value = null })
}

function playGuess() {
  playback.value?.stop()
  // the guess with the riff's rhythm, so it can be compared by ear
  const rhythm = (props.round.riff ?? []).filter((n) => n.m !== null).map((n) => n.b)
  const p = play(slots.value.filter((n) => n.m !== null).map((n, i) => ({ m: n.m, b: rhythm[i] ?? 1 })), props.instrument, bpm.value,
    (i) => { playingSlot.value = i })
  playback.value = p
  void p.done.then(() => { if (playback.value === p) playback.value = null })
}

function submit() {
  playback.value?.stop()
  emit('guess', slots.value.map((n) => n.m as number))
}
onBeforeUnmount(() => playback.value?.stop())
</script>

<style scoped>
.guesser { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.guesser_head { display: flex; align-items: center; gap: 10px; }
.guesser_head h2 { flex: 1; }
.bar { display: inline-block; width: 26px; height: 8px; border-radius: 4px; background: var(--good); opacity: 0.5; }
.guesser_head h2 { margin: 0; font-size: 1.25rem; }
.muted { color: var(--text-muted); font-size: 0.9rem; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tempo { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 0.85rem; }
.tempo input { width: 110px; accent-color: var(--accent); }
.toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.learner_switch { display: flex; gap: 8px; align-items: baseline; font-size: 0.9rem; cursor: pointer; }
.learner_switch input { accent-color: var(--accent); transform: translateY(2px); }
.learner_switch small { font-size: 0.75rem; }
.tool_learn { border-color: var(--good); }
.learn_tip { margin: 0; font-size: 0.85rem; background: var(--surface-2); border-left: 3px solid var(--good); padding: 8px 10px; border-radius: var(--radius-sm); }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.75rem; color: var(--text-muted); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.mark_exact { background: var(--good); } .mark_octave { background: var(--accent-2); }
.mark_close { background: var(--accent); } .mark_miss { background: var(--bad); }
</style>
