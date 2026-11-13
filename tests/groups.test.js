// Groups on the server (apps-script/groups.js through the actions in api.js): an organizer lists,
// creates, opens and renames only the groups where they are participant 1. Every action first
// checks the Google sign-in (#4), then that the group is theirs.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { handleRequest } = require('../apps-script/api.js');

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const START = Date.UTC(2026, 10, 13, 12, 0, 0);

// Stand-in for the spreadsheet: the rows of the groups and participants tabs.
function memoryStore() {
  const data = { groups: [], participants: [] };
  return {
    data,
    readGroups: () => data.groups.map((g) => ({ ...g })),
    readParticipants: () => data.participants.map((p) => ({ ...p })),
    addGroup: (group) => data.groups.push({ ...group }),
    addParticipant: (participant) => data.participants.push({ ...participant }),
    renameGroup: (id, name) => {
      data.groups.find((g) => g.id === id).name = name;
    },
  };
}

// The outside world of the server, signed in as `email`. The store is shared between organizers.
function services(email, store, { status = 200, organizers } = {}) {
  let ids = 0;
  return {
    clientId: CLIENT_ID,
    fetchTokenInfo: vi.fn(() => ({
      status,
      body: {
        aud: CLIENT_ID,
        iss: 'https://accounts.google.com',
        exp: String(START / 1000 + 86400),
        email,
        email_verified: 'true',
        name: 'Someone',
      },
    })),
    tokenExpiry: vi.fn(() => null),
    organizerEmails: vi.fn(() => organizers || ['ana@example.com', 'luis@example.com']),
    // One minute later for each new group; reading the time has no side effect.
    now: () => START + ids * 60000,
    newId: () => (ids += 1) && `${email}-group-${ids}`,
    store: () => store,
    withLock: vi.fn((fn) => fn()),
  };
}

function call(svc, action, data = {}) {
  return handleRequest(JSON.stringify({ action, idToken: 'token', ...data }), svc);
}

function signedIn(email = 'ana@example.com', store = memoryStore(), options) {
  const svc = services(email, store, options);
  return {
    store,
    svc,
    list: () => call(svc, 'listGroups'),
    create: (name, firstName) => call(svc, 'createGroup', { name, firstName }),
    get: (groupId) => call(svc, 'getGroup', { groupId }),
    rename: (groupId, name) => call(svc, 'renameGroup', { groupId, name }),
  };
}

describe('my groups list (listGroups)', () => {
  it('is empty when I have no groups', () => {
    expect(signedIn().list()).toEqual({ ok: true, groups: [] });
  });

  it('shows each group by name, newest first', () => {
    const ana = signedIn();
    const first = ana.create('Navidad 2026', 'Ana').group;
    const second = ana.create('Navidad 2027', 'Ana').group;
    expect(ana.list()).toEqual({
      ok: true,
      groups: [
        { id: second.id, name: 'Navidad 2027' },
        { id: first.id, name: 'Navidad 2026' },
      ],
    });
  });

  it("does not show another organizer's groups", () => {
    const ana = signedIn();
    ana.create('Navidad 2026', 'Ana');
    const luis = signedIn('luis@example.com', ana.store);
    expect(luis.list()).toEqual({ ok: true, groups: [] });
  });

  it('recognizes me as participant 1 whatever the case of the email', () => {
    const ana = signedIn('Ana@Example.com');
    ana.create('Navidad 2026', 'Ana');
    expect(signedIn('ana@example.com', ana.store).list().groups).toHaveLength(1);
  });
});

describe('creating a group (createGroup)', () => {
  it('saves the group with a new ID and the creation date, and makes me participant 1', () => {
    const ana = signedIn();
    const answer = ana.create('Navidad 2026', 'Ana');
    expect(answer).toEqual({
      ok: true,
      group: { id: 'ana@example.com-group-1', name: 'Navidad 2026' },
    });
    expect(ana.store.data.groups).toEqual([
      { id: 'ana@example.com-group-1', name: 'Navidad 2026', created: new Date(START + 60000) },
    ]);
    expect(ana.store.data.participants).toEqual([
      { groupId: 'ana@example.com-group-1', number: 1, name: 'Ana', email: 'ana@example.com' },
    ]);
  });

  it('opens the new group with its name and participant 1 with my Google email', () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    expect(ana.get(id)).toEqual({
      ok: true,
      group: {
        id,
        name: 'Navidad 2026',
        locked: false,
        participants: [{ number: 1, name: 'Ana', email: 'ana@example.com' }],
      },
    });
  });

  it('takes my email from the sign-in, never from the request', () => {
    const ana = signedIn();
    call(ana.svc, 'createGroup', { name: 'Navidad 2026', firstName: 'Ana', email: 'x@evil.com' });
    expect(ana.store.data.participants[0].email).toBe('ana@example.com');
  });

  it.each([[''], ['   '], [undefined], [42]])(
    'refuses an empty group name (%j) and saves nothing',
    (name) => {
      const ana = signedIn();
      expect(ana.create(name, 'Ana')).toEqual({ ok: false, error: 'group_name_required' });
      expect(ana.store.data).toEqual({ groups: [], participants: [] });
    },
  );

  it.each([[''], ['   '], [undefined], [42]])(
    'refuses an empty first name (%j) and saves nothing',
    (firstName) => {
      const ana = signedIn();
      expect(ana.create('Navidad 2026', firstName)).toEqual({
        ok: false,
        error: 'first_name_required',
      });
      expect(ana.store.data).toEqual({ groups: [], participants: [] });
    },
  );

  it('removes the spaces at the ends of the group name and the first name', () => {
    const ana = signedIn();
    expect(ana.create('  Navidad 2026  ', '  Ana ').group.name).toBe('Navidad 2026');
    expect(ana.store.data.groups[0].name).toBe('Navidad 2026');
    expect(ana.store.data.participants[0].name).toBe('Ana');
  });

  it('refuses a name I already use, ignoring case and end spaces, and saves nothing', () => {
    const ana = signedIn();
    ana.create('Navidad 2026', 'Ana');
    expect(ana.create('  NAVIDAD 2026 ', 'Ana')).toEqual({ ok: false, error: 'duplicate_name' });
    expect(ana.store.data.groups).toHaveLength(1);
    expect(ana.store.data.participants).toHaveLength(1);
  });

  it('lets another organizer use the same name for their own group', () => {
    const ana = signedIn();
    ana.create('Navidad 2026', 'Ana');
    const luis = signedIn('luis@example.com', ana.store);
    expect(luis.create('Navidad 2026', 'Luis').ok).toBe(true);
  });

  it('keeps each group with its own participants', () => {
    const ana = signedIn();
    const first = ana.create('Navidad 2026', 'Ana').group;
    const second = ana.create('Navidad 2027', 'Anita').group;
    expect(ana.get(first.id).group.participants).toEqual([
      { number: 1, name: 'Ana', email: 'ana@example.com' },
    ]);
    expect(ana.get(second.id).group.participants).toEqual([
      { number: 1, name: 'Anita', email: 'ana@example.com' },
    ]);
  });

  it('saves while holding the lock, so two saves never mix', () => {
    const ana = signedIn();
    ana.create('Navidad 2026', 'Ana');
    expect(ana.svc.withLock).toHaveBeenCalledTimes(1);
  });
});

describe('opening a group (getGroup)', () => {
  it('shows it exactly as I left it after signing in again', () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    const again = signedIn('ana@example.com', ana.store);
    expect(again.get(id).group).toEqual({
      id,
      name: 'Navidad 2026',
      locked: false,
      participants: [{ number: 1, name: 'Ana', email: 'ana@example.com' }],
    });
  });

  it.each([
    ['a group that does not exist', 'missing-id'],
    ['no group ID', undefined],
    ['a number', 7],
  ])('answers not_found for %s', (_, groupId) => {
    expect(signedIn().get(groupId)).toEqual({ ok: false, error: 'not_found' });
  });

  it("answers not_found, the same as a missing group, for another organizer's group", () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    const luis = signedIn('luis@example.com', ana.store);
    expect(luis.get(id)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('renaming a group (renameGroup)', () => {
  it('saves the new name, shown by the list and the group page', () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    expect(ana.rename(id, '  Navidad en casa ')).toEqual({
      ok: true,
      group: { id, name: 'Navidad en casa' },
    });
    expect(ana.list().groups).toEqual([{ id, name: 'Navidad en casa' }]);
    expect(ana.get(id).group.name).toBe('Navidad en casa');
  });

  it('refuses an empty name and keeps the old one', () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    expect(ana.rename(id, '  ')).toEqual({ ok: false, error: 'group_name_required' });
    expect(ana.get(id).group.name).toBe('Navidad 2026');
  });

  it('refuses the name of another of my groups and keeps the old one', () => {
    const ana = signedIn();
    ana.create('Navidad 2026', 'Ana');
    const { id } = ana.create('Navidad 2027', 'Ana').group;
    expect(ana.rename(id, 'navidad 2026')).toEqual({ ok: false, error: 'duplicate_name' });
    expect(ana.get(id).group.name).toBe('Navidad 2027');
  });

  it('lets me change only the case of the group’s own name', () => {
    const ana = signedIn();
    const { id } = ana.create('navidad 2026', 'Ana').group;
    expect(ana.rename(id, 'Navidad 2026').ok).toBe(true);
  });

  it("refuses another organizer's group with not_found and changes nothing", () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    const luis = signedIn('luis@example.com', ana.store);
    expect(luis.rename(id, 'Mío')).toEqual({ ok: false, error: 'not_found' });
    expect(ana.get(id).group.name).toBe('Navidad 2026');
  });

  it('answers not_found for a group that does not exist', () => {
    expect(signedIn().rename('missing-id', 'Navidad')).toEqual({ ok: false, error: 'not_found' });
  });

  it('saves while holding the lock', () => {
    const ana = signedIn();
    const { id } = ana.create('Navidad 2026', 'Ana').group;
    ana.rename(id, 'Navidad en casa');
    expect(ana.svc.withLock).toHaveBeenCalledTimes(2);
  });
});

describe('every group action checks the sign-in first', () => {
  const ACTIONS = [
    ['listGroups', {}],
    ['createGroup', { name: 'Navidad 2026', firstName: 'Ana' }],
    ['getGroup', { groupId: 'some-id' }],
    ['renameGroup', { groupId: 'some-id', name: 'Navidad' }],
  ];

  it.each(ACTIONS)('%s refuses a token Google rejects, touching nothing', (action, data) => {
    const store = memoryStore();
    const svc = services('ana@example.com', store, { status: 400 });
    svc.store = vi.fn(() => store);
    expect(call(svc, action, data)).toEqual({ ok: false, error: 'invalid_token' });
    expect(svc.store).not.toHaveBeenCalled();
  });

  it.each(ACTIONS)('%s refuses an account not in organizers, touching nothing', (action, data) => {
    const store = memoryStore();
    const svc = services('eve@example.com', store);
    svc.store = vi.fn(() => store);
    expect(call(svc, action, data)).toEqual({ ok: false, error: 'not_authorized' });
    expect(svc.store).not.toHaveBeenCalled();
  });
});
