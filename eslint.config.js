import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // note: this file configures the linter, so it is not itself linted with type information
  { ignores: ['**/node_modules/**', '**/.next/**',
      // note: unwired handoff scripts, see apps/web/tools/README.md
      'apps/web/tools/**',
      // note: vendored third-party component, kept as published so it can be re-synced
      'apps/web/src/ui/OptionWheel.tsx', '**/dist/**', '**/*.d.ts', 'eslint.config.js'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // note: vitest.config.ts sits outside every package tsconfig
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // why: an async function with no await is the normal way to satisfy an async port
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Tests assert against loosely-typed model replies and deliberately malformed input.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
)
