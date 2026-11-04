<template>
  <!-- Lives, shown as Encores: spotlights that go dark when lost. -->
  <span class="encores" :aria-label="`${count} encores`" :title="`${count} Encores left`">
    <span v-for="i in Math.max(count, max)" :key="i" :class="['encore', { encore_out: i > count }]">🎤</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ count: number; max: number }>()
</script>

<style scoped>
.encores { display: inline-flex; gap: 2px; font-size: 1.05rem; }
.encore_out { filter: grayscale(1); opacity: 0.25; }
</style>
