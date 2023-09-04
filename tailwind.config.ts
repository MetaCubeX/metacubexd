import daisyui from 'daisyui'
import { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import safeArea from 'tailwindcss-safe-area'

export default {
  content: ['./src/**/*.{css,tsx}'],
  plugins: [daisyui, safeArea],
  daisyui: { themes: true },
} as Config
