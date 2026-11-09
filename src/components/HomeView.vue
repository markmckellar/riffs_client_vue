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

    <section class="card">
      <h2>Your games</h2>
      <p v-if="!mine.length" class="muted">No games yet. Start one!</p>
      <ul class="list">
        <li v-for="g in mine" :key="g.id">
          <button type="button" :class="['game_row', { game_row_mine: myTurn(g) }]" @click="emit('open', g.id)">
            <span class="game_row_name"><span v-if="g.opponent.bot">🤖 </span>{{ g.opponent.name }}</span>
            <span class="game_row_status">{{ statusText(g) }}</span>
            <span class="game_row_lives">🎸 {{ g.me.strings }} vs 🎸 {{ g.opponent.strings }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Online now</h2>
      <p v-if="!home.online.length" class="muted small">Nobody else is online right now.</p>
      <ul class="list">
        <PlayerRow v-for="p in home.online" :key="p.id" :p="p" :busy="busy" @open="(id) => emit('open', id)" @challenge="start" />
      </ul>
    </section>

    <section v-if="home.past.length" class="card">
      <h2>Past opponents</h2>
      <ul class="list">
        <PlayerRow v-for="p in pastShown" :key="p.id" :p="p" :busy="busy" @open="(id) => emit('open', id)" @challenge="start" />
      </ul>
      <button v-if="home.past.length > PAST_SHOWN" type="button" class="btn btn_ghost btn_small more" @click="allPast = !allPast">
        {{ allPast ? 'Show fewer' : `Show all ${home.past.length}` }}</button>
    </section>

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

const props = defineProps<{ refresh: number; me?: Me | null }>()
const emit = defineEmits<{ open: [id: string] }>()
const games = ref<GameView[]>([])
const home = ref<Home>({ online: [], past: [] })
const busy = ref(false)
const error = ref('')
const PAST_SHOWN = 8
const allPast = ref(false)

const challenges = computed(() => games.value.filter((g) => g.turn === 'invited'))
const mine = computed(() => games.value.filter((g) => g.turn !== 'invited'))
const pastShown = computed(() => (allPast.value ? home.value.past : home.value.past.slice(0, PAST_SHOWN)))

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

function myTurn(g: GameView) { return g.turn === 'compose' || g.turn === 'guess' }
function statusText(g: GameView) {
  if (g.status === 'invited') return g.turn === 'compose' ? `Waiting for a yes · write your riff` : `Waiting for ${g.opponent.name} to say yes`
  switch (g.turn) {
    case 'compose': return 'Your turn: write a riff'
    case 'guess': return 'Your turn: guess their riff'
    case 'wait_compose': return 'They are writing a riff'
    case 'wait_guess': return 'They are guessing'
    case 'declined': return 'Said no thanks'
    default: return g.winner === g.me.id ? 'You won 🏆' : 'They won'
  }
}
</script>

<style scoped>
.home { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
h2 { margin: 0 0 8px; font-size: 1.1rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.challenges { border: 1px solid var(--accent); }
.challenge_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.challenge_who { flex: 1; min-width: 140px; }
.game_row { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; background: var(--surface-2); border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text); padding: 10px 12px; cursor: pointer; font: inherit; }
.game_row_mine { border-color: var(--accent); }
.game_row_name { font-weight: 700; }
.game_row_status { grid-column: 1; color: var(--text-muted); font-size: 0.85rem; }
.game_row_mine .game_row_status { color: var(--accent); }
.game_row_lives { grid-row: 1 / span 2; grid-column: 2; align-self: center; font-size: 0.75rem; color: var(--text-muted); }
.search { width: 100%; box-sizing: border-box; font: inherit; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; }
.search:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.more { margin-top: 6px; }
.muted { color: var(--text-muted); }
.small { font-size: 0.8rem; margin: 0; }
.error { color: var(--bad); }
</style>
