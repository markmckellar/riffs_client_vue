<template>
  <!-- The note keyboard, with the instrument tabs on its top edge. One choice sets both how riffs sound and how notes
       are entered: guitar and bass get a fretboard, the rest piano keys. The tabs scroll sideways when they don't fit
       (like filter chips in phone apps); the picked one is remembered (ts/instrument.ts). -->
  <div class="note_keys">
    <div ref="strip" class="nk_tabs" role="tablist" aria-label="Instrument">
      <button v-for="i in INSTRUMENTS" :key="i.id" type="button" role="tab" :aria-selected="i.id === picked.id"
        :class="['nk_tab', { nk_on: i.id === picked.id }]" @click="pick(i.id)">
        <span class="nk_emoji" aria-hidden="true">{{ i.emoji }}</span>{{ i.name }}
      </button>
    </div>
    <div class="nk_board" role="tabpanel">
      <PianoKeys v-if="!picked.strings" :lowest="lowest" :highest="highest" :current="current" :instrument="picked.id"
        @press="(m) => emit('press', m)" />
      <Fretboard v-else :key="picked.id" :strings="picked.strings" :frets="picked.frets ?? 5" :name="picked.name"
        :lowest="lowest" :highest="highest" :current="current" :instrument="picked.id" @press="(m) => emit('press', m)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { INSTRUMENTS, blip } from '../ts/synth'
import { instrument } from '../ts/instrument'
import PianoKeys from './PianoKeys.vue'
import Fretboard from './Fretboard.vue'

defineProps<{ lowest: number; highest: number; current: number | null }>()
const emit = defineEmits<{ press: [midi: number] }>()
const picked = computed(() => INSTRUMENTS.find((i) => i.id === instrument.value) ?? INSTRUMENTS[0])
const strip = ref<HTMLElement | null>(null)

function pick(id: string) {
  instrument.value = id    // shared by every screen and remembered
  blip(67, id)
  void nextTick(showPicked)
}
/** keep the picked tab in view (it may be past the right edge on a narrow phone) */
function showPicked() {
  const el = strip.value?.querySelector<HTMLElement>('.nk_on')
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}
onMounted(() => {
  const el = strip.value?.querySelector<HTMLElement>('.nk_on')
  if (el && strip.value) strip.value.scrollLeft = Math.max(0, el.offsetLeft - 8)
})
</script>

<style scoped>
.note_keys { display: grid; grid-template-columns: minmax(0, 1fr); }
/* folder-style tabs on the keyboard's top edge; the picked one joins the board below it */
.nk_tabs {
  display: flex; gap: 2px; padding: 0 8px; overflow-x: auto; margin-bottom: -1px; position: relative; z-index: 1; scrollbar-width: none; overscroll-behavior-x: contain;
  /* fade at the right edge: a hint that more tabs are there */
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}
.nk_tabs::-webkit-scrollbar { display: none; }
.nk_tab {
  flex: none; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); background: transparent; white-space: nowrap;
  border: 1px solid transparent; border-bottom: 0; border-radius: 9px 9px 0 0; padding: 6px 11px 5px; min-height: 34px;
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  position: relative;
}
.nk_tab:active { color: var(--text); }
.nk_on { color: var(--text); background: var(--surface-2); border-color: var(--border); z-index: 1; }
/* the strip overlaps the board by 1px, so the picked tab covers the board's top border: tab and board read as one piece */
.nk_on::before { content: ''; position: absolute; left: 11px; right: 11px; top: 2px; height: 2px; border-radius: 2px; background: var(--accent); }
.nk_emoji { font-size: 0.95rem; line-height: 1; }
.nk_tab:focus-visible { outline: 2px solid var(--accent-2); outline-offset: -2px; }
.nk_board { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 5px; }
</style>
