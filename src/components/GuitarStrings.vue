<template>
  <!-- Guesses left, drawn as a guitar: each wrong guess snaps a string (the ends curl away and fray). -->
  <figure class="guitar" :aria-label="`${left} of ${total} strings left`">
    <svg :viewBox="`0 0 ${W} ${H}`" class="guitar_svg">
      <!-- body (the right end) with its sound hole and bridge -->
      <path :d="bodyPath" class="g_body" />
      <circle :cx="HOLE_X" :cy="H / 2" :r="H * 0.24" class="g_hole_ring" />
      <circle :cx="HOLE_X" :cy="H / 2" :r="H * 0.2" class="g_hole" />
      <rect :x="BRIDGE_X - 4" :y="top - 6" width="8" :height="bottom - top + 12" rx="2" class="g_bridge" />
      <!-- neck, frets, dots -->
      <rect :x="NUT_X" :y="top - 7" :width="NECK_END - NUT_X" :height="bottom - top + 14" class="g_neck" />
      <line v-for="f in FRETS" :key="'f' + f" :x1="f" :x2="f" :y1="top - 7" :y2="bottom + 7" class="g_fret" />
      <circle v-for="d in DOTS" :key="'d' + d" :cx="d" :cy="H / 2" r="3.2" class="g_dot" />
      <!-- headstock and tuning pegs (3 on each side) -->
      <path :d="headPath" class="g_head" />
      <g v-for="(p, i) in pegs" :key="'p' + i">
        <line :x1="p.x" :x2="p.x" :y1="p.y" :y2="p.knobY" class="g_peg_post" />
        <ellipse :cx="p.x" :cy="p.knobY" rx="4.5" ry="3" class="g_peg" />
      </g>
      <rect :x="NUT_X - 3" :y="top - 7" width="4" :height="bottom - top + 14" class="g_nut" />

      <!-- strings: whole ones, then the broken ones -->
      <g v-for="i in total" :key="'s' + i">
        <template v-if="i <= left">
          <polyline :points="`${pegs[(i - 1) % 6].x},${pegs[(i - 1) % 6].y} ${NUT_X},${sy(i)} ${BRIDGE_X},${sy(i)}`"
            :class="['g_string', { g_string_last: left === 1 }]" :style="{ strokeWidth: 0.9 + (i - 1) * 0.28 }" />
        </template>
        <g v-else :class="['g_broken', { g_snap: i === left + 1 && justSnapped }]">
          <!-- the stub still on the peg -->
          <line :x1="pegs[(i - 1) % 6].x" :y1="pegs[(i - 1) % 6].y" :x2="NUT_X" :y2="sy(i)" class="g_broken_line" />
          <!-- left piece: runs to the break, droops, frays -->
          <path :d="leftPiece(i)" class="g_broken_line" />
          <path :d="fray(breakX(i) - 4, sy(i) + 9, 1)" class="g_fray" />
          <!-- right piece: from the bridge back to the break, curls up, frays -->
          <path :d="rightPiece(i)" class="g_broken_line" />
          <path :d="fray(breakX(i) + 14, sy(i) - 9, -1)" class="g_fray" />
        </g>
      </g>
    </svg>
    <figcaption>
      🎸 <strong>{{ left }}</strong> of {{ total }} strings left
      <span class="g_note">· each wrong guess breaks one</span>
      <span v-if="left === 1" class="g_warn">· last string!</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{ total: number; left: number }>()

const W = 372
const H = computed(() => 30 + props.total * 11)
const NUT_X = 58
const NECK_END = 246
const FRETS = [96, 132, 166, 197, 224]
const DOTS = [149, 210]
const HOLE_X = 268
const BRIDGE_X = 336
const top = computed(() => H.value / 2 - ((props.total - 1) * 7) / 2)
const bottom = computed(() => H.value / 2 + ((props.total - 1) * 7) / 2)
function sy(i: number) { return top.value + (i - 1) * 7 }

const headPath = computed(() => {
  const h = H.value
  return `M${NUT_X} ${top.value - 7} L8 ${h * 0.12} Q2 ${h / 2} 8 ${h * 0.88} L${NUT_X} ${bottom.value + 7} Z`
})
/** a guitar body seen from the front: small upper bout, a waist, a bigger lower bout */
const bodyPath = computed(() => {
  const h = H.value
  const y = (f: number) => (h * f).toFixed(1)
  return `M242 ${y(0.2)} C246 ${y(0.0)} 282 ${y(0.0)} 290 ${y(0.16)}`    // upper bout, top
    + ` C296 ${y(0.26)} 302 ${y(-0.06)} 336 ${y(-0.05)} C370 ${y(-0.03)} 370 ${y(0.5)} 370 ${y(0.5)}`    // waist, lower bout
    + ` C370 ${y(0.5)} 370 ${y(1.03)} 336 ${y(1.05)} C302 ${y(1.06)} 296 ${y(0.74)} 290 ${y(0.84)}`
    + ` C282 ${y(1.0)} 246 ${y(1.0)} 242 ${y(0.8)} Z`
})
/** 3 pegs along the top edge of the headstock, 3 along the bottom (for more than 6 strings they repeat). */
const pegs = computed(() => {
  const h = H.value, l: { x: number; y: number; knobY: number }[] = []
  for (let k = 0; k < 3; k++) l.push({ x: 18 + k * 13, y: h * 0.2 + k * 2, knobY: h * 0.2 + k * 2 - 9 })
  for (let k = 0; k < 3; k++) l.push({ x: 44 - k * 13, y: h * 0.8 - (2 - k) * 2, knobY: h * 0.8 - (2 - k) * 2 + 9 })
  return l
})

/** each string breaks at its own place along the neck */
function breakX(i: number) { return 110 + ((i * 37) % 110) }
function leftPiece(i: number) {
  const b = breakX(i), y = sy(i)
  return `M${NUT_X} ${y} L${b - 10} ${y} Q${b - 3} ${y} ${b - 4} ${y + 9}`
}
function rightPiece(i: number) {
  const b = breakX(i) + 18, y = sy(i)
  return `M${BRIDGE_X} ${y} L${b + 10} ${y} Q${b + 3} ${y} ${b - 4} ${y - 9}`
}
/** a few short splayed strands at a broken end; dir 1 = pointing down, -1 = up */
function fray(x: number, y: number, dir: number) {
  const d = dir
  return `M${x} ${y} l-4 ${5 * d} M${x} ${y} l0 ${6 * d} M${x} ${y} l4 ${5 * d} M${x} ${y} l-6 ${2 * d} M${x} ${y} l6 ${2 * d}`
}

// a short wobble on the string that just broke
const justSnapped = ref(false)
watch(() => props.left, (now, before) => {
  if (before !== undefined && now < before) {
    justSnapped.value = true
    window.setTimeout(() => { justSnapped.value = false }, 700)
  }
})
</script>

<style scoped>
.guitar { margin: 0; }
.guitar_svg { width: 100%; max-width: 440px; display: block; margin: 0 auto; overflow: visible; }
.g_body { fill: #b7793f; stroke: #6b3f1d; stroke-width: 2; }
.g_hole_ring { fill: none; stroke: #e8cfa0; stroke-width: 2; opacity: 0.7; }
.g_hole { fill: #2a160a; }
.g_bridge { fill: #3a2210; }
.g_neck { fill: #5a3418; }
.g_fret { stroke: #d9d4c4; stroke-width: 1.8; }
.g_dot { fill: #efe3c6; opacity: 0.8; }
.g_head { fill: #3e2411; stroke: #2a170a; stroke-width: 1; }
.g_peg_post { stroke: #c9c3b0; stroke-width: 2; }
.g_peg { fill: #e6e0cc; stroke: #8c8670; stroke-width: 0.8; }
.g_nut { fill: #f1ead2; }
.g_string { fill: none; stroke: #f4ecd4; stroke-linecap: round; }
.g_string_last { stroke: var(--accent); animation: twang 0.9s ease-in-out infinite; }
.g_broken_line { fill: none; stroke: var(--bad); stroke-width: 1.4; stroke-linecap: round; opacity: 0.9; }
.g_fray { fill: none; stroke: var(--bad); stroke-width: 0.9; stroke-linecap: round; opacity: 0.85; }
.g_snap { animation: snap 0.6s ease-out; transform-box: fill-box; transform-origin: center; }
figcaption { text-align: center; font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; }
figcaption strong { color: var(--text); }
.g_note { font-size: 0.8rem; }
.g_warn { color: var(--accent); font-weight: 700; }
@keyframes twang { 50% { opacity: 0.5; } }
@keyframes snap { 0% { transform: translateY(-3px); } 25% { transform: translateY(3px); } 50% { transform: translateY(-2px); } 75% { transform: translateY(1px); } 100% { transform: none; } }
</style>
