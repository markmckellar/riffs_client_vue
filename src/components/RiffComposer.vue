<template>
  <section class="composer">
    <!-- laid out like the guess screen: play + sound on top, the staff, the piano, then the keys -->
    <div class="row">
      <button type="button" class="btn btn_primary" :disabled="!sounding" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play' }}</button>
      <InstrumentPicker bare />
      <span :class="['count', { count_ok: countOk }]" :title="`a riff has ${rules.minNotes} to ${rules.maxNotes} notes`">{{ sounding }}/{{ rules.maxNotes }} notes</span>
      <span class="row_gap"></span>
      <HelpSheet title="How to write a riff" storage-key="riffs_help_compose">
        <p><b>To add:</b> tap a <b>piano key</b> (or the staff at <b>+</b>). The note goes in at the cursor and the
          cursor stays on it, so you can try keys until it sounds right; <b>⏎</b> moves on to the next spot. Every note
          is the same length.</p>
        <p><b>To change a note:</b> tap it on the staff (its name turns orange), then a piano key. <b>⌫</b> deletes
          it (with nothing selected, the last note); <b>␣ rest</b> turns it into a rest, or a rest back into a note
          (with nothing selected, it adds a rest).</p>
        <h3>Other buttons</h3>
        <dl>
          <dt>🗑 Clear</dt><dd>Start over. You get a few seconds to undo it.</dd>
          <dt>▶</dt><dd>Hear your riff. <b>Sound</b> picks the instrument.</dd>
          <dt>🎙</dt><dd><b>Play it in:</b> sing, whistle or play into the phone, one note at a time, and it writes the notes down.</dd>
          <dt>📚</dt><dd><b>Famous tunes:</b> use a piece of a well-known tune (easier to guess, so half points).</dd>
        </dl>
        <h3>The score</h3>
        <p>How "musical" your riff sounds, from 0 to 100. Musical riffs earn points, plus Hints 💡 and Extra
          Strings 🎸 for when you guess. Tips: end on a "home" note (often the note you started on), use mostly small
          steps, and repeat a little pattern. A riff has {{ rules.minNotes }}–{{ rules.maxNotes }} notes.</p>
      </HelpSheet>
    </div>

    <StaffEditor v-model="notes" v-model:selected="selected" mode="compose" :highlight="playing"
      :max-notes="rules.maxNotes" :max-rests="rules.maxRests" :lowest="rules.lowest" :highest="rules.highest"
      :new-length="1" plain-rhythm :instrument="instrument" @add="addAt" />

    <!-- the same piano as when guessing: a key puts the note at the cursor and stays on it; ⏎ moves on -->
    <PianoKeys :lowest="rules.lowest" :highest="rules.highest" :current="selNote ? selNote.m : null" :instrument="instrument" @press="onPiano" />

    <div class="toolbar">
      <div class="tools">
        <button type="button" class="tool tool_key" title="Backspace: delete this note (or the last one)" aria-label="Backspace" :disabled="!notes.length" @click="backspace">⌫</button>
        <button type="button" class="tool tool_key" title="Enter: next note" aria-label="Enter: next note" @click="enter">⏎</button>
        <button type="button" class="tool" :title="selected >= 0 ? 'Space: make this a rest (or a note again)' : 'Space: add a rest'"
          :disabled="selected < 0 && rests >= rules.maxRests" @click="restKey">␣ rest</button>
        <button v-if="undoNotes" type="button" class="tool btn_undo" @click="undoClear">↶ Undo</button>
        <button v-else type="button" class="tool" :disabled="!notes.length" @click="clear">Clear</button>
      </div>
    </div>
    <div class="row">
      <MicRecorder :bpm="bpm" :lowest="rules.lowest" :highest="rules.highest" :max-notes="rules.maxNotes" @notes="fromMic" />
      <button type="button" class="btn btn_ghost" @click="showLibrary = !showLibrary">📚 Famous tunes</button>
    </div>

    <LibraryPicker v-if="showLibrary" :instrument="instrument" @pick="fromLibrary" @close="showLibrary = false" />

    <div v-if="evaluation && sounding >= 2" :class="['sense', 'sense_' + evaluation.tier]">
      <div class="sense_top">
        <strong>{{ TIER_LABEL[evaluation.tier] }}</strong>
        <span class="sense_bar"><span :style="{ width: evaluation.score + '%' }"></span></span>
        <span class="sense_score">{{ evaluation.score }}</span>
      </div>
      <div class="sense_reward">{{ rewardText }}</div>
      <ul class="sense_reasons">
        <li v-for="r in topReasons" :key="r.rule" :class="r.points > 0 ? 'good' : 'bad'">{{ r.text }}</li>
      </ul>
    </div>

    <p v-if="problem && sounding" class="problem">{{ problem }}</p>
    <button type="button" class="btn btn_primary btn_big" :disabled="!!problem || sending" @click="send">
      Send riff to {{ opponentName }} 🎶
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { api, type Evaluation, type Note, type Rules } from '../ts/api'
import { TIER_LABEL, noteName } from '../ts/music'
import { play, type Playback } from '../ts/synth'
import StaffEditor from './StaffEditor.vue'
import MicRecorder from './MicRecorder.vue'
import LibraryPicker from './LibraryPicker.vue'
import HelpSheet from './HelpSheet.vue'
import InstrumentPicker from './InstrumentPicker.vue'
import PianoKeys from './PianoKeys.vue'

const props = defineProps<{ gameId: string; rules: Rules; instrument: string; opponentName: string }>()
const emit = defineEmits<{ send: [notes: Note[], tuneId: string | undefined] }>()

const draftKey = `riffs_draft_${props.gameId}`
const notes = ref<Note[]>(loadDraft())
const tuneId = ref<string | undefined>(undefined)
const selected = ref(-1)
const bpm = ref(100)    // one steady speed (no tempo slider)
const playing = ref(-1)
// shallowRef: a plain ref would wrap the object in a proxy, and "playback.value === p" below would never match
const playback = shallowRef<Playback | null>(null)
const showLibrary = ref(false)
const evaluation = ref<Evaluation | null>(null)
const sending = ref(false)

const sounding = computed(() => notes.value.filter((n) => n.m !== null).length)
const rests = computed(() => notes.value.length - sounding.value)
const countOk = computed(() => sounding.value >= props.rules.minNotes && sounding.value <= props.rules.maxNotes)
const selNote = computed(() => { const n = notes.value[selected.value]; return n && n.m !== null ? n : null })
const problem = computed(() => {
  if (sounding.value < props.rules.minNotes) return `Add ${props.rules.minNotes - sounding.value} more note${props.rules.minNotes - sounding.value === 1 ? '' : 's'}.`
  return evaluation.value?.problem ?? null
})
const topReasons = computed(() => (evaluation.value?.reasons ?? []).filter((r) => r.points !== 0)
  .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 4))
const rewardText = computed(() => {
  const t = evaluation.value?.tier
  if (tuneId.value) return 'From the tune library: half points, no tokens.'
  const n = sounding.value
  const token = (t === 'catchy' && n >= 6) ? ' + an Extra String 🎸' : ((t === 'catchy' || t === 'musical') && n >= 5) ? ' + a Hint 💡' : ''
  const more = (t === 'catchy' && n < 6) ? ` (${n < 5 ? 'a Hint at 5 notes, ' : ''}an Extra String at 6+ notes)` : (t === 'musical' && n < 5) ? ' (a Hint at 5+ notes)' : ''
  return t === 'catchy' ? `Reward: 50 points${token}${more}` : t === 'musical' ? `Reward: 25 points${token}${more}`
    : t === 'ok' ? 'Reward: 10 points' : 'No reward. Try ending on the home note, or using smaller steps.'
})

function loadDraft(): Note[] {
  // drafts saved when notes still had lengths: even them out (every note is one beat now)
  try { return (JSON.parse(localStorage.getItem(draftKey) || '[]') as Note[]).map((n) => ({ ...n, b: 1 })) } catch { return [] }
}

let timer = 0
watch(notes, (n) => {
  try { localStorage.setItem(draftKey, JSON.stringify(n)) } catch { /* storage blocked */ }
  if (!n.length) tuneId.value = undefined
  clearTimeout(timer)
  timer = window.setTimeout(async () => {
    if (n.filter((x) => x.m !== null).length < 2) { evaluation.value = null; return }
    try { evaluation.value = await api.evaluate(n) } catch { /* offline: no score */ }
  }, 300)
}, { immediate: true, deep: true })

/** A tap at + adds a note at that height; the cursor stays on it (like the piano). */
function addAt(pitch: number) {
  if (sounding.value >= props.rules.maxNotes) return
  notes.value = [...notes.value, { m: pitch, b: 1 }]
  selected.value = notes.value.length - 1
}

// ---- the keyboard: the cursor is the selected note, or the end of the riff (nothing selected)
/** a piano key: changes the selected note, or adds one at the end; the cursor stays on it */
function onPiano(m: number) {
  const s = selected.value
  if (s >= 0 && s < notes.value.length) {
    if (notes.value[s].m === null && sounding.value >= props.rules.maxNotes) return    // a rest can't become a 9th note
    notes.value = notes.value.map((n, i) => (i === s ? { m, b: 1 } : n))
    return
  }
  addAt(m)
}
/** ⏎: on to the next note, or past the end (where the next key adds a note) */
function enter() {
  selected.value = selected.value >= 0 && selected.value < notes.value.length - 1 ? selected.value + 1 : -1
}
/** ␣ rest: the selected note becomes a rest (or a rest a note); with nothing selected, a rest at the end */
function restKey() {
  const s = selected.value
  if (s < 0) { if (rests.value < props.rules.maxRests) notes.value = [...notes.value, { m: null, b: 1 }]; return }
  if (notes.value[s].m === null) toNote()
  else if (rests.value < props.rules.maxRests) toRest()
}
/** ⌫: delete the selected note (the cursor moves to the one before); with nothing selected, the last note */
function backspace() {
  const s = selected.value
  if (s < 0) { notes.value = notes.value.slice(0, -1); return }
  notes.value = notes.value.filter((_, i) => i !== s)
  selected.value = s - 1 >= 0 ? s - 1 : (notes.value.length ? 0 : -1)
}
function toRest() { notes.value = notes.value.map((x, i) => (i === selected.value ? { m: null, b: x.b } : x)) }
/** A rest becomes a note at the pitch of the note before it (or B4), ready to be moved. */
function toNote() {
  const before = notes.value.slice(0, selected.value).reverse().find((x) => x.m !== null)
  const m = before?.m ?? 71
  notes.value = notes.value.map((x, i) => (i === selected.value ? { m, b: x.b } : x))
}
/** Clear the whole riff, with a few seconds to undo it (instead of an "are you sure?" box). */
const undoNotes = ref<{ notes: Note[]; tuneId: string | undefined } | null>(null)
let undoTimer = 0
function clear() {
  undoNotes.value = { notes: notes.value, tuneId: tuneId.value }
  notes.value = []; selected.value = -1; tuneId.value = undefined
  clearTimeout(undoTimer)
  undoTimer = window.setTimeout(() => { undoNotes.value = null }, 8000)
}
function undoClear() {
  if (!undoNotes.value) return
  notes.value = undoNotes.value.notes; tuneId.value = undoNotes.value.tuneId
  undoNotes.value = null
  clearTimeout(undoTimer)
}

function togglePlay() {
  if (playback.value) { playback.value.stop(); playback.value = null; return }
  const p = play(notes.value, props.instrument, bpm.value, (i) => { playing.value = i })
  playback.value = p
  void p.done.then(() => { if (playback.value === p) playback.value = null })
}
function fromMic(n: Note[]) { notes.value = n.map((x) => ({ ...x, b: 1 })); tuneId.value = undefined; selected.value = -1 }
function fromLibrary(n: Note[], id: string) { notes.value = n.map((x) => ({ ...x, b: 1 })); tuneId.value = id; showLibrary.value = false; selected.value = -1 }

async function send() {
  if (evaluation.value?.tier === 'noise' && !confirm('This riff scores as "Noise?", so you get no reward. Send it anyway?')) return
  sending.value = true
  emit('send', notes.value, tuneId.value)
  try { localStorage.removeItem(draftKey) } catch { /* storage blocked */ }
  window.setTimeout(() => { sending.value = false }, 1500)
}
onBeforeUnmount(() => playback.value?.stop())
</script>

<style scoped>
.composer { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.btn_undo { border-color: var(--accent); color: var(--accent); }
.tool_danger { color: var(--bad); }
.count { color: var(--bad); font-weight: 700; font-size: 0.85rem; white-space: nowrap; }
.row_gap { flex: 1; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
.tool_key { font-size: 1.15rem; min-width: 48px; }
.count_ok { color: var(--good); }
.count small { color: var(--text-muted); font-weight: 400; }
.hint { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.sense { background: var(--surface-2); border-radius: var(--radius); padding: 10px 12px; border-left: 4px solid var(--text-muted); }
.sense_catchy { border-left-color: var(--accent); }
.sense_musical { border-left-color: var(--accent-2); }
.sense_ok { border-left-color: var(--good); }
.sense_noise { border-left-color: var(--bad); }
.sense_top { display: flex; align-items: center; gap: 10px; }
.sense_bar { flex: 1; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; }
.sense_bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--bad), var(--accent), var(--good)); transition: width 0.3s; }
.sense_score { font-variant-numeric: tabular-nums; color: var(--text-muted); }
.sense_reward { font-size: 0.85rem; margin-top: 4px; }
.sense_reasons { margin: 6px 0 0; padding-left: 18px; font-size: 0.85rem; }
.sense_reasons .good { color: var(--text); }
.sense_reasons .bad { color: var(--bad); }
.problem { margin: 0; color: var(--bad); font-size: 0.9rem; }
</style>
