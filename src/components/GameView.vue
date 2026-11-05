<template>
  <div v-if="game" class="game">
    <div class="scoreboard">
      <div class="side">
        <span class="side_name">You<span v-if="game.me.learner" title="learner mode"> 🎓</span></span>
        <GuitarStrings compact :total="rules.strings" :left="game.me.strings" />
        <span class="side_pts">🎸 {{ game.me.strings }} strings · {{ game.me.points }} pts</span>
      </div>
      <div class="vs">Round {{ current.number }}</div>
      <div class="side side_right">
        <span class="side_name"><span v-if="game.opponent.bot" title="bot">🤖 </span><span v-if="game.opponent.learner" title="learner mode: they get ear-training helpers">🎓 </span>{{ game.opponent.name }} <i v-if="game.opponent.online && !game.opponent.bot" class="online" title="online"></i></span>
        <span v-if="game.opponent.level" :class="['level', 'level_' + game.opponent.level]">{{ game.opponent.level }}</span>
        <GuitarStrings compact :total="rules.strings" :left="game.opponent.strings" />
        <span class="side_pts">🎸 {{ game.opponent.strings }} strings · {{ game.opponent.points }} pts</span>
      </div>
    </div>

    <!-- one row: what happened last round, hear that riff, and the sound to play riffs with -->
    <div v-if="lastDone && game.turn !== 'over'" class="card reveal">
      <div class="reveal_text">
        <strong>Round {{ lastDone.number }}:</strong>
        {{ revealText(lastDone) }}
        <span v-if="lastDone.tier" class="tier">{{ TIER_LABEL[lastDone.tier] }}</span>
      </div>
      <button v-if="lastDone.riff" type="button" class="tool reveal_hear" title="Hear that riff" @click="play(lastDone.riff, instrument, 100)">▶ Hear it</button>
      <InstrumentPicker v-model="instrument" bare />
    </div>
    <!-- round 1 (nothing to report yet): just the sound picker -->
    <div v-else class="sound_row"><InstrumentPicker v-model="instrument" /></div>

    <div class="card">
      <RiffComposer v-if="game.turn === 'compose'" :key="'c' + current.number" :game-id="game.id" :rules="rules"
        :instrument="instrument" :opponent-name="game.opponent.name" @send="sendRiff" />

      <RiffGuesser v-else-if="game.turn === 'guess'" :round="current" :rules="rules" :instrument="instrument" :me="game.me"
        :busy="busy" @guess="guess" @hint="act(() => api.hint(game!.id))" @extra-string="act(() => api.extraString(game!.id))"
        @learner="(on) => act(async () => { await api.setLearner(on); return api.game(game!.id) })" />

      <div v-else-if="game.turn === 'wait_compose'" class="waiting">
        <div class="waiting_icon">✍️🎼</div>
        <p><strong>{{ game.opponent.name }}</strong> is writing a riff for you{{ game.opponent.bot ? ' (thinking…)' : '' }}.</p>
        <p class="muted">You'll be told when it arrives.</p>
      </div>

      <div v-else-if="game.turn === 'wait_guess'" class="watching">
        <h2>{{ game.opponent.name }} is guessing your riff</h2>
        <StaffEditor :model-value="current.riff ?? []" mode="view" :highlight="playing" />
        <div class="row">
          <button type="button" class="btn" @click="playMine">▶ Play my riff</button>
          <span v-if="current.tier" class="tier">{{ TIER_LABEL[current.tier] }} · {{ current.score }}</span>
        </div>
        <p class="muted">🎸 {{ game.opponent.name }} has {{ game.opponent.strings }} strings left<template v-if="current.wrong">
          · your riff has snapped {{ current.wrong }} so far</template>.</p>
        <GuessHistory v-if="current.guesses.length" :guesses="current.guesses" />
        <p v-else class="muted">No guesses yet.</p>
      </div>

      <div v-else class="over">
        <div class="over_icon">{{ won ? '🏆' : '🎻' }}</div>
        <h2>{{ won ? 'You won!' : `${game.opponent.name} won` }}</h2>
        <p class="over_how">{{ overText }}</p>
        <p class="muted">You scored {{ game.me.points }} points.</p>
        <button type="button" class="btn btn_primary" @click="emit('rematch', game.opponent.id)">Rematch</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <div class="game_foot">
      <button type="button" class="btn btn_ghost" @click="emit('back')">← Games</button>
      <button v-if="game.status === 'active'" type="button" class="btn btn_ghost btn_danger" @click="resign">Resign</button>
    </div>
  </div>
  <p v-else class="muted">Loading…</p>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api, type GameView, type Note, type Round, type Rules } from '../ts/api'
import { TIER_LABEL } from '../ts/music'
import { play, snap } from '../ts/synth'
import InstrumentPicker from './InstrumentPicker.vue'
import RiffComposer from './RiffComposer.vue'
import RiffGuesser from './RiffGuesser.vue'
import StaffEditor from './StaffEditor.vue'
import GuitarStrings from './GuitarStrings.vue'
import GuessHistory from './GuessHistory.vue'

const props = defineProps<{ gameId: string; rules: Rules; refresh: number }>()
const emit = defineEmits<{ back: []; rematch: [opponentId: string] }>()

const game = ref<GameView | null>(null)
const error = ref('')
const busy = ref(false)
const playing = ref(-1)
const instrument = ref(storedInstrument())

const current = computed(() => game.value!.rounds[game.value!.rounds.length - 1])
const lastDone = computed(() => [...(game.value?.rounds ?? [])].reverse().find((r) => r.phase === 'solved' || r.phase === 'failed'))
const won = computed(() => game.value?.winner === game.value?.me.id)

function storedInstrument() { try { return localStorage.getItem('riffs_instrument') || 'piano' } catch { return 'piano' } }

async function load() {
  try { game.value = await api.game(props.gameId); error.value = '' } catch (e) { error.value = (e as Error).message }
}
watch(() => [props.gameId, props.refresh], load, { immediate: true })

// A snap for every string that breaks: each new wrong guess, yours or your opponent's (when you're watching them
// guess your riff). Compares the game before and after each reload, so the last wrong guess of a round (after
// which the screen moves on to the next round) still sounds.
watch(game, (now, before) => {
  if (!now || !before || now.id !== before.id) return
  let breaks = 0
  for (const r of now.rounds) {
    const old = before.rounds.find((x) => x.number === r.number)
    if (old && r.guesses.length > old.guesses.length) breaks += r.guesses.slice(old.guesses.length).filter((g) => !g.correct).length
  }
  for (let i = 0; i < Math.min(breaks, 3); i++) snap(i * 0.35)
})

// Don't rely only on the events feed (it's in memory; a server restart loses it): while it's the other player's
// turn, ask for the game every few seconds, and again whenever the page comes back into view.
const waiting = computed(() => game.value?.turn === 'wait_compose' || game.value?.turn === 'wait_guess')
const recheck = window.setInterval(() => { if (waiting.value && !document.hidden) void load() }, 5000)
function onVisible() { if (!document.hidden) void load() }
onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => { clearInterval(recheck); document.removeEventListener('visibilitychange', onVisible) })

async function act(f: () => Promise<GameView>) {
  busy.value = true
  error.value = ''
  try { game.value = await f() } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
const sendRiff = (notes: Note[], tuneId?: string) => act(() => api.sendRiff(props.gameId, notes, tuneId))
const guess = (notes: number[]) => act(() => api.guess(props.gameId, notes))
function resign() { if (confirm('Resign this game?')) void act(() => api.resign(props.gameId)) }

/** How the game ended: who snapped their last string, or who resigned. */
const overText = computed(() => {
  const g = game.value
  if (!g) return ''
  if (g.resigned) return g.resigned === g.me.id ? 'You resigned.' : `${g.opponent.name} resigned.`
  const loser = g.winner === g.me.id ? g.opponent.name : 'You'
  return `${loser} snapped all ${props.rules.strings} strings 🎸💥`
})

function revealText(r: Round) {
  const me = game.value!.me.id
  const listenerName = r.listener === me ? 'You' : game.value!.opponent.name
  const n = r.guesses.length
  const snapped = r.wrong ? ` (${r.wrong} ${r.wrong === 1 ? 'string' : 'strings'} snapped)` : ''
  return r.phase === 'solved'
    ? `${listenerName} guessed the riff in ${n} ${n === 1 ? 'try' : 'tries'}${snapped}.`
    : `${listenerName} snapped the last string.`
}
function playMine() { if (current.value.riff) play(current.value.riff, instrument.value, 100, (i) => { playing.value = i }) }
</script>

<style scoped>
.game { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.scoreboard { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; background: var(--surface); border-radius: var(--radius); padding: 10px 12px; }
.side { display: grid; gap: 2px; }
.side_right { text-align: right; justify-items: end; }
.side :deep(.guitar_compact) { width: 100%; max-width: 150px; }
.side_name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side_pts { font-size: 0.8rem; color: var(--text-muted); }
.vs { font-size: 0.8rem; color: var(--text-muted); text-align: center; }
.level { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.level_easy { color: var(--good); } .level_medium { color: var(--accent); } .level_hard { color: var(--bad); }
.online { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--good); }
.sound_row { display: flex; justify-content: flex-end; margin: -4px 2px -6px; }
.reveal { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.85rem; padding: 10px 12px; }
/* the message takes what's left; on a very narrow screen the buttons wrap under it rather than squash it */
.reveal_text { flex: 1 1 150px; min-width: 0; }
.reveal_hear { flex: none; padding: 6px 10px; min-height: 36px; white-space: nowrap; }
.reveal :deep(.instrument) { margin-left: auto; }
.tier { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 99px; background: var(--surface-2); font-size: 0.75rem; font-weight: 700; color: var(--accent); }
.waiting, .over { text-align: center; padding: 16px 0; }
.waiting_icon, .over_icon { font-size: 2.6rem; }
.over_how { margin: 4px 0; font-weight: 700; }
.watching { display: grid; gap: 10px; }
.watching h2 { margin: 0; font-size: 1.15rem; }
.row { display: flex; gap: 10px; align-items: center; }
.muted { color: var(--text-muted); }
.error { color: var(--bad); }
.game_foot { display: flex; justify-content: space-between; }
</style>
