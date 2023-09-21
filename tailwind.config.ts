import daisyui from 'daisyui'
import { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import safeArea from 'tailwindcss-safe-area'

export default {
  content: ['src/**/*.{css,ts,tsx}'],
  plugins: [daisyui, safeArea],
  daisyui: { themes: true },
  theme: {
    fontFamily: {
      twemoji: ['Fira Sans', 'Twemoji Mozilla', 'system-ui', 'monospace'],
      'no-twemoji': ['Fira Sans', 'system-ui', 'monospace'],
    },
  },
} as Config
