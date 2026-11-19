// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'coverage', 'public/mockServiceWorker.js'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Every eslint-disable must say why (AGENTS.md 3.2: suppressions need a written reason).
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unused-disable': 'error',
      // AGENTS.md 3.2: no hardcoded numbers. Clinical values come from the API.
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          enforceConst: true,
        },
      ],
      // AGENTS.md 3.3: no HTML injection and nothing sensitive in web storage.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML está prohibido (AGENTS.md 3.3).',
        },
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'innerHTML está prohibido: usa texto (AGENTS.md 3.3).',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Nada sensible en localStorage (AGENTS.md 3.3).' },
        { name: 'sessionStorage', message: 'Nada sensible en sessionStorage (AGENTS.md 3.3).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'AGENTS.md 3.3.' },
        { object: 'window', property: 'sessionStorage', message: 'AGENTS.md 3.3.' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Test files assert on literal expected values (percentages, counts, statuses); a named
    // constant for every expected number would hide what the test checks.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    // Fixtures are data, not logic: they stand in for what the API returns.
    files: ['src/mocks/fixtures/**'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    files: ['*.js', '*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
