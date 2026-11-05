<template>
  <header class="app_header">
    <button type="button" class="app_brand" @click="go('')"><span aria-hidden="true">🎸</span> {{ gameName }}</button>
    <!-- the menu: who you are and Sign out (room for more later) -->
    <nav v-if="me" class="app_menu">
      <button type="button" class="app_menu_btn" :aria-expanded="menuOpen" aria-label="Menu" @click.stop="menuOpen = !menuOpen">☰</button>
      <div v-if="menuOpen" class="app_menu_panel" role="menu" @click.stop>
        <div class="app_menu_who">
          <span class="muted">Signed in as</span>
          <strong>{{ me.name }}</strong>
        </div>
        <button type="button" class="app_menu_item" role="menuitem" @click="menuOpen = false; signOut()">Sign out</button>
      </div>
    </nav>
  </header>

  <main class="app_main">
    <p v-if="!config && !loadError" class="muted">Loading…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>
    <SignIn v-else-if="!me" :config="config!" @signed-in="onSignedIn" />
    <template v-else-if="rules">
      <GameView v-if="route.gameId" :game-id="route.gameId" :rules="rules" :refresh="refresh"
        :developer="!!me.attributes?.includes('developer')" @back="go('')" @rematch="rematch" />
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
// the ☰ menu closes on a tap anywhere else, on Escape, and when the page changes
const menuOpen = ref(false)
document.addEventListener('click', () => { menuOpen.value = false })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menuOpen.value = false })
window.addEventListener('hashchange', () => { menuOpen.value = false })

async function signOut() {
  await api.logout(); me.value = null; stopPolling(); go('')
  toasts.value = []
  shown.splice(0).forEach((n) => n.close())
}
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
    // by its number: the array holds Vue's wrapped copies, so "t !== e" never matched and toasts never went away
    window.setTimeout(() => { toasts.value = toasts.value.filter((t) => t.seq !== e.seq) }, 6000)
  }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(gameName.value, { body: e.text, tag: e.gameId })
    n.onclick = () => { window.focus(); go('game/' + e.gameId) }
    shown.push(n)
  }
  if (navigator.vibrate && (e.type === 'riff_ready' || e.type === 'round_over')) navigator.vibrate(80)
}
function openToast(t: GameEvent) { toasts.value = toasts.value.filter((x) => x.seq !== t.seq); go('game/' + t.gameId) }

// phone notifications (shown while the page was in the background) close once you're back in the game
const shown: Notification[] = []
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) shown.splice(0).forEach((n) => n.close())
})
</script>

<style scoped>
.app_header { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 10px 16px; padding-top: max(10px, env(safe-area-inset-top)); background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); }
.app_brand { background: none; border: 0; color: var(--text); font: inherit; font-weight: 800; font-size: 1.1rem; cursor: pointer; padding: 0; }
.app_menu { position: relative; }
.app_menu_btn { width: 42px; height: 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-size: 1.3rem; line-height: 1; cursor: pointer; }
.app_menu_panel {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 200px; max-width: 80vw; z-index: 30; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 8px; display: grid; gap: 4px;
}
.app_menu_who { display: grid; padding: 6px 8px 10px; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.app_menu_who strong { font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app_menu_item { text-align: left; background: none; border: 0; color: var(--text); font: inherit; padding: 10px 8px; border-radius: var(--radius-sm); cursor: pointer; }
.app_menu_item:hover { background: var(--surface-2); }
.app_main { max-width: 640px; margin: 0 auto; padding: 14px 16px 40px; }
.toasts { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); left: 16px; right: 16px; display: grid; gap: 8px; z-index: 20; justify-items: center; }
.toast { max-width: 480px; width: 100%; background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 12px 14px; font: inherit; font-weight: 600; box-shadow: var(--shadow); cursor: pointer; text-align: left; }
.muted { color: var(--text-muted); }
.error { color: var(--bad); }
</style>
