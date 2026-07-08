import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Flat config. Enforces the React/TS coding standards that tsc can't:
// the Rules of Hooks and no-`any`/type-import consistency. See
// docs/coding-standards/react-typescript.md.
export default tseslint.config(
  {
    ignores: [
      'dist',
      '.output',
      '.vinxi',
      '.tanstack',
      'node_modules',
      'playwright-report',
      'test-results',
      'src/routeTree.gen.ts', // generated
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Rules of React (§3)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Type safety (§1, §2)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
)
