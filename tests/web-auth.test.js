// Organizer sign-in on the page (web/js/auth.js): the token is kept only for this browser tab,
// the server checks it with `whoami`, and the answer becomes the greeting or a Spanish message.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { startSession, resumeSession, endSession, greetingFor } = require('../web/js/auth.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';
const NOT_AUTHORIZED = 'Esta cuenta no está autorizada para organizar';
const EXPIRED = 'Tu sesión ha caducado, inicia sesión de nuevo';
const FAILED = 'No se pudo iniciar sesión, inténtalo de nuevo';

// Stand-in for sessionStorage.
function memoryStorage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: (key) => (key in items ? items[key] : null),
    setItem: (key, value) => {
      items[key] = String(value);
    },
    removeItem: (key) => {
      delete items[key];
    },
  };
}

function answering(body) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

describe('greeting', () => {
  it('says "Hola, <name>"', () => {
    expect(greetingFor('Ana')).toBe('Hola, Ana');
  });

  it('says just "Hola" when the account has no name', () => {
    expect(greetingFor('')).toBe('Hola');
    expect(greetingFor(undefined)).toBe('Hola');
  });
});

describe('signing in (startSession)', () => {
  it('asks the server with whoami and the token from Google', async () => {
    const fetchFn = answering({ ok: true, name: 'Ana', email: 'ana@example.com' });
    await startSession(URL, 'google-token', memoryStorage(), fetchFn);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      action: 'whoami',
      idToken: 'google-token',
    });
  });

  it('shows "Hola, <name>" for a listed organizer and keeps the token for reloads', async () => {
    const storage = memoryStorage();
    const fetchFn = answering({ ok: true, name: 'Ana', email: 'ana@example.com' });
    const view = await startSession(URL, 'google-token', storage, fetchFn);
    expect(view).toEqual({ signedIn: true, greeting: 'Hola, Ana' });
    expect(Object.values(storage.items)).toEqual(['google-token']);
  });

  it('shows just "Hola" when the account has no name', async () => {
    const fetchFn = answering({ ok: true, name: '', email: 'ana@example.com' });
    const view = await startSession(URL, 'google-token', memoryStorage(), fetchFn);
    expect(view).toEqual({ signedIn: true, greeting: 'Hola' });
  });

  it('says the account is not allowed, and keeps no token, for an account not listed', async () => {
    const storage = memoryStorage();
    const fetchFn = answering({ ok: false, error: 'not_authorized' });
    const view = await startSession(URL, 'google-token', storage, fetchFn);
    expect(view).toEqual({ signedIn: false, message: NOT_AUTHORIZED });
    expect(storage.items).toEqual({});
  });

  it.each([
    ['the server cannot be reached', vi.fn(async () => Promise.reject(new TypeError('offline')))],
    ['the server fails', answering({ ok: false, error: 'server_error' })],
    ['the server rejects the token', answering({ ok: false, error: 'invalid_token' })],
    [
      'the server answers with an HTTP error',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    ],
  ])('shows the technical-failure message, and keeps no token, when %s', async (_, fetchFn) => {
    const storage = memoryStorage();
    const view = await startSession(URL, 'google-token', storage, fetchFn);
    expect(view).toEqual({ signedIn: false, message: FAILED });
    expect(storage.items).toEqual({});
  });
});

describe('reloading the page (resumeSession)', () => {
  async function signIn() {
    const storage = memoryStorage();
    await startSession(URL, 'google-token', storage, answering({ ok: true, name: 'Ana' }));
    return storage;
  }

  it('shows the sign-in button, with no message and no server call, when nobody signed in', async () => {
    const fetchFn = answering({ ok: true });
    const view = await resumeSession(URL, memoryStorage(), fetchFn);
    expect(view).toEqual({ signedIn: false, message: '' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stays signed in when the stored token is still valid', async () => {
    const storage = await signIn();
    const fetchFn = answering({ ok: true, name: 'Ana', email: 'ana@example.com' });
    const view = await resumeSession(URL, storage, fetchFn);
    expect(view).toEqual({ signedIn: true, greeting: 'Hola, Ana' });
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).idToken).toBe('google-token');
  });

  it('says the session expired, and forgets the token, when the server says so', async () => {
    const storage = await signIn();
    const view = await resumeSession(
      URL,
      storage,
      answering({ ok: false, error: 'session_expired' }),
    );
    expect(view).toEqual({ signedIn: false, message: EXPIRED });
    expect(storage.items).toEqual({});
  });

  it('does not let in an account that was not allowed', async () => {
    const storage = memoryStorage();
    await startSession(
      URL,
      'google-token',
      storage,
      answering({ ok: false, error: 'not_authorized' }),
    );
    const fetchFn = answering({ ok: true, name: 'Ana' });
    const view = await resumeSession(URL, storage, fetchFn);
    expect(view).toEqual({ signedIn: false, message: '' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('signing out (endSession)', () => {
  it('forgets the token, so a reload shows the sign-in button', async () => {
    const storage = memoryStorage();
    await startSession(URL, 'google-token', storage, answering({ ok: true, name: 'Ana' }));
    endSession(storage);
    expect(storage.items).toEqual({});
    const fetchFn = answering({ ok: true, name: 'Ana' });
    expect(await resumeSession(URL, storage, fetchFn)).toEqual({ signedIn: false, message: '' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
