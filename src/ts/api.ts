// Talking to riffs_server. Everything is JSON; the sign-in is an HttpOnly cookie.

export const SERVER: string = import.meta.env.VITE_RIFFS_SERVER ?? '/'

/** One note or rest: m = MIDI pitch (60 = middle C) or null for a rest, b = length in beats. */
export interface Note { m: number | null; b: number }

export interface Me { id: string; name: string; email?: string; wins: number; losses: number; points: number; learner: boolean }
export interface AuthConfig { game: string; googleClientId: string; devLogin: boolean; guestLogin: boolean; me: Me | null }

export interface Player {
  id: string; name: string; bot: boolean; level?: BotLevel; online: boolean; learner: boolean
  /** strings left on this player's guitar, for the whole game */
  strings: number; points: number; hints: number; extraStrings: number
}
/** beats: the lengths guessed; lengths: per note 'ok' / 'wrong' (older guesses have neither) */
export interface Guess { notes: number[]; beats?: number[]; marks: Mark[]; hints: (string | null)[]; lengths?: ('ok' | 'wrong')[]; correct: boolean; at: number }
export type Mark = 'exact' | 'octave' | 'close' | 'miss'
export interface Round {
  number: number; composer: string; listener: string; role: 'composer' | 'listener'
  phase: 'composing' | 'guessing' | 'solved' | 'failed'
  /** wrong guesses on this riff (each snapped one of the listener's strings) */
  length: number; wrong: number; revealed: (number | null)[]
  /** per note: the length the listener knows (beats), else null */
  revealedBeats: (number | null)[]
  guesses: Guess[]; hintsUsed: number; freeNotes: number; learner: boolean; fromLibrary: boolean
  riff?: Note[]; score?: number; tier?: string; tuneId?: string | null
}
export type Turn = 'compose' | 'wait_compose' | 'guess' | 'wait_guess' | 'over'
export interface GameView {
  id: string; status: 'active' | 'finished'; winner: string | null; resigned: string | null; updatedAt: number
  me: Player; opponent: Player; rounds: Round[]; turn: Turn; round?: number
}
export type BotLevel = 'easy' | 'medium' | 'hard'
export interface Lobbyist { id: string; name: string; bot: boolean; level?: BotLevel; about?: string; online: boolean; wins: number; losses: number }
export interface Reason { rule: string; points: number; text: string }
export interface Evaluation { score: number; tier: string; key: string; reasons: Reason[]; problem: string | null }
export interface Rules { minNotes: number; maxNotes: number; maxRests: number; lowest: number; highest: number; lengths: number[]; strings: number }
export interface Tune { id: string; title: string; source: string; year: number; meter: string; fragments: number }
export interface Fragment { tuneId: string; title: string; start: number; notes: Note[]; score: number; phraseEnd: boolean }
export interface GameEvent { seq: number; type: string; gameId: string; text: string; at: number }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(SERVER + path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = r.statusText
    try { const j = await r.json(); msg = j.message || j.error || msg } catch { /* not JSON */ }
    throw new ApiError(r.status, msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  config: () => call<AuthConfig>('GET', 'api/auth/config'),
  google: (credential: string) => call<Me>('POST', 'api/auth/google', { credential }),
  devLogin: (name: string) => call<Me>('POST', 'api/auth/dev', { name }),
  guestLogin: (name: string) => call<Me>('POST', 'api/auth/guest', { name }),
  logout: () => call<unknown>('POST', 'api/auth/logout'),
  setLearner: (learner: boolean) => call<Me>('POST', 'api/me/settings', { learner }),
  rules: () => call<Rules>('GET', 'api/riffs/rules'),
  players: () => call<Lobbyist[]>('GET', 'api/players'),
  games: () => call<GameView[]>('GET', 'api/games'),
  game: (id: string) => call<GameView>('GET', `api/games/${id}`),
  start: (opponentId?: string) => call<GameView>('POST', 'api/games', { opponentId: opponentId ?? null }),
  sendRiff: (id: string, notes: Note[], tuneId?: string) => call<GameView>('POST', `api/games/${id}/riff`, { notes, tuneId: tuneId ?? null }),
  guess: (id: string, notes: number[], beats: number[]) => call<GameView>('POST', `api/games/${id}/guess`, { notes, beats }),
  hint: (id: string) => call<GameView>('POST', `api/games/${id}/hint`),
  extraString: (id: string) => call<GameView>('POST', `api/games/${id}/extra-string`),
  resign: (id: string) => call<GameView>('POST', `api/games/${id}/resign`),
  evaluate: (notes: Note[]) => call<Evaluation>('POST', 'api/riffs/evaluate', { notes }),
  library: () => call<Tune[]>('GET', 'api/library'),
  fragments: (tuneId: string) => call<Fragment[]>('GET', `api/library/${tuneId}/fragments`),
  events: (after: number) => call<{ seq: number; events: GameEvent[] }>('GET', `api/events?after=${after}`),
}
