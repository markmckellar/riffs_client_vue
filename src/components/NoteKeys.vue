<template>
  <!-- The note keyboard picked in InputPicker: piano keys or a fretboard. Both emit the same "press". -->
  <PianoKeys v-if="!method.strings" :lowest="lowest" :highest="highest" :current="current" :instrument="instrument"
    @press="(m) => emit('press', m)" />
  <Fretboard v-else :key="method.id" :strings="method.strings" :frets="method.frets ?? 5" :name="method.name"
    :lowest="lowest" :highest="highest" :current="current" :instrument="instrument" @press="(m) => emit('press', m)" />
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
