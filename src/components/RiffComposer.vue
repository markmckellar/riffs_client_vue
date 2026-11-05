<template>
  <section class="composer">
    <!-- laid out like the guess screen: play + sound on top, the staff, the piano, then the keys -->
    <div class="row">
      <button type="button" class="btn btn_primary" :disabled="!sounding" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play' }}</button>
      <InstrumentPicker bare />
      <span :class="['count', { count_ok: countOk }]" :title="`a riff has ${rules.minNotes} to ${rules.maxNotes} notes`">{{ sounding }}/{{ rules.maxNotes }} notes</span>
    </div>

    <StaffEditor v-model="notes" v-model:selected="selected" mode="compose" :highlight="playing"
      :max-notes="rules.maxNotes" :max-rests="rules.maxRests" :lowest="rules.lowest" :highest="rules.highest"
      :new-length="1" plain-rhythm :instrument="instrument" @add="addAt" />

    <!-- the same piano as when guessing: a key puts the note at the cursor and moves on, like typing -->
    <PianoKeys :lowest="rules.lowest" :highest="rules.highest" :current="selNote ? selNote.m : null" :instrument="instrument" @press="onPiano" />

    <div class="toolbar">
      <div class="tools">
        <button type="button" class="tool tool_key" title="Backspace: delete this note (or the last one)" aria-label="Backspace" :disabled="!notes.length" @click="backspace">⌫</button>
        <button type="button" class="tool" :title="selected >= 0 ? 'Space: make this a rest (or a note again)' : 'Space: add a rest'"
          :disabled="selected < 0 && rests >= rules.maxRests" @click="restKey">␣ rest</button>
        <button v-if="undoNotes" type="button" class="tool btn_undo" @click="undoClear">↶ Undo</button>
        <button v-else type="button" class="tool" :disabled="!notes.length" @click="clear">Clear</button>
        <MicRecorder :bpm="bpm" :lowest="rules.lowest" :highest="rules.highest" :max-notes="rules.maxNotes" @notes="fromMic" />
        <HelpSheet title="How to write a riff" storage-key="riffs_help_compose">
          <p><b>To add:</b> tap a <b>piano key</b> (or the staff at <b>+</b>). The note goes in at the cursor, which then
            moves on, like typing. Every note is the same length.</p>
          <p><b>To change a note:</b> tap it on the staff (its name turns orange), then a piano key. <b>⌫</b> deletes
            it (with nothing selected, the last note); <b>␣ rest</b> turns it into a rest, or a rest back into a note
            (with nothing selected, it adds a rest).</p>
          <h3>Other buttons</h3>
          <dl>
            <dt>🗑 Clear</dt><dd>Start over. You get a few seconds to undo it.</dd>
            <dt>▶</dt><dd>Hear your riff. <b>Sound</b> picks the instrument.</dd>
            <dt>🎙</dt><dd><b>Play it in:</b> sing, whistle or play into the phone, one note at a time, and it writes the notes down.</dd>
          </dl>
        </HelpSheet>
      </div>
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
import { noteName } from '../ts/music'
import { play, type Playback } from '../ts/synth'
import StaffEditor from './StaffEditor.vue'
import MicRecorder from './MicRecorder.vue'
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
/** a piano key: changes the selected note (then on to the next one), or adds one at the end, like typing */
function onPiano(m: number) {
  const s = selected.value
  if (s >= 0 && s < notes.value.length) {
    if (notes.value[s].m === null && sounding.value >= props.rules.maxNotes) return    // a rest can't become a 9th note
    notes.value = notes.value.map((n, i) => (i === s ? { m, b: 1 } : n))
    selected.value = s + 1 < notes.value.length ? s + 1 : -1    // past the last note = the end, where keys add notes
    return
  }
  if (sounding.value >= props.rules.maxNotes) return
  notes.value = [...notes.value, { m, b: 1 }]
  selected.value = -1    // stay at the end
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

async function send() {
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
.problem { margin: 0; color: var(--bad); font-size: 0.9rem; }
</style>
