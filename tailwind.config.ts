import daisyui from 'daisyui'
import { Config } from 'tailwindcss'

export default {
  content: ['src/**/*.{css,ts,tsx}'],
  plugins: [daisyui],
  daisyui: { themes: true },
  theme: {
    fontFamily: {
      twemoji: ['Fira Sans', 'Twemoji Mozilla', 'system-ui', 'monospace'],
      'no-twemoji': ['Fira Sans', 'system-ui', 'monospace'],
    },
  },
} as Config
