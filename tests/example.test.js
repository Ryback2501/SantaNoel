// Shows the pattern for unit-testing Apps Script code: files in apps-script/ define plain
// functions and export them only when `module` exists, so Node (and Vitest) can load them.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('Apps Script code loaded in tests (apps-script/example.js)', () => {
  it('exposes its plain functions to the tests', () => {
    const { greet } = require('../apps-script/example.js');
    expect(greet('Ana')).toBe('Hola, Ana');
  });
});
