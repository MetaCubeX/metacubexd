import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  base: process.env.PUBLIC_PATH || '/',
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  plugins: [devtools(), solidPlugin()],
})
