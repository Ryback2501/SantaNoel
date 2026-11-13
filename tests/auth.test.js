// Organizer sign-in on the server (apps-script/auth.js, the `whoami` action in api.js and the
// organizers list in sheets.js). The server checks the Google ID token on every request and lets
// in only the emails listed in the `organizers` tab.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { authorizeOrganizer, isOrganizer, readTokenExpiry } = require('../apps-script/auth.js');
const { handleRequest } = require('../apps-script/api.js');
const { readOrganizerEmails } = require('../apps-script/sheets.js');

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const IN_ONE_HOUR = String(NOW / 1000 + 3600);
const ONE_HOUR_AGO = NOW / 1000 - 3600;

// What Google's tokeninfo endpoint answers for a good token of ana@example.com.
function tokenInfo(overrides = {}) {
  return {
    aud: CLIENT_ID,
    iss: 'https://accounts.google.com',
    exp: IN_ONE_HOUR,
    email: 'ana@example.com',
    email_verified: 'true',
    name: 'Ana',
    ...overrides,
  };
}

function services({ status = 200, body = tokenInfo(), expiry = null, organizers } = {}) {
  return {
    clientId: CLIENT_ID,
    fetchTokenInfo: vi.fn(() => ({ status, body })),
    tokenExpiry: vi.fn(() => expiry),
    organizerEmails: vi.fn(() => organizers || ['ana@example.com']),
    now: () => NOW,
  };
}

function base64Url(text) {
  return Buffer.from(text).toString('base64url');
}

function fakeJwt(payload) {
  return [base64Url('{"alg":"RS256"}'), base64Url(JSON.stringify(payload)), 'signature'].join('.');
}

const decode = (part) => Buffer.from(part, 'base64').toString('utf8');

describe('organizer sign-in check (apps-script/auth.js)', () => {
  it('lets in a valid token of a listed organizer, with their name and email', () => {
    expect(authorizeOrganizer('token', services())).toEqual({
      ok: true,
      name: 'Ana',
      email: 'ana@example.com',
    });
  });

  it('gives an empty name when the Google account has none', () => {
    const body = tokenInfo();
    delete body.name;
    expect(authorizeOrganizer('token', services({ body }))).toEqual({
      ok: true,
      name: '',
      email: 'ana@example.com',
    });
  });

  it('answers not_authorized for a valid token whose email is not in organizers', () => {
    const s = services({ organizers: ['luis@example.com'] });
    expect(authorizeOrganizer('token', s)).toEqual({ ok: false, error: 'not_authorized' });
  });

  it('answers invalid_token for a made-up token Google rejects', () => {
    const s = services({ status: 400, body: { error: 'invalid_token' }, expiry: null });
    expect(authorizeOrganizer('made-up', s)).toEqual({ ok: false, error: 'invalid_token' });
    expect(s.organizerEmails).not.toHaveBeenCalled();
  });

  it('answers session_expired for a token Google rejects whose expiry has passed', () => {
    const s = services({ status: 400, body: { error: 'invalid_token' }, expiry: ONE_HOUR_AGO });
    expect(authorizeOrganizer('old', s)).toEqual({ ok: false, error: 'session_expired' });
    expect(s.organizerEmails).not.toHaveBeenCalled();
  });

  it('answers session_expired when Google accepts the token but its expiry has passed', () => {
    const s = services({ body: tokenInfo({ exp: String(ONE_HOUR_AGO) }) });
    expect(authorizeOrganizer('old', s)).toEqual({ ok: false, error: 'session_expired' });
  });

  it.each([
    ['for another app (aud)', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['not issued by Google (iss)', { iss: 'https://evil.example.com' }],
    ['with an unverified email', { email_verified: 'false' }],
  ])('answers invalid_token for a token %s', (_, overrides) => {
    const s = services({ body: tokenInfo(overrides) });
    expect(authorizeOrganizer('token', s)).toEqual({ ok: false, error: 'invalid_token' });
    expect(s.organizerEmails).not.toHaveBeenCalled();
  });

  it('accepts the issuer without https too (Google uses both forms)', () => {
    const s = services({ body: tokenInfo({ iss: 'accounts.google.com' }) });
    expect(authorizeOrganizer('token', s).ok).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not text', 42],
  ])('answers invalid_token without asking Google when the token is %s', (_, token) => {
    const s = services();
    expect(authorizeOrganizer(token, s)).toEqual({ ok: false, error: 'invalid_token' });
    expect(s.fetchTokenInfo).not.toHaveBeenCalled();
  });

  it("answers server_error when Google's check fails on its side", () => {
    const s = services({ status: 503, body: null });
    expect(authorizeOrganizer('token', s)).toEqual({ ok: false, error: 'server_error' });
  });
});

describe('organizers list', () => {
  it('matches the email ignoring case and spaces', () => {
    expect(isOrganizer('Ana@Example.com', [' ana@example.COM '])).toBe(true);
  });

  it('does not match a different email or an empty list', () => {
    expect(isOrganizer('ana@example.com', ['ana@example.org'])).toBe(false);
    expect(isOrganizer('ana@example.com', [])).toBe(false);
  });

  it('reads the Email column of the organizers tab, skipping the header and empty cells', () => {
    const rows = [['ana@example.com'], [''], ['luis@example.com']];
    const sheet = {
      getLastRow: () => rows.length + 1,
      getRange: (row, col, numRows, numCols) => {
        expect([row, col, numRows, numCols]).toEqual([2, 1, rows.length, 1]);
        return { getValues: () => rows };
      },
    };
    const spreadsheet = { getSheetByName: (name) => (name === 'organizers' ? sheet : null) };
    expect(readOrganizerEmails(spreadsheet)).toEqual(['ana@example.com', 'luis@example.com']);
  });

  it('reads no emails when the organizers tab has only its header', () => {
    const sheet = { getLastRow: () => 1 };
    expect(readOrganizerEmails({ getSheetByName: () => sheet })).toEqual([]);
  });
});

describe("reading a token's expiry (only to choose the error message)", () => {
  it('reads the exp claim of a JWT', () => {
    expect(readTokenExpiry(fakeJwt({ exp: 1700000000 }), decode)).toBe(1700000000);
  });

  it.each([
    ['not a JWT', 'made-up'],
    ['a payload that is not JSON', 'a.' + base64Url('nope') + '.c'],
    ['a payload without exp', fakeJwt({ sub: '1' })],
  ])('gives null for %s', (_, token) => {
    expect(readTokenExpiry(token, decode)).toBeNull();
  });
});

describe('the whoami action (apps-script/api.js)', () => {
  it('answers with the name and email of a signed-in organizer', () => {
    const answer = handleRequest('{"action":"whoami","idToken":"token"}', services());
    expect(answer).toEqual({ ok: true, name: 'Ana', email: 'ana@example.com' });
  });

  it('passes the token from the request to the check', () => {
    const s = services();
    handleRequest('{"action":"whoami","idToken":"the-token"}', s);
    expect(s.fetchTokenInfo).toHaveBeenCalledWith('the-token');
  });

  it('answers with the check error for a made-up token', () => {
    const s = services({ status: 400, body: { error: 'invalid_token' } });
    expect(handleRequest('{"action":"whoami","idToken":"x"}', s)).toEqual({
      ok: false,
      error: 'invalid_token',
    });
  });
});
