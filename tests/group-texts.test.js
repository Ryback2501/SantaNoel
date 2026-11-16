// The group's two texts on the server (apps-script/texts.js through the setGroupText action): the
// email text and the letter text are saved one at a time, cleaned, checked for length, and given
// back with the group. Nothing is validated about markers: they are filled in only when used.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { handleRequest } = require('../apps-script/api.js');

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const START = Date.UTC(2026, 10, 16, 12, 0, 0);

// Stand-in for the spreadsheet: the rows of the groups and participants tabs.
function memoryStore() {
  const data = { groups: [], participants: [] };
  return {
    data,
    readGroups: () => data.groups.map((g) => ({ draw: '', emailText: '', wishlistText: '', ...g })),
    readParticipants: () => data.participants.map((p) => ({ exclusions: '', ...p })),
    addGroup: (group) => data.groups.push({ ...group }),
    addParticipant: (participant) => data.participants.push({ ...participant }),
    renameGroup: (id, name) => {
      data.groups.find((g) => g.id === id).name = name;
    },
    setGroupText: vi.fn((id, kind, text) => {
      data.groups.find((g) => g.id === id)[kind === 'email' ? 'emailText' : 'wishlistText'] = text;
    }),
  };
}

function services(email, store, { status = 200 } = {}) {
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
    organizerEmails: vi.fn(() => ['ana@example.com', 'luis@example.com']),
    now: () => START + ids * 60000,
    newId: () => (ids += 1) && `${email}-group-${ids}`,
    store: vi.fn(() => store),
    withLock: vi.fn((fn) => fn()),
  };
}

// Ana, signed in, with her group "Navidad 2026".
function anaWithGroup(store = memoryStore()) {
  const svc = services('ana@example.com', store);
  const call = (action, data = {}) =>
    handleRequest(JSON.stringify({ action, idToken: 'token', ...data }), svc);
  const groupId = call('createGroup', { name: 'Navidad 2026', firstName: 'Ana' }).group.id;
  return {
    store,
    svc,
    groupId,
    call,
    save: (kind, text) => call('setGroupText', { groupId, kind, text }),
    get: () => call('getGroup', { groupId }).group,
    lock: () => {
      store.data.groups.find((g) => g.id === groupId).draw = '1-2,2-1';
    },
  };
}

describe("the group's texts in the group answer (getGroup)", () => {
  it('gives both texts empty for a new group (the page shows the defaults)', () => {
    const group = anaWithGroup().get();
    expect(group.emailText).toBe('');
    expect(group.wishlistText).toBe('');
  });

  it('gives the texts as saved', () => {
    const ana = anaWithGroup();
    ana.save('email', 'Hola {{name}}');
    ana.save('wishlist', 'Queridos Reyes');
    expect(ana.get()).toMatchObject({ emailText: 'Hola {{name}}', wishlistText: 'Queridos Reyes' });
  });
});

describe('saving a text (setGroupText)', () => {
  it('saves the email text and answers with it', () => {
    const ana = anaWithGroup();
    expect(ana.save('email', 'Hola {{name}}, bienvenido a {{group}}')).toEqual({
      ok: true,
      text: 'Hola {{name}}, bienvenido a {{group}}',
    });
    expect(ana.get().emailText).toBe('Hola {{name}}, bienvenido a {{group}}');
  });

  it('saves the letter text on its own, leaving the email text as it was', () => {
    const ana = anaWithGroup();
    ana.save('email', 'Hola');
    ana.save('wishlist', 'Queridos Reyes Magos:');
    expect(ana.get()).toMatchObject({ emailText: 'Hola', wishlistText: 'Queridos Reyes Magos:' });
  });

  it('saves anything that is not a marker exactly as written', () => {
    const ana = anaWithGroup();
    const text = 'Hola {{nmae}} {{ name }} {{organizer}} {{name y }} fin';
    expect(ana.save('email', text).text).toBe(text);
  });

  it('keeps line breaks, including blank lines, and stores Windows line breaks as \\n', () => {
    const ana = anaWithGroup();
    expect(ana.save('email', 'Uno\r\n\r\nDos').text).toBe('Uno\n\nDos');
  });

  it('removes spaces and blank lines at the beginning and the end', () => {
    const ana = anaWithGroup();
    expect(ana.save('email', '  \n\n Hola\nadiós  \n\n').text).toBe('Hola\nadiós');
  });

  it('saves a text of only spaces and line breaks as empty, so the default is used', () => {
    const ana = anaWithGroup();
    ana.save('email', 'Hola');
    expect(ana.save('email', '  \n \r\n ').text).toBe('');
    expect(ana.get().emailText).toBe('');
  });

  it('accepts exactly 5,000 characters', () => {
    expect(anaWithGroup().save('email', 'a'.repeat(5000)).ok).toBe(true);
  });

  it('refuses more than 5,000 characters with text_too_long, saving nothing', () => {
    const ana = anaWithGroup();
    ana.save('email', 'Hola');
    expect(ana.save('email', 'a'.repeat(5001))).toEqual({ ok: false, error: 'text_too_long' });
    expect(ana.get().emailText).toBe('Hola');
  });

  it('counts the length after trimming and after \\r\\n becomes \\n', () => {
    const ana = anaWithGroup();
    expect(ana.save('email', '   ' + 'a'.repeat(4999) + '\r\n' + '   ').ok).toBe(true);
    expect(ana.save('email', 'a'.repeat(2500) + '\r\n' + 'a'.repeat(2499)).ok).toBe(true);
  });

  it.each([
    ['an unknown kind of text', { kind: 'other', text: 'Hola' }],
    ['no kind', { text: 'Hola' }],
    ['a text that is not text', { kind: 'email', text: 42 }],
    ['no text', { kind: 'email' }],
  ])('refuses %s with invalid_request, saving nothing', (_, data) => {
    const ana = anaWithGroup();
    expect(ana.call('setGroupText', { groupId: ana.groupId, ...data })).toEqual({
      ok: false,
      error: 'invalid_request',
    });
    expect(ana.store.setGroupText).not.toHaveBeenCalled();
  });

  it('refuses a locked group with locked, before checking the text', () => {
    const ana = anaWithGroup();
    ana.lock();
    expect(ana.save('email', 'a'.repeat(6000))).toEqual({ ok: false, error: 'locked' });
    expect(ana.store.setGroupText).not.toHaveBeenCalled();
  });

  it("refuses another organizer's group with not_found, saving nothing", () => {
    const ana = anaWithGroup();
    const luis = services('luis@example.com', ana.store);
    const answer = handleRequest(
      JSON.stringify({
        action: 'setGroupText',
        idToken: 'token',
        groupId: ana.groupId,
        kind: 'email',
        text: 'Mío',
      }),
      luis,
    );
    expect(answer).toEqual({ ok: false, error: 'not_found' });
    expect(ana.store.setGroupText).not.toHaveBeenCalled();
  });

  it('refuses a group that does not exist with not_found', () => {
    const ana = anaWithGroup();
    expect(ana.call('setGroupText', { groupId: 'missing', kind: 'email', text: 'Hola' })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('refuses a token Google rejects, touching nothing', () => {
    const store = memoryStore();
    const svc = services('ana@example.com', store, { status: 400 });
    const answer = handleRequest(
      JSON.stringify({
        action: 'setGroupText',
        idToken: 'x',
        groupId: 'g',
        kind: 'email',
        text: 'a',
      }),
      svc,
    );
    expect(answer).toEqual({ ok: false, error: 'invalid_token' });
    expect(svc.store).not.toHaveBeenCalled();
  });

  it('saves while holding the lock', () => {
    const ana = anaWithGroup();
    ana.svc.withLock.mockClear();
    ana.save('email', 'Hola');
    expect(ana.svc.withLock).toHaveBeenCalledTimes(1);
  });

  it('lets the last save win', () => {
    const ana = anaWithGroup();
    ana.save('email', 'Primero');
    ana.save('email', 'Segundo');
    expect(ana.get().emailText).toBe('Segundo');
  });
});
