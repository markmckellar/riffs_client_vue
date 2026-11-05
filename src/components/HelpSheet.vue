<template>
  <!-- A ⓘ button that opens a help sheet (slides up from the bottom on a phone). Opens by itself the first time
       a player sees this screen (remembered per screen in the browser), then only when tapped. -->
  <button type="button" class="help_btn" :aria-label="'Help: ' + title" @click="open = true">ⓘ</button>
  <Teleport to="body">
    <div v-if="open" class="help_backdrop" @click.self="close">
      <section class="help_sheet" role="dialog" aria-modal="true" :aria-label="title">
        <header class="help_head">
          <h2>{{ title }}</h2>
          <button type="button" class="help_close" aria-label="Close" @click="close">✕</button>
        </header>
        <div class="help_body"><slot /></div>
        <button type="button" class="btn btn_primary help_ok" @click="close">Got it</button>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ title: string; /** remembers "seen" per screen */ storageKey: string }>()
const open = ref(false)

function seen(): boolean { try { return localStorage.getItem(props.storageKey) === '1' } catch { return true } }
function close() {
  open.value = false
  try { localStorage.setItem(props.storageKey, '1') } catch { /* storage blocked: it may open again next time */ }
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) close() }
onMounted(() => {
  if (!seen()) open.value = true
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.help_btn {
  width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2);
  color: var(--accent-2); font-size: 1.1rem; line-height: 1; cursor: pointer; flex: none;
}
.help_backdrop {
  position: fixed; inset: 0; z-index: 50; background: rgba(8, 6, 20, 0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.help_sheet {
  width: 100%; max-width: 560px; max-height: 85vh; overflow: auto; background: var(--surface); color: var(--text);
  border-radius: var(--radius) var(--radius) 0 0; padding: 14px 16px max(16px, env(safe-area-inset-bottom));
  box-shadow: var(--shadow); animation: up 0.2s ease-out;
}
@media (min-width: 600px) { .help_backdrop { align-items: center; } .help_sheet { border-radius: var(--radius); } }
.help_head { display: flex; justify-content: space-between; align-items: center; }
.help_head h2 { margin: 0; font-size: 1.15rem; }
.help_close { background: none; border: 0; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; min-width: 40px; min-height: 40px; }
.help_body { font-size: 0.92rem; line-height: 1.45; }
.help_body :deep(h3) { font-size: 0.95rem; margin: 14px 0 6px; color: var(--accent); }
.help_body :deep(dl) { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; align-items: center; }
.help_body :deep(dt) { font-weight: 700; display: flex; align-items: center; justify-content: center; min-width: 40px; }
.help_body :deep(dd) { margin: 0; }
.help_body :deep(p) { margin: 6px 0; }
.help_body :deep(.muted) { color: var(--text-muted); }
.help_ok { width: 100%; margin-top: 14px; }
@keyframes up { from { transform: translateY(30px); opacity: 0; } }
</style>
