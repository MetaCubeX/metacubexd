interface ImportMetaEnv {
  readonly VITE_APP_GH_TOKEN?: string
  readonly VITE_MOCK_MODE?: string
  readonly APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface MetaCubeXDConfig {
  defaultBackendURL?: string
}

interface Window {
  __METACUBEXD_CONFIG__?: MetaCubeXDConfig
}
