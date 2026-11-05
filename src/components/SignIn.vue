<template>
  <div class="signin card">
    <div class="signin_logo">🎵🎸🎶</div>
    <h2>Welcome to {{ config.game }}</h2>
    <p class="muted">Write a short riff, send it to a friend, and see if they can write it back down by ear. Then it's your turn to listen.</p>
    <div v-show="config.googleClientId" ref="googleButton" class="signin_google"></div>
    <form v-if="config.devLogin || config.guestLogin" class="signin_dev" @submit.prevent="dev">
      <label>{{ config.devLogin ? 'Test sign-in (no Google):' : (config.googleClientId ? 'Or play as a guest:' : 'Play as a guest. Pick a name:') }}
        <input v-model="name" maxlength="30" placeholder="Your name" autocomplete="nickname" /></label>
      <button type="submit" class="btn btn_primary" :disabled="!name.trim()">Play</button>
    </form>
    <p v-if="!config.googleClientId && !config.devLogin && !config.guestLogin" class="error">Sign-in isn't set up on this server yet.</p>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type AuthConfig, type Me } from '../ts/api'

declare global {
  interface Window { google?: { accounts: { id: {
    initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void
    renderButton(el: HTMLElement, o: Record<string, string>): void
  } } } }
}

const props = defineProps<{ config: AuthConfig }>()
const emit = defineEmits<{ signedIn: [Me] }>()
const name = ref('')
const error = ref('')
const googleButton = ref<HTMLElement | null>(null)

async function dev() {
  const n = name.value.trim()
  try { emit('signedIn', await (props.config.devLogin ? api.devLogin(n) : api.guestLogin(n))) } catch (e) { error.value = (e as Error).message }
}

onMounted(() => {
  if (!props.config.googleClientId) return
  const s = document.createElement('script')
  s.src = 'https://accounts.google.com/gsi/client'
  s.async = true
  s.onload = () => {
    window.google!.accounts.id.initialize({
      client_id: props.config.googleClientId,
      ux_mode: 'popup',
      callback: async (r) => {
        try { emit('signedIn', await api.google(r.credential)) } catch (e) { error.value = (e as Error).message }
      },
    })
    window.google!.accounts.id.renderButton(googleButton.value!, { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill' })
  }
  document.head.appendChild(s)
})
</script>

<style scoped>
.signin { text-align: center; display: grid; gap: 10px; justify-items: center; padding: 28px 18px; }
.signin_logo { font-size: 2.4rem; }
.signin h2 { margin: 0; }
.signin_google { min-height: 44px; }
.signin_dev { display: grid; gap: 8px; width: 100%; max-width: 300px; }
.signin_dev label { display: grid; gap: 4px; font-size: 0.85rem; color: var(--text-muted); }
.signin_dev input { font: inherit; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.muted { color: var(--text-muted); max-width: 34em; }
.error { color: var(--bad); }
</style>
