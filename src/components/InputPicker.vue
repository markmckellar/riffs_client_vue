<template>
  <!-- How notes are entered: piano keys, a guitar or a bass fretboard. A small drop-down, like Sound. -->
  <select class="input_pick" :value="inputMethod" aria-label="Enter notes with" title="Enter notes with"
    @change="inputMethod = ($event.target as HTMLSelectElement).value">
    <option v-for="m in INPUT_METHODS" :key="m.id" :value="m.id">{{ m.emoji }} {{ m.name }}</option>
  </select>
</template>

<script setup lang="ts">
import { INPUT_METHODS, inputMethod } from '../ts/input'
</script>

<style scoped>
.input_pick {
  flex: none; font: inherit; font-size: 0.95rem; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 6px 30px 6px 12px; min-height: 36px; cursor: pointer; appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 55%, calc(100% - 11px) 55%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.input_pick:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }
</style>
