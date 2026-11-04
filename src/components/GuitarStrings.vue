<template>
  <!-- Guesses left, drawn as guitar strings: each wrong guess snaps one. -->
  <figure class="guitar" :aria-label="`${left} of ${total} strings left`">
    <svg :viewBox="`0 0 300 ${h}`" class="guitar_svg">
      <!-- neck and headstock -->
      <rect x="40" :y="6" width="250" :height="h - 12" rx="6" class="guitar_neck" />
      <path :d="`M40 6 L8 ${h * 0.18} L8 ${h * 0.82} L40 ${h - 6} Z`" class="guitar_head" />
      <line v-for="f in [100, 155, 205, 250]" :key="f" :x1="f" :x2="f" y1="8" :y2="h - 8" class="guitar_fret" />
      <circle v-for="f in [128, 230]" :key="'d' + f" :cx="f" :cy="h / 2" r="4" class="guitar_dot" />
      <g v-for="i in total" :key="i">
        <circle cx="22" :cy="sy(i)" r="3.2" class="guitar_peg" />
        <template v-if="i <= left">
          <line x1="22" :x2="300" :y1="sy(i)" :y2="sy(i)" :class="['guitar_string', { guitar_string_last: left === 1 }]" :style="{ strokeWidth: 1 + (total - i) * 0.25 }" />
        </template>
        <template v-else>
          <path :d="`M22 ${sy(i)} L150 ${sy(i)} q 10 0 14 6 q 3 6 -4 7`" class="guitar_broken" />
          <path :d="`M300 ${sy(i)} L190 ${sy(i)} q -10 0 -13 -6 q -2 -6 5 -6`" class="guitar_broken" />
        </template>
      </g>
    </svg>
    <figcaption>
      <strong>{{ left }}</strong> of {{ total }} strings left
      <span v-if="left === 1" class="guitar_warn">last string!</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ total: number; left: number }>()
const h = computed(() => 24 + props.total * 12)
function sy(i: number) { return 14 + (i - 0.5) * ((h.value - 28) / props.total) }
</script>

<style scoped>
.guitar { margin: 0; }
.guitar_svg { width: 100%; max-width: 420px; display: block; margin: 0 auto; }
.guitar_neck { fill: #6b3f22; }
.guitar_head { fill: #4a2a15; }
.guitar_fret { stroke: #c9c3b0; stroke-width: 2; }
.guitar_dot { fill: #e9dcc0; opacity: 0.7; }
.guitar_peg { fill: #d8d2c0; }
.guitar_string { stroke: #f2ead2; }
.guitar_string_last { stroke: var(--accent); animation: twang 0.9s ease-in-out infinite; }
.guitar_broken { fill: none; stroke: var(--bad); stroke-width: 1.4; stroke-dasharray: 2 0; opacity: 0.85; }
figcaption { text-align: center; font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; }
figcaption strong { color: var(--text); }
.guitar_warn { color: var(--accent); font-weight: 700; margin-left: 6px; }
@keyframes twang { 50% { opacity: 0.5; } }
</style>
