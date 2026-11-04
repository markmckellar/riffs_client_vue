<template>
  <div class="library">
    <div class="library_head">
      <strong>{{ tune ? tune.title : 'Famous (public-domain) tunes' }}</strong>
      <button type="button" class="tool" @click="tune ? (tune = null) : emit('close')">{{ tune ? '← Back' : '✕' }}</button>
    </div>
    <p class="library_note">Riffs from famous tunes are easier to guess, so they earn half points and no tokens.</p>
    <ul v-if="!tune" class="library_list">
      <li v-for="t in tunes" :key="t.id">
        <button type="button" class="library_item" @click="open(t)">
          <span>{{ t.title }}</span><small>{{ t.source }}, {{ t.year }}</small>
        </button>
      </li>
    </ul>
    <ul v-else class="library_list">
      <li v-for="(f, i) in fragments" :key="i" class="library_frag">
        <button type="button" class="tool" @click="play(f.notes, instrument, 100)">▶</button>
        <span class="library_frag_text">{{ f.notes.filter((n) => n.m !== null).length }} notes from note {{ f.start + 1 }}
          <small v-if="f.phraseEnd">· ends a phrase</small></span>
        <button type="button" class="btn btn_small" @click="emit('pick', f.notes, f.tuneId)">Use</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Fragment, type Note, type Tune } from '../ts/api'
import { play } from '../ts/synth'

defineProps<{ instrument: string }>()
const emit = defineEmits<{ pick: [notes: Note[], tuneId: string]; close: [] }>()
const tunes = ref<Tune[]>([])
const tune = ref<Tune | null>(null)
const fragments = ref<Fragment[]>([])
onMounted(async () => { tunes.value = await api.library() })
async function open(t: Tune) { tune.value = t; fragments.value = await api.fragments(t.id) }
</script>

<style scoped>
.library { background: var(--surface-2); border-radius: var(--radius); padding: 10px 12px; max-height: 360px; overflow: auto; }
.library_head { display: flex; justify-content: space-between; align-items: center; }
.library_note { margin: 4px 0 8px; font-size: 0.8rem; color: var(--text-muted); }
.library_list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.library_item { width: 100%; text-align: left; background: none; border: 0; color: var(--text); padding: 8px 6px; border-radius: 8px; display: grid; cursor: pointer; font: inherit; }
.library_item:hover { background: var(--surface); }
.library_item small { color: var(--text-muted); }
.library_frag { display: flex; align-items: center; gap: 8px; }
.library_frag_text { flex: 1; font-size: 0.9rem; }
.library_frag_text small { color: var(--text-muted); }
</style>
