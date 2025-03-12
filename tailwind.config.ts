import corvu from '@corvu/tailwind'
import { Config } from 'tailwindcss'

export default {
  content: ['src/**/*.{css,ts,tsx}'],
  plugins: [corvu],
} as Config
