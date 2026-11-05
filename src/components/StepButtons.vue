<template>
  <!-- Up and down a half step in one button's space: ▲ on top, ▼ underneath. -->
  <span class="steps" role="group" aria-label="Move the note up or down a half step">
    <button type="button" class="steps_btn steps_up" :disabled="disabled" title="Up a half step (♯)" aria-label="Up a half step"
      @click="emit('up')">▲<small v-if="labels">♯</small></button>
    <button type="button" class="steps_btn steps_down" :disabled="disabled" title="Down a half step (♭)" aria-label="Down a half step"
      @click="emit('down')">▼<small v-if="labels">♭</small></button>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean; /** show ♯ / ♭ next to the arrows */ labels?: boolean }>(), { disabled: false, labels: false })
const emit = defineEmits<{ up: []; down: [] }>()
</script>

<style scoped>
.steps { display: inline-flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; flex: none; }
.steps_btn {
  font: inherit; font-size: 0.8rem; line-height: 1; background: var(--surface-2); color: var(--text); border: 0;
  min-width: 46px; height: 25px; padding: 0 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 3px;
}
.steps_btn small { font-size: 0.75rem; opacity: 0.8; }
.steps_up { border-bottom: 1px solid var(--border); }
.steps_btn:active:not(:disabled) { background: var(--accent-2); color: #08243a; }
.steps_btn:disabled { opacity: 0.4; cursor: default; }
</style>
