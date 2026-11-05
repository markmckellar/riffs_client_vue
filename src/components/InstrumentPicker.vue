<template>
  <!-- Which sound riffs play with, on this phone. A small drop-down to save space. -->
  <label class="instrument">
    <span v-if="!bare" class="instrument_label">Sound</span>
    <select :value="instrument" aria-label="Sound" @change="pick(($event.target as HTMLSelectElement).value)">
      <option v-for="i in INSTRUMENTS" :key="i.id" :value="i.id">{{ i.emoji }} {{ i.name }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { INSTRUMENTS, blip } from '../ts/synth'
import { instrument } from '../ts/instrument'

defineProps<{ /** no "Sound" label (when it shares a crowded row) */ bare?: boolean }>()
function pick(id: string) {
  instrument.value = id    // shared by every screen and remembered (ts/instrument.ts)
  blip(67, id)
}
</script>

<style scoped>
.instrument { flex: none; display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); }
.instrument select {
  font: inherit; font-size: 0.95rem; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 6px 30px 6px 12px; min-height: 36px; cursor: pointer; appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 55%, calc(100% - 11px) 55%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.instrument select:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }
</style>
