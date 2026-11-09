<template>
  <!-- One person or bot to play: online dot, name, record, and Challenge (only when they're online; bots always are),
       or Open when you already have a game with them. -->
  <li class="player_row">
    <i :class="['online', { online_on: p.online }]" :title="p.online ? 'online' : 'offline'"></i>
    <span class="player_name">
      <span><span v-if="p.bot">🤖 </span>{{ p.name }}</span>
      <small class="muted">{{ p.bot ? p.level : `${p.wins}–${p.losses}` }}<template v-if="p.lastPlayed"> · played {{ ago(p.lastPlayed) }}</template></small>
    </span>
    <button v-if="p.game" type="button" class="btn btn_small" @click="emit('open', p.game)">Open</button>
    <button v-else-if="p.online" type="button" class="btn btn_small" :disabled="busy" @click="emit('challenge', p.id)">
      {{ p.bot ? 'Play' : 'Challenge' }}</button>
    <span v-else class="muted offline">offline</span>
  </li>
</template>

<script setup lang="ts">
import type { PlayerEntry } from '../ts/api'

defineProps<{ p: PlayerEntry; busy?: boolean }>()
const emit = defineEmits<{ open: [gameId: string]; challenge: [playerId: string] }>()

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
</script>

<style scoped>
.player_row { display: flex; align-items: center; gap: 8px; min-height: 40px; }
.player_name { flex: 1; min-width: 0; display: grid; }
.player_name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.player_name small { font-size: 0.75rem; text-transform: none; }
.online { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
.online_on { background: var(--good); }
.offline { font-size: 0.8rem; padding: 0 6px; }
.muted { color: var(--text-muted); }
</style>
