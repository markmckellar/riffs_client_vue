<template>
  <div class="instruments" role="radiogroup" aria-label="Sound">
    <button v-for="i in INSTRUMENTS" :key="i.id" type="button" role="radio" :aria-checked="model === i.id"
      :class="['chip', { chip_on: model === i.id }]" @click="pick(i.id)">
      <span aria-hidden="true">{{ i.emoji }}</span> {{ i.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { INSTRUMENTS, blip } from '../ts/synth'
const model = defineModel<string>({ required: true })
function pick(id: string) {
  model.value = id
  try { localStorage.setItem('rifts_instrument', id) } catch { /* storage blocked */ }
  blip(67, id)
}
</script>

<style scoped>
.instruments { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
</style>
