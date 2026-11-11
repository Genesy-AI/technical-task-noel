import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  { files: ['**/*.{ts,tsx}'], ...js.configs.recommended },
  ...tsPlugin.configs['flat/recommended'].map((config) => ({ files: ['**/*.{ts,tsx}'], ...config })),
  { files: ['**/*.{ts,tsx}'], ...reactHooks.configs['recommended-latest'] },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
