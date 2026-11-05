<template>
  <section class="composer">
    <header class="composer_head">
      <h2>Write a riff</h2>
      <HelpSheet title="How to write a riff" storage-key="riffs_help_compose">
        <p><b>To add:</b> tap the staff at <b>+</b>, at the height of the note you want (higher = a higher note; its
          name shows above it). Every note is the same length. <b>space</b> adds a rest (a pause), <b>⌫</b> removes the
          last note.</p>
        <p><b>To change a note:</b> tap it. An <b>Edit</b> box shows which note you're changing. Tap the staff above
          it to move it, or use ▲ ▼ (half steps, which give sharps ♯). <b>space</b> turns it into a rest (or a rest back into a note);
          <b>Del</b> deletes it. <b>✓ Done</b> goes back to adding.</p>
        <h3>Other buttons</h3>
        <dl>
          <dt>🗑 Clear</dt><dd>Start over. You get a few seconds to undo it.</dd>
          <dt>▶</dt><dd>Hear your riff. Tempo sets how fast.</dd>
          <dt>🎙</dt><dd><b>Play it in:</b> sing, whistle or play into the phone, one note at a time, and it writes the notes down.</dd>
          <dt>📚</dt><dd><b>Famous tunes:</b> use a piece of a well-known tune (easier to guess, so half points).</dd>
        </dl>
        <h3>The score</h3>
        <p>How "musical" your riff sounds, from 0 to 100. Musical riffs earn points, plus Hints 💡 and Extra
          Strings 🎸 for when you guess. Tips: end on a "home" note (often the note you started on), use mostly small
          steps, and repeat a little pattern. A riff has {{ rules.minNotes }}–{{ rules.maxNotes }} notes.</p>
      </HelpSheet>
      <span :class="['count', { count_ok: countOk }]">{{ sounding }} notes <small>({{ rules.minNotes }}–{{ rules.maxNotes }})</small></span>
    </header>
    <p class="hint">{{ opponentName }} will hear it and try to write it down.</p>

    <StaffEditor v-model="notes" v-model:selected="selected" mode="compose" :highlight="playing"
      :max-notes="rules.maxNotes" :max-rests="rules.maxRests" :lowest="rules.lowest" :highest="rules.highest"
      :new-length="1" plain-rhythm :instrument="instrument" @add="addAt" />

    <!-- The keyboard, always under the staff. Adding: pick a length, tap the staff; space adds a rest; ⌫ removes the
         last note. Editing (a note tapped): the same keys change that note; space = rest/note; Del deletes it. -->
    <div :class="['notebox', { editbar: editing }]" role="toolbar" :aria-label="editing ? 'Change the selected note' : 'Note keys'">
      <div class="editbar_head">
        <template v-if="editing">
          <strong class="editbar_title">Edit #{{ selected + 1 }}: {{ selNote ? noteName(selNote.m!) : 'rest' }}</strong>
          <StepButtons v-if="selNote" @up="nudge(1)" @down="nudge(-1)" />
          <span class="editbar_gap"></span>
          <button type="button" class="btn btn_small btn_primary" @click="selected = -1">✓ Done</button>
        </template>
        <span v-else class="caption">{{ addCaption }}</span>
      </div>
      <div class="keys" role="group" aria-label="Note keys">
        <button v-if="!editing" type="button" class="key key_space" title="Space: add a rest (a silence)" :disabled="rests >= rules.maxRests" @click="addRestAtEnd">
          <span class="key_label">rest</span>space
        </button>
        <button v-else-if="selNote" type="button" class="key key_space" title="Space: make it a rest (a silence)" :disabled="rests >= rules.maxRests" @click="toRest">
          <span class="key_label">rest</span>space
        </button>
        <button v-else type="button" class="key key_space" title="Space: make it a note again" :disabled="sounding >= rules.maxNotes" @click="toNote">
          <span class="key_label">note</span>space
        </button>
        <button v-if="!editing" type="button" class="key key_back" title="Backspace: remove the last note" aria-label="Backspace: remove the last note"
          :disabled="!notes.length" @click="backspace">
          <span class="key_label">back</span>⌫
        </button>
        <button v-else type="button" class="key key_del" title="Delete it" aria-label="Delete it" @click="remove">
          <span class="key_label">&nbsp;</span>Del
        </button>
      </div>
      <p v-if="editing" class="caption">{{ selNote ? 'Tap the staff above it to move it.' : 'A rest is a silence.' }}</p>
    </div>

    <div class="row">
      <button type="button" class="btn" :disabled="!sounding" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play' }}</button>
      <MicRecorder :bpm="bpm" :lowest="rules.lowest" :highest="rules.highest" :max-notes="rules.maxNotes" @notes="fromMic" />
      <button type="button" class="btn btn_ghost" @click="showLibrary = !showLibrary">📚 Famous tunes</button>
      <button v-if="undoNotes" type="button" class="btn btn_undo" @click="undoClear">↶ Undo clear</button>
      <button v-else type="button" class="btn btn_ghost" :disabled="!notes.length" @click="clear">🗑 Clear</button>
    </div>
    <label class="tempo">Tempo <input v-model.number="bpm" type="range" min="60" max="160" step="5" /> {{ bpm }} bpm</label>

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
import StepButtons from './StepButtons.vue'

const props = defineProps<{ gameId: string; rules: Rules; instrument: string; opponentName: string }>()
const emit = defineEmits<{ send: [notes: Note[], tuneId: string | undefined] }>()

const draftKey = `riffs_draft_${props.gameId}`
const notes = ref<Note[]>(loadDraft())
const tuneId = ref<string | undefined>(undefined)
const selected = ref(-1)
const bpm = ref(100)
const playing = ref(-1)
// shallowRef: a plain ref would wrap the object in a proxy, and "playback.value === p" below would never match
const playback = shallowRef<Playback | null>(null)
const showLibrary = ref(false)
const evaluation = ref<Evaluation | null>(null)
const sending = ref(false)

const sounding = computed(() => notes.value.filter((n) => n.m !== null).length)
const editing = computed(() => selected.value >= 0 && selected.value < notes.value.length)
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

/** A tap at + adds a note at that height with the chosen length (the keyboard's lit key). */
function addAt(pitch: number) {
  if (sounding.value >= props.rules.maxNotes) return
  notes.value = [...notes.value, { m: pitch, b: 1 }]
}
/** space while adding: a rest at the end, with the chosen length */
function addRestAtEnd() { notes.value = [...notes.value, { m: null, b: 1 }] }
const addCaption = computed(() => sounding.value >= props.rules.maxNotes
  ? `The riff is full (${props.rules.maxNotes} notes). Tap a note to change it.`
  : 'Tap the staff to add a note. Tap a note to change it.')
/** ⌫ while adding: remove the last note, like typing. */
function backspace() { notes.value = notes.value.slice(0, -1) }
function nudge(d: number) {
  notes.value = notes.value.map((x, i) => (i === selected.value && x.m !== null
    ? { ...x, m: Math.min(props.rules.highest, Math.max(props.rules.lowest, x.m + d)) } : x))
}
function toRest() { notes.value = notes.value.map((x, i) => (i === selected.value ? { m: null, b: x.b } : x)) }
/** A rest becomes a note at the pitch of the note before it (or B4), ready to be moved. */
function toNote() {
  const before = notes.value.slice(0, selected.value).reverse().find((x) => x.m !== null)
  const m = before?.m ?? 71
  notes.value = notes.value.map((x, i) => (i === selected.value ? { m, b: x.b } : x))
}
function remove() {
  notes.value = notes.value.filter((_, i) => i !== selected.value)
  selected.value = -1    // back to adding
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
.composer_head { display: flex; align-items: center; gap: 10px; }
.composer_head h2 { flex: 1; }
.caption { width: 100%; margin: 0; font-size: 0.8rem; color: var(--text-muted); }
.notebox { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; background: var(--surface-2); border: 1px solid var(--accent); border-radius: var(--radius); padding: 10px; margin-top: -6px; }
.notebox_head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.notebox_x { background: none; border: 0; color: var(--text-muted); font-size: 1.1rem; min-width: 36px; min-height: 32px; cursor: pointer; }
.btn_undo { border-color: var(--accent); color: var(--accent); }
.editbar_head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.editbar_gap { flex: 1; }
.editbar_title, .editbar_head .btn { white-space: nowrap; }
.tool_danger { color: var(--bad); }
.composer_head h2 { margin: 0; font-size: 1.25rem; }
.count { color: var(--bad); font-weight: 700; }
.count_ok { color: var(--good); }
.count small { color: var(--text-muted); font-weight: 400; }
.hint { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.tempo { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.85rem; }
.tempo input { flex: 1; max-width: 220px; accent-color: var(--accent); }
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
