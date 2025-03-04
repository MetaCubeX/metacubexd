import corvu from '@corvu/tailwind'
import { Config } from 'tailwindcss'

export default {
  content: ['src/**/*.{css,ts,tsx}'],
  plugins: [corvu],
  theme: {
    extend: {
      fontFamily: {
        twemoji: ['system-ui', 'Twemoji Mozilla', 'Fira Sans', 'monospace'],
        'no-twemoji': ['system-ui', 'Fira Sans', 'monospace'],
      },
    },
  },
} as Config
