// The page's connection to the backend (web/js/api.js): POST with a text/plain JSON body, and
// the Spanish status message shown on the home page.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { callBackend, checkConnection } = require('../web/js/api.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

describe('calling the backend (web/js/api.js)', () => {
  it('sends a POST with a text/plain JSON body containing the action', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ ok: true }));
    await callBackend(URL, 'ping', {}, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping' }),
    });
  });

  it('returns the JSON answer', async () => {
    const fetchFn = async () => jsonResponse({ ok: true });
    await expect(callBackend(URL, 'ping', {}, fetchFn)).resolves.toEqual({ ok: true });
  });
});

describe('home page connection status', () => {
  it('says "Conectado con el servidor" when ping answers ok', async () => {
    const fetchFn = async () => jsonResponse({ ok: true });
    await expect(checkConnection(URL, fetchFn)).resolves.toBe('Conectado con el servidor');
  });

  it('says "No se puede conectar con el servidor" when the request fails', async () => {
    const fetchFn = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(checkConnection(URL, fetchFn)).resolves.toBe(
      'No se puede conectar con el servidor',
    );
  });

  it('says "No se puede conectar con el servidor" on an HTTP error', async () => {
    const fetchFn = async () => jsonResponse({}, false);
    await expect(checkConnection(URL, fetchFn)).resolves.toBe(
      'No se puede conectar con el servidor',
    );
  });

  it('says "No se puede conectar con el servidor" when the answer is not ok', async () => {
    const fetchFn = async () => jsonResponse({ ok: false, error: 'unknown_action' });
    await expect(checkConnection(URL, fetchFn)).resolves.toBe(
      'No se puede conectar con el servidor',
    );
  });

  it('says "No se puede conectar con el servidor" when the answer is not JSON', async () => {
    const fetchFn = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(checkConnection(URL, fetchFn)).resolves.toBe(
      'No se puede conectar con el servidor',
    );
  });
});
