import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'error',
    },
  },
  {
    // Frontend: runs in the browser.
    files: ['web/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    // Backend: Google Apps Script (V8). Every file shares one global scope, so functions are
    // used from other files; `module` exists only when the tests load the file in Node.
    files: ['apps-script/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        module: 'readonly',
        console: 'readonly',
        ContentService: 'readonly',
        LockService: 'readonly',
        PropertiesService: 'readonly',
        SpreadsheetApp: 'readonly',
        UrlFetchApp: 'readonly',
        Utilities: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'local' }],
    },
  },
  {
    // Tooling and tests: Node.
    files: ['scripts/**/*.mjs', 'tests/**/*.js', '*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
  prettier,
];
