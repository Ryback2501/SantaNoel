// Groups on the page (web/js/groups.js): each server answer becomes what to show — the list, the
// group, a Spanish message, or "go and sign in".
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  loadMyGroups,
  createGroup,
  loadGroup,
  renameGroup,
  groupPageUrl,
  groupIdFrom,
} = require('../web/js/groups.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';
const TOKEN_KEY = 'santanoel.idToken';
const NO_GROUPS = 'Todavía no tienes grupos';
const GROUP_NAME_REQUIRED = 'El nombre del grupo es obligatorio';
const FIRST_NAME_REQUIRED = 'Tu nombre es obligatorio';
const DUPLICATE = 'Ya tienes un grupo con ese nombre';
const NOT_FOUND = 'No se encontró el grupo';
const SAVE_FAILED = 'No se pudo guardar, inténtalo de nuevo';
const LOAD_FAILED = 'No se pudieron cargar los datos, inténtalo de nuevo';
const EXPIRED = 'Tu sesión ha caducado, inicia sesión de nuevo';

function signedIn() {
  const items = { [TOKEN_KEY]: 'google-token' };
  return { items, getItem: (key) => (key in items ? items[key] : null) };
}

function signedOut() {
  return { getItem: () => null };
}

function answering(body) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

function sent(fetchFn) {
  return JSON.parse(fetchFn.mock.calls[0][1].body);
}

// The three ways a request can fail for a technical reason.
const TECHNICAL_FAILURES = [
  [
    'the server cannot be reached',
    () => vi.fn(async () => Promise.reject(new TypeError('offline'))),
  ],
  ['the server fails', () => answering({ ok: false, error: 'server_error' })],
  [
    'the server answers with an HTTP error',
    () => vi.fn(async () => ({ ok: false, json: async () => ({}) })),
  ],
];

describe('my groups list (loadMyGroups)', () => {
  it('asks the server with listGroups and my token', async () => {
    const fetchFn = answering({ ok: true, groups: [] });
    await loadMyGroups(URL, signedIn(), fetchFn);
    expect(sent(fetchFn)).toEqual({ action: 'listGroups', idToken: 'google-token' });
  });

  it('says "Todavía no tienes grupos" when I have none', async () => {
    const view = await loadMyGroups(URL, signedIn(), answering({ ok: true, groups: [] }));
    expect(view).toEqual({ kind: 'list', groups: [], message: NO_GROUPS });
  });

  it("lists each group's name, in the server's order, with a link to its page", async () => {
    const fetchFn = answering({
      ok: true,
      groups: [
        { id: 'id-2', name: 'Navidad 2027' },
        { id: 'id-1', name: 'Navidad 2026' },
      ],
    });
    expect(await loadMyGroups(URL, signedIn(), fetchFn)).toEqual({
      kind: 'list',
      groups: [
        { name: 'Navidad 2027', url: 'group.html?id=id-2' },
        { name: 'Navidad 2026', url: 'group.html?id=id-1' },
      ],
      message: '',
    });
  });

  it('sends me to sign in, with no server call, when I am not signed in', async () => {
    const fetchFn = answering({ ok: true, groups: [] });
    expect(await loadMyGroups(URL, signedOut(), fetchFn)).toEqual({ kind: 'signin', message: '' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends me to sign in, saying the session expired, when the server says so', async () => {
    const view = await loadMyGroups(
      URL,
      signedIn(),
      answering({ ok: false, error: 'session_expired' }),
    );
    expect(view).toEqual({ kind: 'signin', message: EXPIRED });
  });

  it.each(TECHNICAL_FAILURES)('shows the loading-failure message when %s', async (_, fetchFn) => {
    expect(await loadMyGroups(URL, signedIn(), fetchFn())).toEqual({
      kind: 'error',
      message: LOAD_FAILED,
    });
  });
});

describe('creating a group (createGroup)', () => {
  it('sends the group name and my first name, without the spaces at the ends', async () => {
    const fetchFn = answering({ ok: true, group: { id: 'id-1', name: 'Navidad 2026' } });
    await createGroup(URL, signedIn(), { name: '  Navidad 2026 ', firstName: ' Ana ' }, fetchFn);
    expect(sent(fetchFn)).toEqual({
      action: 'createGroup',
      idToken: 'google-token',
      name: 'Navidad 2026',
      firstName: 'Ana',
    });
  });

  it('answers with the new group when it is saved', async () => {
    const fetchFn = answering({ ok: true, group: { id: 'id-1', name: 'Navidad 2026' } });
    expect(
      await createGroup(URL, signedIn(), { name: 'Navidad 2026', firstName: 'Ana' }, fetchFn),
    ).toEqual({
      kind: 'saved',
      group: { id: 'id-1', name: 'Navidad 2026' },
    });
  });

  it.each([[''], ['   ']])(
    'says the group name is required (%j), with no server call',
    async (name) => {
      const fetchFn = answering({ ok: true });
      expect(await createGroup(URL, signedIn(), { name, firstName: 'Ana' }, fetchFn)).toEqual({
        kind: 'invalid',
        message: GROUP_NAME_REQUIRED,
      });
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it.each([[''], ['   ']])(
    'says my name is required (%j), with no server call',
    async (firstName) => {
      const fetchFn = answering({ ok: true });
      expect(
        await createGroup(URL, signedIn(), { name: 'Navidad 2026', firstName }, fetchFn),
      ).toEqual({
        kind: 'invalid',
        message: FIRST_NAME_REQUIRED,
      });
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['group_name_required', GROUP_NAME_REQUIRED],
    ['first_name_required', FIRST_NAME_REQUIRED],
    ['duplicate_name', DUPLICATE],
  ])('shows the server refusal %s as "%s"', async (error, message) => {
    const view = await createGroup(
      URL,
      signedIn(),
      { name: 'Navidad 2026', firstName: 'Ana' },
      answering({ ok: false, error }),
    );
    expect(view).toEqual({ kind: 'invalid', message });
  });

  it('sends me to sign in, saying the session expired, when the server says so', async () => {
    const view = await createGroup(
      URL,
      signedIn(),
      { name: 'Navidad 2026', firstName: 'Ana' },
      answering({ ok: false, error: 'session_expired' }),
    );
    expect(view).toEqual({ kind: 'signin', message: EXPIRED });
  });

  it.each(TECHNICAL_FAILURES)('shows the saving-failure message when %s', async (_, fetchFn) => {
    const view = await createGroup(
      URL,
      signedIn(),
      { name: 'Navidad 2026', firstName: 'Ana' },
      fetchFn(),
    );
    expect(view).toEqual({ kind: 'error', message: SAVE_FAILED });
  });
});

describe('opening a group (loadGroup)', () => {
  const GROUP = {
    id: 'id-1',
    name: 'Navidad 2026',
    participants: [{ number: 1, name: 'Ana', email: 'ana@example.com' }],
  };

  it('asks the server with getGroup, my token and the group ID', async () => {
    const fetchFn = answering({ ok: true, group: GROUP });
    await loadGroup(URL, signedIn(), 'id-1', fetchFn);
    expect(sent(fetchFn)).toEqual({ action: 'getGroup', idToken: 'google-token', groupId: 'id-1' });
  });

  it('shows the group with its name and participants', async () => {
    expect(await loadGroup(URL, signedIn(), 'id-1', answering({ ok: true, group: GROUP }))).toEqual(
      {
        kind: 'group',
        group: GROUP,
      },
    );
  });

  it('says "No se encontró el grupo" when the server does not find it (or it is not mine)', async () => {
    const view = await loadGroup(
      URL,
      signedIn(),
      'id-9',
      answering({ ok: false, error: 'not_found' }),
    );
    expect(view).toEqual({ kind: 'notFound', message: NOT_FOUND });
  });

  it('says "No se encontró el grupo", with no server call, when the address has no ID', async () => {
    const fetchFn = answering({ ok: true, group: GROUP });
    expect(await loadGroup(URL, signedIn(), '', fetchFn)).toEqual({
      kind: 'notFound',
      message: NOT_FOUND,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends me to sign in, with no server call, when I am not signed in', async () => {
    const fetchFn = answering({ ok: true, group: GROUP });
    expect(await loadGroup(URL, signedOut(), 'id-1', fetchFn)).toEqual({
      kind: 'signin',
      message: '',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends me to sign in, saying the session expired, when the server says so', async () => {
    const view = await loadGroup(
      URL,
      signedIn(),
      'id-1',
      answering({ ok: false, error: 'session_expired' }),
    );
    expect(view).toEqual({ kind: 'signin', message: EXPIRED });
  });

  it.each(TECHNICAL_FAILURES)('shows the loading-failure message when %s', async (_, fetchFn) => {
    expect(await loadGroup(URL, signedIn(), 'id-1', fetchFn())).toEqual({
      kind: 'error',
      message: LOAD_FAILED,
    });
  });
});

describe('renaming a group (renameGroup)', () => {
  it('sends the group ID and the new name without the spaces at the ends', async () => {
    const fetchFn = answering({ ok: true, group: { id: 'id-1', name: 'Navidad en casa' } });
    await renameGroup(URL, signedIn(), 'id-1', ' Navidad en casa  ', fetchFn);
    expect(sent(fetchFn)).toEqual({
      action: 'renameGroup',
      idToken: 'google-token',
      groupId: 'id-1',
      name: 'Navidad en casa',
    });
  });

  it('answers with the renamed group when it is saved', async () => {
    const fetchFn = answering({ ok: true, group: { id: 'id-1', name: 'Navidad en casa' } });
    expect(await renameGroup(URL, signedIn(), 'id-1', 'Navidad en casa', fetchFn)).toEqual({
      kind: 'saved',
      group: { id: 'id-1', name: 'Navidad en casa' },
    });
  });

  it('says the group name is required, with no server call', async () => {
    const fetchFn = answering({ ok: true });
    expect(await renameGroup(URL, signedIn(), 'id-1', '  ', fetchFn)).toEqual({
      kind: 'invalid',
      message: GROUP_NAME_REQUIRED,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('says "Ya tienes un grupo con ese nombre" when the server refuses a duplicate', async () => {
    const view = await renameGroup(
      URL,
      signedIn(),
      'id-1',
      'Navidad 2026',
      answering({ ok: false, error: 'duplicate_name' }),
    );
    expect(view).toEqual({ kind: 'invalid', message: DUPLICATE });
  });

  it('says "No se encontró el grupo" when the server does not find it', async () => {
    const view = await renameGroup(
      URL,
      signedIn(),
      'id-9',
      'Navidad',
      answering({ ok: false, error: 'not_found' }),
    );
    expect(view).toEqual({ kind: 'notFound', message: NOT_FOUND });
  });

  it('sends me to sign in, saying the session expired, when the server says so', async () => {
    const view = await renameGroup(
      URL,
      signedIn(),
      'id-1',
      'Navidad',
      answering({ ok: false, error: 'session_expired' }),
    );
    expect(view).toEqual({ kind: 'signin', message: EXPIRED });
  });

  it.each(TECHNICAL_FAILURES)('shows the saving-failure message when %s', async (_, fetchFn) => {
    expect(await renameGroup(URL, signedIn(), 'id-1', 'Navidad', fetchFn())).toEqual({
      kind: 'error',
      message: SAVE_FAILED,
    });
  });
});

describe("a group's page address", () => {
  it('is group.html with the group ID, encoded', () => {
    expect(groupPageUrl('a b&c')).toBe('group.html?id=a%20b%26c');
  });

  it('gives the group ID back from the address', () => {
    expect(groupIdFrom('?id=a%20b%26c')).toBe('a b&c');
  });

  it('gives an empty ID when the address has none', () => {
    expect(groupIdFrom('')).toBe('');
  });
});
