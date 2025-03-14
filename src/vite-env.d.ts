interface ImportMetaEnv {
  readonly VITE_APP_GH_TOKEN?: string
  readonly APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
