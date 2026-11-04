<template>
  <section class="composer">
    <header class="composer_head">
      <h2>Write a riff</h2>
      <span :class="['count', { count_ok: countOk }]">{{ sounding }} notes <small>({{ rules.minNotes }}–{{ rules.maxNotes }})</small></span>
    </header>
    <p class="hint">Tap the staff to place notes. Tap a note to move it. {{ opponentName }} will hear it and try to write it down.</p>

    <StaffEditor v-model="notes" v-model:selected="selected" mode="compose" :highlight="playing"
      :max-notes="rules.maxNotes" :max-rests="rules.maxRests" :lowest="rules.lowest" :highest="rules.highest"
      :new-length="newLength" :instrument="instrument" />

    <div class="toolbar" role="toolbar" aria-label="Note tools">
      <div class="seg" role="radiogroup" aria-label="Note length">
        <button v-for="l in LENGTHS" :key="l.beats" type="button" role="radio" :aria-checked="newLength === l.beats"
          :title="l.label" :class="['seg_btn', { seg_on: newLength === l.beats }]" @click="setLength(l.beats)">
          <NoteGlyph :beats="l.beats" />
        </button>
      </div>
      <div class="tools">
        <button type="button" class="tool" title="Up a half step" :disabled="!selNote" @click="nudge(1)">▲</button>
        <button type="button" class="tool" title="Down a half step" :disabled="!selNote" @click="nudge(-1)">▼</button>
        <button type="button" class="tool" title="Add a rest" :disabled="rests >= rules.maxRests" @click="addRest">𝄽 rest</button>
        <button type="button" class="tool" title="Delete the selected note" :disabled="selected < 0" @click="remove">⌫</button>
        <button type="button" class="tool" title="Start over" :disabled="!notes.length" @click="clear">Clear</button>
      </div>
    </div>

    <div class="row">
      <button type="button" class="btn" :disabled="!sounding" @click="togglePlay">{{ playback ? '■ Stop' : '▶ Play' }}</button>
      <MicRecorder :bpm="bpm" :lowest="rules.lowest" :highest="rules.highest" :max-notes="rules.maxNotes" @notes="fromMic" />
      <button type="button" class="btn btn_ghost" @click="showLibrary = !showLibrary">📚 Famous tunes</button>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, type Evaluation, type Note, type Rules } from '../ts/api'
import { LENGTHS, TIER_LABEL } from '../ts/music'
import { play, type Playback } from '../ts/synth'
import StaffEditor from './StaffEditor.vue'
import NoteGlyph from './NoteGlyph.vue'
import MicRecorder from './MicRecorder.vue'
import LibraryPicker from './LibraryPicker.vue'

const props = defineProps<{ gameId: string; rules: Rules; instrument: string; opponentName: string }>()
const emit = defineEmits<{ send: [notes: Note[], tuneId: string | undefined] }>()

const draftKey = `riffs_draft_${props.gameId}`
const notes = ref<Note[]>(loadDraft())
const tuneId = ref<string | undefined>(undefined)
const selected = ref(-1)
const newLength = ref(1)
const bpm = ref(100)
const playing = ref(-1)
const playback = ref<Playback | null>(null)
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
  try { return JSON.parse(localStorage.getItem(draftKey) || '[]') } catch { return [] }
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

function setLength(b: number) {
  newLength.value = b
  const n = notes.value[selected.value]
  if (n) notes.value = notes.value.map((x, i) => (i === selected.value ? { ...x, b } : x))
}
function nudge(d: number) {
  notes.value = notes.value.map((x, i) => (i === selected.value && x.m !== null
    ? { ...x, m: Math.min(props.rules.highest, Math.max(props.rules.lowest, x.m + d)) } : x))
}
function addRest() {
  notes.value = [...notes.value, { m: null, b: newLength.value }]
  selected.value = notes.value.length - 1
}
function remove() {
  notes.value = notes.value.filter((_, i) => i !== selected.value)
  selected.value = Math.min(selected.value, notes.value.length - 1)
}
function clear() { notes.value = []; selected.value = -1; tuneId.value = undefined }

function togglePlay() {
  if (playback.value) { playback.value.stop(); playback.value = null; return }
  const p = play(notes.value, props.instrument, bpm.value, (i) => { playing.value = i })
  playback.value = p
  void p.done.then(() => { if (playback.value === p) playback.value = null })
}
function fromMic(n: Note[]) { notes.value = n; tuneId.value = undefined; selected.value = -1 }
function fromLibrary(n: Note[], id: string) { notes.value = n; tuneId.value = id; showLibrary.value = false; selected.value = -1 }

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
.composer_head { display: flex; align-items: baseline; justify-content: space-between; }
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
