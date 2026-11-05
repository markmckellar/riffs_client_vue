<template>
  <ol class="history">
    <li v-for="(g, i) in guesses" :key="i" :class="{ history_win: g.correct }">
      <span class="history_n">{{ i + 1 }}</span>
      <span v-for="(n, j) in g.notes" :key="j" :class="['history_note', 'mark_' + g.marks[j], { history_len: g.lengths?.[j] === 'wrong' }]"
        :title="g.lengths?.[j] === 'wrong' ? 'wrong length' : ''">
        {{ noteName(n) }}<small v-if="g.hints[j]">{{ g.hints[j] === 'up' ? '↑' : '↓' }}</small>
      </span>
    </li>
  </ol>
</template>
<script setup lang="ts">
import type { Guess } from '../ts/api'
import { noteName } from '../ts/music'
defineProps<{ guesses: Guess[] }>()
</script>
<style scoped>
.history { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.history li { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.history_n { width: 1.4em; color: var(--text-muted); font-size: 0.8rem; }
.history_note { font-size: 0.75rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; color: #1b1530; }
.history_note small { margin-left: 1px; }
.history_len { outline: 2px dashed var(--bad); outline-offset: 1px; }
.mark_exact { background: var(--good); } .mark_octave { background: var(--accent-2); }
.mark_close { background: var(--accent); } .mark_miss { background: var(--bad); color: #fff; }
</style>
