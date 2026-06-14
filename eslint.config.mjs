// Root eslint config for the workspace. Delegates to the UI package config.
// When lint-staged runs from the workspace root, it picks this up; the UI
// package's own config is also used when running eslint from packages/ui/.
export { default } from './packages/ui/eslint.config.mjs'
