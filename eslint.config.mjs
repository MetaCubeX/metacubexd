import eslint from '@eslint/js'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist'],
    settings: {
      'import/resolver': {
        typescript: {},
        node: true,
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],

      'no-empty': 'off',

      'padding-line-between-statements': [
        'error',

        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'if',
        },
        {
          blankLine: 'always',
          prev: 'if',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'switch',
        },
        {
          blankLine: 'always',
          prev: 'switch',
          next: '*',
        },
      ],
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
)
