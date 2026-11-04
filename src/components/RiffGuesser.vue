<template>
  <section class="guesser">
    <header class="guesser_head">
      <h2>Guess the riff</h2>
      <span class="muted">{{ round.length }} notes · first note given</span>
    </header>

    <div class="row">
      <button type="button" class="btn btn_primary" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play the riff' }}</button>
      <label class="tempo">Tempo <input v-model.number="bpm" type="range" min="50" max="160" step="5" /></label>
    </div>

    <GuitarStrings :total="round.strings" :left="round.stringsLeft" />

    <StaffEditor v-model="slots" v-model:selected="selected" mode="guess" plain-rhythm :locked="round.revealed"
      :marks="lastGuess?.marks" :mark-hints="lastGuess?.hints" :highlight="playingSlot"
      :lowest="rules.lowest" :highest="rules.highest" :instrument="instrument" />

    <div class="toolbar">
      <div class="tools">
        <button type="button" class="tool" :disabled="!editable" @click="nudge(1)">▲ ♯</button>
        <button type="button" class="tool" :disabled="!editable" @click="nudge(-1)">▼ ♭</button>
        <button type="button" class="tool" :disabled="!slots.length" @click="playGuess">▶ My guess</button>
      </div>
      <div class="tools">
        <button type="button" class="tool" :disabled="!me.hints || busy" title="Reveal one note" @click="emit('hint')">💡 Hint ×{{ me.hints }}</button>
        <button type="button" class="tool" :disabled="!me.extraStrings || busy" title="One more wrong guess allowed" @click="emit('extraString')">🎸 +String ×{{ me.extraStrings }}</button>
      </div>
    </div>

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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Note, Player, Round, Rules } from '../ts/api'
import { play, type Playback } from '../ts/synth'
import StaffEditor from './StaffEditor.vue'
import GuitarStrings from './GuitarStrings.vue'
import GuessHistory from './GuessHistory.vue'

const props = defineProps<{ round: Round; rules: Rules; instrument: string; me: Player; busy: boolean }>()
const emit = defineEmits<{ guess: [number[]]; hint: []; extraString: [] }>()

const slots = ref<Note[]>([])
const selected = ref(-1)
const bpm = ref(90)
const playback = ref<Playback | null>(null)
const playingSlot = ref(-1)

const lastGuess = computed(() => props.round.guesses[props.round.guesses.length - 1] ?? null)
const missing = computed(() => slots.value.filter((n) => n.m === null).length)
const complete = computed(() => missing.value === 0)
const editable = computed(() => selected.value >= 0 && props.round.revealed[selected.value] == null && slots.value[selected.value]?.m != null)

// start each guess from what's known, plus the last guess's notes to edit
watch(() => [props.round.guesses.length, props.round.revealed.join()], () => {
  slots.value = props.round.revealed.map((r, i) => ({ m: r ?? lastGuess.value?.notes[i] ?? null, b: 1 }))
}, { immediate: true })

function nudge(d: number) {
  slots.value = slots.value.map((n, i) => (i === selected.value && n.m !== null
    ? { ...n, m: Math.min(props.rules.highest, Math.max(props.rules.lowest, n.m + d)) } : n))
}

/** Index of the sounding note (guess slot) for an index into the riff, which may contain rests. */
function slotOf(riftIndex: number): number {
  if (riftIndex < 0 || !props.round.rift) return -1
  if (props.round.rift[riftIndex].m === null) return -1
  return props.round.rift.slice(0, riftIndex).filter((n) => n.m !== null).length
}

function togglePlay() {
  if (playback.value) { playback.value.stop(); playback.value = null; return }
  if (!props.round.rift) return
  const p = play(props.round.rift, props.instrument, bpm.value, (i) => { playingSlot.value = slotOf(i) })
  playback.value = p
  void p.done.then(() => { if (playback.value === p) playback.value = null })
}

function playGuess() {
  playback.value?.stop()
  // the guess with the riff's rhythm, so it can be compared by ear
  const rhythm = (props.round.rift ?? []).filter((n) => n.m !== null).map((n) => n.b)
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
.guesser_head { display: flex; justify-content: space-between; align-items: baseline; }
.guesser_head h2 { margin: 0; font-size: 1.25rem; }
.muted { color: var(--text-muted); font-size: 0.9rem; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tempo { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 0.85rem; }
.tempo input { width: 110px; accent-color: var(--accent); }
.toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.75rem; color: var(--text-muted); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.mark_exact { background: var(--good); } .mark_octave { background: var(--accent-2); }
.mark_close { background: var(--accent); } .mark_miss { background: var(--bad); }
</style>
