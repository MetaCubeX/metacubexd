import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,

  // Disable formatting (use Prettier instead)
  stylistic: false,
  formatters: false,
  yaml: false,
  jsonc: false,
  markdown: false,

  // Ignore patterns
  ignores: [
    'dist/**',
    'node_modules/**',
    'public/**',
    '.nuxt/**',
    '.output/**',
    '.nitro/**',
    'src/**',
    'scripts/**',
    'e2e/**',
    '**/*.md',
    '**/*.yaml',
    '**/*.yml',
  ],

  // Simplified rules
  rules: {
    // Relax console restrictions
    'no-console': 'off',

    // TypeScript
    'ts/no-use-before-define': 'off',
    'ts/no-explicit-any': 'off',

    // Unused imports - allow underscore prefix
    'unused-imports/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // Vue - relax rules
    'vue/no-mutating-props': 'off',
    'vue/one-component-per-file': 'off',
    'vue/no-template-shadow': 'off',
    'vue/no-unused-vars': 'off',
    'vue/custom-event-name-casing': 'off',
    'vue/html-self-closing': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/html-indent': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/first-attribute-linebreak': 'off',
    'vue/multiline-html-element-content-newline': 'off',

    // Node
    'node/prefer-global/process': 'off',

    // Other
    'no-alert': 'off',
    'regexp/no-super-linear-backtracking': 'off',
    'antfu/top-level-function': 'off',
    'antfu/if-newline': 'off',
  },
})
