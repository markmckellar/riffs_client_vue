<template>
  <!-- One game in a list: the opponent, what's happening, and strings left. Highlighted when it's your turn. -->
  <li>
    <button type="button" :class="['game_row', { game_row_mine: myTurn(g) }]" @click="emit('open', g.id)">
      <span class="game_row_name"><span v-if="g.opponent.bot">🤖 </span>{{ g.opponent.name }}</span>
      <span class="game_row_status">{{ statusText(g) }}</span>
      <span class="game_row_lives">🎸 {{ g.me.strings }} vs 🎸 {{ g.opponent.strings }}</span>
    </button>
  </li>
</template>

<script lang="ts">
import type { GameView } from '../ts/api'

export function myTurn(g: GameView) { return g.turn === 'compose' || g.turn === 'guess' }
export function waiting(g: GameView) { return g.turn === 'wait_compose' || g.turn === 'wait_guess' || (g.status === 'invited' && !myTurn(g)) }

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

<script setup lang="ts">
defineProps<{ g: GameView }>()
const emit = defineEmits<{ open: [id: string] }>()
</script>

<style scoped>
.game_row { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; background: var(--surface-2); border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text); padding: 10px 12px; cursor: pointer; font: inherit; }
.game_row_mine { border-color: var(--accent); }
.game_row_name { font-weight: 700; }
.game_row_status { grid-column: 1; color: var(--text-muted); font-size: 0.85rem; }
.game_row_mine .game_row_status { color: var(--accent); }
.game_row_lives { grid-row: 1 / span 2; grid-column: 2; align-self: center; font-size: 0.75rem; color: var(--text-muted); }
</style>
