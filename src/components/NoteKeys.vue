<template>
  <!-- The note keyboard, with small tabs on its top edge to switch between piano, guitar and bass: one tap, right
       where your thumb already is (like the mode tabs on a phone keyboard). The picked one is remembered. -->
  <div class="note_keys">
    <div class="nk_tabs" role="tablist" aria-label="Enter notes with">
      <button v-for="m in INPUT_METHODS" :key="m.id" type="button" role="tab" :aria-selected="m.id === method.id"
        :class="['nk_tab', { nk_on: m.id === method.id }]" @click="inputMethod = m.id">
        <span class="nk_emoji" aria-hidden="true">{{ m.emoji }}</span>{{ m.name }}
      </button>
    </div>
    <div class="nk_board" role="tabpanel">
      <PianoKeys v-if="!method.strings" :lowest="lowest" :highest="highest" :current="current" :instrument="instrument"
        @press="(m) => emit('press', m)" />
      <Fretboard v-else :key="method.id" :strings="method.strings" :frets="method.frets ?? 5" :name="method.name"
        :lowest="lowest" :highest="highest" :current="current" :instrument="instrument" @press="(m) => emit('press', m)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { INPUT_METHODS, inputMethod } from '../ts/input'
import PianoKeys from './PianoKeys.vue'
import Fretboard from './Fretboard.vue'

defineProps<{ lowest: number; highest: number; current: number | null; instrument: string }>()
const emit = defineEmits<{ press: [midi: number] }>()
const method = computed(() => INPUT_METHODS.find((m) => m.id === inputMethod.value) ?? INPUT_METHODS[0])
</script>

<style scoped>
.note_keys { display: grid; grid-template-columns: minmax(0, 1fr); }
/* folder-style tabs on the keyboard's top edge; the picked one joins the board below it */
.nk_tabs { display: flex; gap: 3px; padding-left: 8px; }
.nk_tab {
  font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); background: transparent;
  border: 1px solid transparent; border-bottom: 0; border-radius: 9px 9px 0 0; padding: 6px 12px 5px; min-height: 32px;
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  position: relative; top: 1px;
}
.nk_tab:active { color: var(--text); }
.nk_on { color: var(--text); background: var(--surface-2); border-color: var(--border); z-index: 1; }
/* the picked tab covers the board's top border, so tab and board read as one piece */
.nk_on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--surface-2); }
.nk_on::before { content: ''; position: absolute; left: 12px; right: 12px; top: 2px; height: 2px; border-radius: 2px; background: var(--accent); }
.nk_emoji { font-size: 0.95rem; line-height: 1; }
.nk_tab:focus-visible { outline: 2px solid var(--accent-2); outline-offset: -2px; }
.nk_board { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 5px; }
</style>
