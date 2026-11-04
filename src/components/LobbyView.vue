<template>
  <div class="lobby">
    <button type="button" class="btn btn_primary btn_big" :disabled="starting" @click="start()">
      🎲 Quick match
    </button>
    <p class="muted small">Plays someone who's online, or a bot if nobody is.</p>

    <section class="card">
      <h2>Your games</h2>
      <p v-if="!games.length" class="muted">No games yet. Start one!</p>
      <ul class="list">
        <li v-for="g in games" :key="g.id">
          <button type="button" :class="['game_row', { game_row_mine: myTurn(g) }]" @click="emit('open', g.id)">
            <span class="game_row_name">{{ g.opponent.name }}</span>
            <span class="game_row_status">{{ statusText(g) }}</span>
            <span class="game_row_lives"><EncoreMeter :count="g.me.encores" :max="0" /> vs <EncoreMeter :count="g.opponent.encores" :max="0" /></span>
          </button>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Players</h2>
      <ul class="list">
        <li v-for="p in players" :key="p.id" class="player_row">
          <i :class="['online', { online_on: p.online }]"></i>
          <span class="player_name">{{ p.name }}</span>
          <span class="muted small">{{ p.wins }}–{{ p.losses }}</span>
          <button type="button" class="btn btn_small" :disabled="starting" @click="start(p.id)">Challenge</button>
        </li>
      </ul>
    </section>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { api, type GameView, type Lobbyist } from '../ts/api'
import EncoreMeter from './EncoreMeter.vue'

const props = defineProps<{ refresh: number }>()
const emit = defineEmits<{ open: [id: string] }>()
const games = ref<GameView[]>([])
const players = ref<Lobbyist[]>([])
const starting = ref(false)
const error = ref('')

async function load() {
  try { [games.value, players.value] = await Promise.all([api.games(), api.players()]) } catch (e) { error.value = (e as Error).message }
}
watch(() => props.refresh, load, { immediate: true })

async function start(opponentId?: string) {
  starting.value = true
  try { const g = await api.start(opponentId); emit('open', g.id) } catch (e) { error.value = (e as Error).message } finally { starting.value = false }
}
function myTurn(g: GameView) { return g.turn === 'compose' || g.turn === 'guess' }
function statusText(g: GameView) {
  switch (g.turn) {
    case 'compose': return 'Your turn: write a riff'
    case 'guess': return 'Your turn: guess their riff'
    case 'wait_compose': return 'They are writing a riff'
    case 'wait_guess': return 'They are guessing'
    default: return g.winner === g.me.id ? 'You won 🏆' : 'They won'
  }
}
</script>

<style scoped>
.lobby { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
h2 { margin: 0 0 8px; font-size: 1.1rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.game_row { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; background: var(--surface-2); border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text); padding: 10px 12px; cursor: pointer; font: inherit; }
.game_row_mine { border-color: var(--accent); }
.game_row_name { font-weight: 700; }
.game_row_status { grid-column: 1; color: var(--text-muted); font-size: 0.85rem; }
.game_row_mine .game_row_status { color: var(--accent); }
.game_row_lives { grid-row: 1 / span 2; grid-column: 2; align-self: center; font-size: 0.75rem; color: var(--text-muted); }
.player_row { display: flex; align-items: center; gap: 8px; }
.player_name { flex: 1; }
.online { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
.online_on { background: var(--good); }
.muted { color: var(--text-muted); }
.small { font-size: 0.8rem; margin: 0; }
.error { color: var(--bad); }
</style>
