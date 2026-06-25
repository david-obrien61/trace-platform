// TRACE Platform — ESLint flat config (standing build gate, baseline-and-ratchet)
// Installed 2026-06-24. Scope: catch the bug CLASSES we've actually hit —
//   dead code (no-unreachable), unused vars/imports (no-unused-vars),
//   swallowed async errors (no-floating-promises / no-misused-promises).
// Deliberately NOT a style linter: no Prettier/stylistic rules here.
// Baseline lives in quality-baseline.json; `npm run verify` fails on NET-NEW only.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // ---- ignores (build output, vendored, RN-only variants, empty pkgs) ----
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vercel/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.native.js',
      'packages/ignition-os/stubs/**',
      'packages/assessment-app/**',
      'packages/coolrunnings/**',
    ],
  },

  // ---- base: every JS/TS file ----
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      // MUST: dead code
      'no-unreachable': 'error',
      // MUST: unused vars (base — TS override below disables this for TS files)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ---- TypeScript (non-type-aware) everywhere TS ----
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // OUT OF SCOPE for this gate: `any` is type-hygiene, not a bug class we've
      // hit. Leaving it on would bury the real signal (floating promises, dead
      // code) under ~200 stylistic hits. Re-enable under a separate type-safety pass.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ---- TYPE-AWARE rules (the swallowed-async bug class) ----
  // Scoped to the active TS `src` dirs covered by a tsconfig include.
  // api/ and scripts/ TS get the non-type-aware rules above only.
  {
    files: [
      'packages/cultivar-os/src/**/*.{ts,tsx}',
      'packages/shared/src/**/*.{ts,tsx}',
      'packages/trace-app/src/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // ---- React hooks (real bug class: stale closures / conditional hooks) ----
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
