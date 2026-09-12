/// <reference types="vite/client" />

interface ImportMetaEnv {
  // note: where the live world runs; defaults to the local harness
  readonly VITE_WORLD_ORIGIN?: string
}
