import daisyui from 'daisyui'
import { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{css,tsx}'],
  plugins: [daisyui],
  daisyui: { themes: true },
} as Config
