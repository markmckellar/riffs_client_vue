/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The server's address when it isn't the one serving the page, e.g. http://localhost:9095/ */
  readonly VITE_RIFTS_SERVER?: string;
}
