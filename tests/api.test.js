// The backend's request handling (apps-script/api.js): every request is a JSON body with an
// `action`; the server never trusts what the client sends.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { handleRequest } = require('../apps-script/api.js');

describe('backend requests (apps-script/api.js)', () => {
  it('answers ping with ok', () => {
    expect(handleRequest('{"action":"ping"}')).toEqual({ ok: true });
  });

  it('rejects a body that is not JSON', () => {
    expect(handleRequest('not json')).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('rejects an empty body', () => {
    expect(handleRequest('')).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('rejects a request without an action', () => {
    expect(handleRequest('{"data":1}')).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('rejects a JSON value that is not an object', () => {
    expect(handleRequest('["ping"]')).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('rejects an unknown action', () => {
    expect(handleRequest('{"action":"dropTables"}')).toEqual({
      ok: false,
      error: 'unknown_action',
    });
  });
});
