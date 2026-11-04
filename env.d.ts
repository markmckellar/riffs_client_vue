/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The game's display name (.env); the server's riffs.game-name replaces it once loaded. */
  readonly VITE_GAME_NAME: string;
  /** The server's address when it isn't the one serving the page, e.g. http://localhost:9095/ */
  readonly VITE_RIFFS_SERVER?: string;
}
