<template>
  <!-- Everyone you've played, its own page (#/opponents) so the home screen stays short. Online first. -->
  <div class="opponents">
    <div class="opponents_top">
      <button type="button" class="btn btn_ghost btn_small" @click="emit('back')">← Home</button>
      <h1>Past opponents</h1>
    </div>
    <p v-if="loaded && !past.length" class="muted">Nobody yet. Start a game!</p>
    <section v-if="past.length" class="card">
      <ul class="list">
        <PlayerRow v-for="p in past" :key="p.id" :p="p" :busy="busy" @open="(id) => emit('open', id)" @challenge="challenge" />
      </ul>
    </section>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { api, type PlayerEntry } from '../ts/api'
import PlayerRow from './PlayerRow.vue'

const props = defineProps<{ refresh: number }>()
const emit = defineEmits<{ open: [id: string]; back: [] }>()
const past = ref<PlayerEntry[]>([])
const loaded = ref(false)
const busy = ref(false)
const error = ref('')

async function load() {
  try { past.value = (await api.home()).past; error.value = '' } catch (e) { error.value = (e as Error).message }
  loaded.value = true
}
watch(() => props.refresh, load, { immediate: true })
const recheck = window.setInterval(() => { if (!document.hidden) void load() }, 10000)
onBeforeUnmount(() => clearInterval(recheck))

async function challenge(id: string) {
  busy.value = true
  try { const g = await api.start(id); emit('open', g.id) } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>

<style scoped>
.opponents { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.opponents_top { display: flex; align-items: center; gap: 12px; }
h1 { margin: 0; font-size: 1.3rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.muted { color: var(--text-muted); }
.error { color: var(--bad); }
</style>
