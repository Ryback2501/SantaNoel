// The page's connection to the backend (web/js/api.js): POST with a text/plain JSON body, and
// the Spanish status message shown on the home page.
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(URL);
    // The request also carries the signal that cancels it after the time limit, and nothing else.
    expect(Object.keys(options).sort()).toEqual(['body', 'headers', 'method', 'signal']);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    expect(options.body).toBe(JSON.stringify({ action: 'ping' }));
    expect(options.signal).toBeInstanceOf(AbortSignal);
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

describe('the 30-second limit on every request (web/js/api.js)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A server that never answers: the request only ends when it is cancelled.
  function silentServer() {
    return vi.fn(
      (url, options) =>
        new Promise((resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')));
          }
        }),
    );
  }

  it('gives up when the server has not answered after 30 seconds', async () => {
    vi.useFakeTimers();
    const outcome = callBackend(URL, 'listGroups', {}, silentServer()).then(
      () => 'answered',
      () => 'gave up',
    );
    await vi.advanceTimersByTimeAsync(30000);
    await expect(outcome).resolves.toBe('gave up');
  });

  it('keeps waiting before the 30 seconds are up', async () => {
    vi.useFakeTimers();
    let settled = false;
    callBackend(URL, 'listGroups', {}, silentServer()).then(
      () => (settled = true),
      () => (settled = true),
    );
    await vi.advanceTimersByTimeAsync(29999);
    expect(settled).toBe(false);
  });

  it('leaves no timer behind when the server answers in time', async () => {
    vi.useFakeTimers();
    await callBackend(URL, 'ping', {}, async () => jsonResponse({ ok: true }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('says "No se puede conectar con el servidor" when the connection check gets no answer in 30 seconds', async () => {
    vi.useFakeTimers();
    const status = checkConnection(URL, silentServer());
    await vi.advanceTimersByTimeAsync(30000);
    await expect(status).resolves.toBe('No se puede conectar con el servidor');
  });
});
