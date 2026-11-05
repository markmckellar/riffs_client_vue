<template>
  <header class="app_header">
    <button type="button" class="app_brand" @click="go('')"><span aria-hidden="true">🎸</span> {{ gameName }}</button>
    <nav v-if="me" class="app_user">
      <span class="app_user_name">{{ me.name }}</span>
      <button type="button" class="tool" @click="signOut">Sign out</button>
    </nav>
  </header>

  <main class="app_main">
    <p v-if="!config && !loadError" class="muted">Loading…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>
    <SignIn v-else-if="!me" :config="config!" @signed-in="onSignedIn" />
    <template v-else-if="rules">
      <GameView v-if="route.gameId" :game-id="route.gameId" :rules="rules" :refresh="refresh" @back="go('')" @rematch="rematch" />
      <LobbyView v-else :refresh="refresh" :me="me" @open="(id) => go('game/' + id)" @learner="setLearner" />
    </template>
  </main>

  <div class="toasts" aria-live="polite">
    <button v-for="t in toasts" :key="t.seq" type="button" class="toast" @click="openToast(t)">{{ t.text }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { api, ApiError, type AuthConfig, type GameEvent, type Me, type Rules } from './ts/api'
import SignIn from './components/SignIn.vue'
import LobbyView from './components/LobbyView.vue'
import GameView from './components/GameView.vue'

const config = ref<AuthConfig | null>(null)
// the name comes from the server (riffs.game-name); .env's VITE_GAME_NAME until it answers
const gameName = computed(() => config.value?.game || import.meta.env.VITE_GAME_NAME)
watch(gameName, (n) => { document.title = n })
const me = ref<Me | null>(null)
const rules = ref<Rules | null>(null)
const loadError = ref('')
const refresh = ref(0)
const toasts = ref<GameEvent[]>([])

// #/game/<id> or the lobby; the phone's back button works
const route = reactive<{ gameId: string | null }>({ gameId: null })
function readHash() { const m = /^#\/game\/([\w-]+)/.exec(location.hash); route.gameId = m ? m[1] : null }
function go(path: string) { location.hash = '#/' + path }
window.addEventListener('hashchange', readHash)
readHash()

onMounted(async () => {
  try {
    config.value = await api.config()
    me.value = config.value.me
    if (me.value) await signedInSetup()
  } catch {
    loadError.value = "Can't reach the game server."
  }
})

async function onSignedIn(m: Me) { me.value = m; await signedInSetup() }
async function signedInSetup() {
  rules.value = await api.rules()
  startPolling()
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => {})
}
async function setLearner(on: boolean) { try { me.value = await api.setLearner(on) } catch { /* offline: unchanged */ } }
async function signOut() { await api.logout(); me.value = null; stopPolling(); go('') }
async function rematch(opponentId: string) { const g = await api.start(opponentId); go('game/' + g.id) }

// ---- hearing about the other player's moves: ask the server every few seconds
let seq = 0
let timer = 0
function startPolling() {
  stopPolling()
  const poll = async () => {
    try {
      const r = await api.events(seq)
      if (seq !== 0 && r.events.length) {
        refresh.value++
        for (const e of r.events) notify(e)
      }
      seq = r.seq
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { me.value = null; stopPolling(); return }
    }
    timer = window.setTimeout(poll, document.hidden ? 15000 : 3000)
  }
  void poll()
}
function stopPolling() { clearTimeout(timer) }
onBeforeUnmount(stopPolling)

function notify(e: GameEvent) {
  const openHere = route.gameId === e.gameId
  if (!openHere || document.hidden) {
    toasts.value.push(e)
    window.setTimeout(() => { toasts.value = toasts.value.filter((t) => t !== e) }, 6000)
  }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(gameName.value, { body: e.text, tag: e.gameId })
    n.onclick = () => { window.focus(); go('game/' + e.gameId) }
  }
  if (navigator.vibrate && (e.type === 'riff_ready' || e.type === 'round_over')) navigator.vibrate(80)
}
function openToast(t: GameEvent) { toasts.value = toasts.value.filter((x) => x !== t); go('game/' + t.gameId) }
</script>

<style scoped>
.app_header { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 10px 16px; padding-top: max(10px, env(safe-area-inset-top)); background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); }
.app_brand { background: none; border: 0; color: var(--text); font: inherit; font-weight: 800; font-size: 1.1rem; cursor: pointer; padding: 0; }
.app_user { display: flex; align-items: center; gap: 8px; min-width: 0; }
.app_user_name { color: var(--text-muted); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw; }
.app_main { max-width: 640px; margin: 0 auto; padding: 14px 16px 40px; }
.toasts { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); left: 16px; right: 16px; display: grid; gap: 8px; z-index: 20; justify-items: center; }
.toast { max-width: 480px; width: 100%; background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 12px 14px; font: inherit; font-weight: 600; box-shadow: var(--shadow); cursor: pointer; text-align: left; }
.muted { color: var(--text-muted); }
.error { color: var(--bad); }
</style>
