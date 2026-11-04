<template>
  <!-- A small drawing of a note of this length, for the length buttons. -->
  <svg viewBox="0 0 28 34" width="22" height="28" aria-hidden="true" class="glyph">
    <ellipse cx="11" cy="26" rx="6.5" ry="4.8" transform="rotate(-20 11 26)" :class="beats >= 2 ? 'open' : 'fill'" />
    <line v-if="beats < 4" x1="16.8" x2="16.8" y1="25" y2="3" />
    <path v-if="beats < 1" d="M16.8 3 q 9 6 7 16" />
    <circle v-if="beats === 1.5 || beats === 0.75 || beats === 3" cx="24" cy="25" r="2" class="fill" />
  </svg>
</template>
<script setup lang="ts">
defineProps<{ beats: number }>()
</script>
<style scoped>
.glyph line, .glyph path { stroke: currentColor; stroke-width: 2; fill: none; }
.fill { fill: currentColor; }
.open { fill: none; stroke: currentColor; stroke-width: 2; }
</style>
