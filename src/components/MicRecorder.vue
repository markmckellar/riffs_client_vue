<template>
  <span class="mic">
    <button type="button" :class="['btn', recording ? 'btn_rec' : 'btn_ghost']" @click="toggle">
      {{ recording ? '■ Stop listening' : '🎙 Play it in' }}
    </button>
    <span v-if="recording" class="mic_live">
      <span class="mic_level"><span :style="{ width: Math.min(100, level * 600) + '%' }"></span></span>
      <span class="mic_pitch">{{ pitch === null ? '…' : noteName(pitch) }}</span>
      <span class="mic_count">{{ heard }} heard</span>
    </span>
    <span v-if="error" class="mic_error">{{ error }}</span>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { Note } from '../ts/api'
import { noteName } from '../ts/music'
import { startRecording, type Recorder } from '../ts/pitch'

const props = defineProps<{ bpm: number; lowest: number; highest: number; maxNotes: number }>()
const emit = defineEmits<{ notes: [Note[]] }>()

const recording = ref(false)
const level = ref(0)
const pitch = ref<number | null>(null)
const heard = ref(0)
const error = ref('')
let rec: Recorder | null = null
let raf = 0

async function toggle() {
  error.value = ''
  if (rec) return finish()
  try {
    rec = await startRecording(props.bpm, props.lowest, props.highest, (n) => {
      heard.value = n.filter((x) => x.m !== null).length
      if (heard.value >= props.maxNotes) finish()
    })
    recording.value = true
    heard.value = 0
    const tick = () => { if (!rec) return; level.value = rec.level(); pitch.value = rec.current(); raf = requestAnimationFrame(tick) }
    tick()
  } catch (e) {
    error.value = window.isSecureContext ? 'Microphone not available (' + (e as Error).message + ')' : 'The microphone needs an https page.'
  }
}

function finish() {
  if (!rec) return
  cancelAnimationFrame(raf)
  const notes = rec.stop()
  rec = null
  recording.value = false
  let sounding = 0
  const kept = notes.filter((n) => (n.m === null ? true : ++sounding <= props.maxNotes))
  if (kept.some((n) => n.m !== null)) emit('notes', kept.slice(0, props.maxNotes + 2))
  else error.value = "Didn't hear any clear notes. Play one note at a time, close to the phone."
}
onBeforeUnmount(() => { if (rec) { rec.stop(); rec = null } cancelAnimationFrame(raf) })
</script>

<style scoped>
.mic { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mic_live { display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; }
.mic_level { width: 60px; height: 6px; background: var(--border); border-radius: 9px; overflow: hidden; }
.mic_level span { display: block; height: 100%; background: var(--good); }
.mic_pitch { font-weight: 700; min-width: 2.5em; }
.mic_count { color: var(--text-muted); }
.mic_error { color: var(--bad); font-size: 0.85rem; }
</style>
