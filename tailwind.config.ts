import daisyui from 'daisyui'
import { Config } from 'tailwindcss'

export default {
  content: ['src/**/*.{css,ts,tsx}'],
  plugins: [daisyui],
  daisyui: { themes: true },
  theme: {
    fontFamily: {
      twemoji: ['system-ui', 'Twemoji Mozilla', 'Fira Sans', 'monospace'],
      'no-twemoji': ['system-ui', 'Fira Sans', 'monospace'],
    },
  },
} as Config
