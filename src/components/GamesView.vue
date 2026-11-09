<template>
  <!-- Every game you have, its own page (#/games) so the home screen stays short: your turn, their turn, finished. -->
  <div class="games">
    <div class="games_top">
      <button type="button" class="btn btn_ghost btn_small" @click="emit('back')">← Home</button>
      <h1>Your games</h1>
    </div>
    <p v-if="loaded && !games.length" class="muted">No games yet.</p>
    <section v-for="s in sections" :key="s.title" class="card">
      <h2>{{ s.title }} <span class="muted count">{{ s.games.length }}</span></h2>
      <ul class="list">
        <GameRow v-for="g in s.shown" :key="g.id" :g="g" @open="(id) => emit('open', id)" />
      </ul>
      <button v-if="s.games.length > s.shown.length" type="button" class="btn btn_ghost btn_small more" @click="allDone = true">
        Show all {{ s.games.length }}</button>
    </section>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, type GameView } from '../ts/api'
import GameRow, { myTurn, waiting } from './GameRow.vue'

const props = defineProps<{ refresh: number }>()
const emit = defineEmits<{ open: [id: string]; back: [] }>()
const games = ref<GameView[]>([])
const loaded = ref(false)
const error = ref('')
const DONE_SHOWN = 10
const allDone = ref(false)

async function load() {
  try { games.value = (await api.games()).filter((g) => g.turn !== 'invited'); error.value = '' } catch (e) { error.value = (e as Error).message }
  loaded.value = true
}
watch(() => props.refresh, load, { immediate: true })
const recheck = window.setInterval(() => { if (!document.hidden) void load() }, 10000)
onBeforeUnmount(() => clearInterval(recheck))

const sections = computed(() => {
  const mine = games.value.filter(myTurn)
  const theirs = games.value.filter((g) => !myTurn(g) && waiting(g))
  const done = games.value.filter((g) => !myTurn(g) && !waiting(g))
  return [
    { title: 'Your turn', games: mine, shown: mine },
    { title: 'Their turn', games: theirs, shown: theirs },
    { title: 'Finished', games: done, shown: allDone.value ? done : done.slice(0, DONE_SHOWN) },
  ].filter((s) => s.games.length)
})
</script>

<style scoped>
.games { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.games_top { display: flex; align-items: center; gap: 12px; }
h1 { margin: 0; font-size: 1.3rem; }
h2 { margin: 0 0 8px; font-size: 1.1rem; }
.count { font-weight: 400; font-size: 0.9rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.more { margin-top: 6px; }
.muted { color: var(--text-muted); }
.error { color: var(--bad); }
</style>
