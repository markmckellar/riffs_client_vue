<template>
  <div class="home">
    <!-- challenges from other people, waiting for an answer -->
    <section v-if="challenges.length" class="card challenges">
      <h2>⚔️ You've been challenged</h2>
      <ul class="list">
        <li v-for="g in challenges" :key="g.id" class="challenge_row">
          <span class="challenge_who"><strong>{{ g.opponent.name }}</strong> wants a game</span>
          <button type="button" class="btn btn_primary btn_small" :disabled="busy" @click="answer(g.id, true)">Accept</button>
          <button type="button" class="btn btn_small" :disabled="busy" @click="answer(g.id, false)">No thanks</button>
        </li>
      </ul>
    </section>

    <button type="button" class="btn btn_primary btn_big" :disabled="busy" @click="start()">🎸 New game</button>
    <p class="muted small">Finds you an opponent: someone online if they say yes, otherwise a bot.</p>

    <!-- only the games waiting on you; the rest are on their own page (#/games) -->
    <section v-if="yourTurn.length" class="card">
      <h2>Your turn</h2>
      <ul class="list">
        <GameRow v-for="g in yourTurn.slice(0, TURNS_SHOWN)" :key="g.id" :g="g" @open="(id) => emit('open', id)" />
      </ul>
    </section>
    <button v-if="mine.length" type="button" class="btn games_link" @click="emit('games')">
      <span>📋 Your games <span class="muted">({{ mine.length }})</span></span>
      <span class="muted small">{{ gamesSummary }} ›</span>
    </button>

    <section class="card">
      <h2>Online now</h2>
      <p v-if="!home.online.length" class="muted small">Nobody else is online right now.</p>
      <ul class="list">
        <PlayerRow v-for="p in home.online" :key="p.id" :p="p" :busy="busy" @open="(id) => emit('open', id)" @challenge="start" />
      </ul>
    </section>

    <!-- everyone you've played is on its own page (#/opponents) -->
    <button v-if="home.past.length" type="button" class="btn games_link" @click="emit('opponents')">
      <span>👥 Past opponents <span class="muted">({{ home.past.length }})</span></span>
      <span class="muted small">{{ pastOnline ? `${pastOnline} online · ` : '' }}rematch ›</span>
    </button>

    <section class="card">
      <h2>Find a player</h2>
      <input v-model="query" type="search" class="search" placeholder="Name" aria-label="Find a player by name" autocomplete="off" />
      <p v-if="query.trim() && searched === query.trim() && !found.length" class="muted small">Nobody by that name.</p>
      <ul class="list">
        <PlayerRow v-for="p in found" :key="p.id" :p="p" :busy="busy" @open="(id) => emit('open', id)" @challenge="start" />
      </ul>
    </section>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, type GameView, type Home, type Me, type PlayerEntry } from '../ts/api'
import PlayerRow from './PlayerRow.vue'
import GameRow, { myTurn, waiting } from './GameRow.vue'

const props = defineProps<{ refresh: number; me?: Me | null }>()
const emit = defineEmits<{ open: [id: string]; games: []; opponents: [] }>()
const TURNS_SHOWN = 3
const games = ref<GameView[]>([])
const home = ref<Home>({ online: [], past: [] })
const busy = ref(false)
const error = ref('')

const challenges = computed(() => games.value.filter((g) => g.turn === 'invited'))
const mine = computed(() => games.value.filter((g) => g.turn !== 'invited'))
const yourTurn = computed(() => mine.value.filter(myTurn))
const gamesSummary = computed(() => {
  const more = yourTurn.value.length - TURNS_SHOWN
  const theirs = mine.value.filter((g) => !myTurn(g) && waiting(g)).length
  return [more > 0 ? `${more} more your turn` : '', theirs ? `${theirs} their turn` : ''].filter(Boolean).join(' · ') || 'all finished'
})
const pastOnline = computed(() => home.value.past.filter((p) => p.online && !p.bot).length)

async function load() {
  try { [games.value, home.value] = await Promise.all([api.games(), api.home()]); error.value = '' } catch (e) { error.value = (e as Error).message }
  if (query.value.trim()) void search()
}
watch(() => props.refresh, load, { immediate: true })
// the lists also refresh by themselves (whose turn it is, who's online), in case an event was missed
const recheck = window.setInterval(() => { if (!document.hidden) void load() }, 10000)
onBeforeUnmount(() => clearInterval(recheck))

// ---- find a player: asks the server a moment after typing stops
const query = ref('')
const found = ref<PlayerEntry[]>([])
const searched = ref('')
let typing = 0
watch(query, () => { clearTimeout(typing); typing = window.setTimeout(search, 300) })
async function search() {
  const q = query.value.trim()
  if (!q) { found.value = []; searched.value = ''; return }
  try { found.value = await api.findPlayers(q); searched.value = q } catch { /* offline: keep the last results */ }
}

/** New game (no one picked: the server finds someone), or a challenge to this player (a bot plays at once). */
async function start(opponentId?: string) {
  busy.value = true
  try { const g = await api.start(opponentId); emit('open', g.id) } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function answer(id: string, yes: boolean) {
  busy.value = true
  try {
    const g = yes ? await api.accept(id) : await api.decline(id)
    if (yes) emit('open', g.id)
    else await load()
  } catch (e) { error.value = (e as Error).message; await load() } finally { busy.value = false }
}

</script>

<style scoped>
.home { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
h2 { margin: 0 0 8px; font-size: 1.1rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.challenges { border: 1px solid var(--accent); }
.challenge_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.challenge_who { flex: 1; min-width: 140px; }
.games_link { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; text-align: left; }
.search { width: 100%; box-sizing: border-box; font: inherit; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; }
.search:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.muted { color: var(--text-muted); }
.small { font-size: 0.8rem; margin: 0; }
.error { color: var(--bad); }
</style>
