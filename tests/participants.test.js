// Participants on the server (apps-script/participants.js through the actions in api.js): the
// organizer adds, edits and removes the participants of their own group, until the draw locks it.
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { handleRequest } = require('../apps-script/api.js');

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const START = Date.UTC(2026, 10, 13, 12, 0, 0);

// Stand-in for the spreadsheet: the rows of the groups and participants tabs.
function memoryStore() {
  const data = { groups: [], participants: [] };
  const find = (groupId, number) =>
    data.participants.find((p) => p.groupId === groupId && p.number === number);
  return {
    data,
    readGroups: () => data.groups.map((g) => ({ draw: '', ...g })),
    readParticipants: () => data.participants.map((p) => ({ exclusions: '', ...p })),
    addGroup: (group) => data.groups.push({ ...group }),
    addParticipant: (participant) => data.participants.push({ exclusions: '', ...participant }),
    renameGroup: (id, name) => {
      data.groups.find((g) => g.id === id).name = name;
    },
    updateParticipant: (groupId, number, changes) => Object.assign(find(groupId, number), changes),
    deleteParticipant: (groupId, number) => {
      data.participants.splice(data.participants.indexOf(find(groupId, number)), 1);
    },
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

// Ana, signed in, with her group "Navidad 2026" (she is participant 1).
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
    add: (name, email) => call('addParticipant', { groupId, name, email }),
    update: (number, changes) => call('updateParticipant', { groupId, number, ...changes }),
    remove: (number) => call('removeParticipant', { groupId, number }),
    get: () => call('getGroup', { groupId }),
    rows: () =>
      store.data.participants
        .filter((p) => p.groupId === groupId)
        .sort((a, b) => a.number - b.number)
        .map((p) => ({ number: p.number, name: p.name, email: p.email, exclusions: p.exclusions })),
    lock: () => {
      store.data.groups.find((g) => g.id === groupId).draw = '1-2,2-1';
    },
  };
}

// Every answer gives each participant's exclusions as a list of numbers (#7).
const ANA = { number: 1, name: 'Ana', email: 'ana@example.com', exclusions: [] };
const LUIS = { number: 2, name: 'Luis', email: 'luis@example.com', exclusions: [] };

describe('adding a participant (addParticipant)', () => {
  it('adds "Luis" as number 2 and answers with the whole list', () => {
    const ana = anaWithGroup();
    expect(ana.add('Luis', 'luis@example.com')).toEqual({ ok: true, participants: [ANA, LUIS] });
    expect(ana.get().group.participants).toEqual([ANA, LUIS]);
  });

  it('gives each new participant the next number, at the end, in number order', () => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.add('Marta', 'marta@example.com');
    const answer = ana.add('Pepe', 'pepe@example.com');
    expect(answer.participants.map((p) => [p.number, p.name])).toEqual([
      [1, 'Ana'],
      [2, 'Luis'],
      [3, 'Marta'],
      [4, 'Pepe'],
    ]);
  });

  it.each([[''], ['   '], [undefined], [7]])(
    'refuses an empty name (%j) and saves nothing',
    (name) => {
      const ana = anaWithGroup();
      expect(ana.add(name, 'luis@example.com')).toEqual({ ok: false, error: 'name_required' });
      expect(ana.rows()).toHaveLength(1);
    },
  );

  it.each([
    ['luis@'],
    ['luis'],
    ['luis@example'],
    ['@example.com'],
    ['luis@.com'],
    ['lu is@example.com'],
    ['luis@@example.com'],
    [''],
    [undefined],
  ])('refuses the email %j and saves nothing', (email) => {
    const ana = anaWithGroup();
    expect(ana.add('Luis', email)).toEqual({ ok: false, error: 'email_invalid' });
    expect(ana.rows()).toHaveLength(1);
  });

  it.each([['luis@example.com'], ['l.uis+x@mail.example.es']])('accepts the email %j', (email) => {
    expect(anaWithGroup().add('Luis', email).ok).toBe(true);
  });

  it('refuses an email already in the group, in any capitals, and saves nothing', () => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    expect(ana.add('Otro', 'LUIS@Example.com')).toEqual({ ok: false, error: 'duplicate_email' });
    expect(ana.rows()).toHaveLength(2);
  });

  it("refuses the organizer's own email as a duplicate", () => {
    const ana = anaWithGroup();
    expect(ana.add('Otra Ana', 'Ana@example.com')).toEqual({
      ok: false,
      error: 'duplicate_email',
    });
  });

  it('answers only the first error, name before email', () => {
    expect(anaWithGroup().add('  ', 'luis@')).toEqual({ ok: false, error: 'name_required' });
  });

  it('saves the name and email without the spaces at the ends', () => {
    const ana = anaWithGroup();
    ana.add(' Luis ', ' luis@example.com ');
    expect(ana.rows()[1]).toEqual({
      number: 2,
      name: 'Luis',
      email: 'luis@example.com',
      exclusions: '',
    });
  });
});

describe('editing a participant (updateParticipant)', () => {
  it('saves the new name and email, shown after reloading', () => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    const answer = ana.update(2, { name: 'Luisito', email: 'luisito@example.com' });
    const luisito = { number: 2, name: 'Luisito', email: 'luisito@example.com', exclusions: [] };
    expect(answer).toEqual({ ok: true, participants: [ANA, luisito] });
    expect(ana.get().group.participants).toEqual([ANA, luisito]);
  });

  it.each([
    ['an empty name', { name: ' ', email: 'luis@example.com' }, 'name_required'],
    ['a bad email', { name: 'Luis', email: 'luis@' }, 'email_invalid'],
    [
      "another participant's email",
      { name: 'Luis', email: 'MARTA@example.com' },
      'duplicate_email',
    ],
    ["the organizer's email", { name: 'Luis', email: 'ana@example.com' }, 'duplicate_email'],
  ])('refuses %s and changes nothing', (_, changes, error) => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.add('Marta', 'marta@example.com');
    const before = ana.rows();
    expect(ana.update(2, changes)).toEqual({ ok: false, error });
    expect(ana.rows()).toEqual(before);
  });

  it.each([['luis@example.com'], ['Luis@Example.COM']])(
    'accepts keeping their own email (%j): it is not a duplicate',
    (email) => {
      const ana = anaWithGroup();
      ana.add('Luis', 'luis@example.com');
      expect(ana.update(2, { name: 'Luisito', email }).ok).toBe(true);
      expect(ana.rows()[1].name).toBe('Luisito');
    },
  );

  it('lets me change my own name (number 1), keeping my email', () => {
    const ana = anaWithGroup();
    expect(ana.update(1, { name: 'Anita' })).toEqual({
      ok: true,
      participants: [{ number: 1, name: 'Anita', email: 'ana@example.com', exclusions: [] }],
    });
  });

  it('refuses a change of my own email (number 1) and changes nothing', () => {
    const ana = anaWithGroup();
    expect(ana.update(1, { name: 'Anita', email: 'otra@example.com' })).toEqual({
      ok: false,
      error: 'cannot_change_organizer_email',
    });
    expect(ana.rows()[0]).toEqual({ ...ANA, exclusions: '' });
  });

  it.each([[9], [0], ['2'], [undefined]])(
    'answers participant_not_found for the number %j',
    (number) => {
      const ana = anaWithGroup();
      ana.add('Luis', 'luis@example.com');
      expect(ana.update(number, { name: 'X', email: 'x@example.com' })).toEqual({
        ok: false,
        error: 'participant_not_found',
      });
    },
  );
});

describe('removing a participant (removeParticipant)', () => {
  // Participants 1–4 with exclusions pointing at each other.
  function fourWithExclusions() {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.add('Marta', 'marta@example.com');
    ana.add('Pepe', 'pepe@example.com');
    const set = (number, exclusions) => {
      ana.store.data.participants.find(
        (p) => p.groupId === ana.groupId && p.number === number,
      ).exclusions = exclusions;
    };
    set(1, '2,3');
    set(2, '4');
    set(3, '4');
    set(4, '2');
    return ana;
  }

  it('renumbers the others in order and rewrites every exclusion of the group', () => {
    const ana = fourWithExclusions();
    const answer = ana.remove(2);
    expect(answer).toEqual({
      ok: true,
      participants: [
        { ...ANA, exclusions: [2] },
        { number: 2, name: 'Marta', email: 'marta@example.com', exclusions: [3] },
        { number: 3, name: 'Pepe', email: 'pepe@example.com', exclusions: [] },
      ],
    });
    // Luis (old 2) is dropped; Marta (old 3) is now 2 and Pepe (old 4) is now 3.
    expect(ana.rows()).toEqual([
      { ...ANA, exclusions: '2' },
      { number: 2, name: 'Marta', email: 'marta@example.com', exclusions: '3' },
      { number: 3, name: 'Pepe', email: 'pepe@example.com', exclusions: '' },
    ]);
  });

  it('removes the last participant: only the exclusions that pointed to them change', () => {
    const ana = fourWithExclusions();
    ana.remove(4);
    expect(ana.rows()).toEqual([
      { ...ANA, exclusions: '2,3' },
      { ...LUIS, exclusions: '' },
      { number: 3, name: 'Marta', email: 'marta@example.com', exclusions: '' },
    ]);
  });

  it('leaves the participants of my other groups as they were', () => {
    const ana = fourWithExclusions();
    const other = ana.call('createGroup', { name: 'Navidad 2027', firstName: 'Ana' }).group.id;
    ana.call('addParticipant', { groupId: other, name: 'Luis', email: 'luis@example.com' });
    ana.remove(2);
    expect(ana.call('getGroup', { groupId: other }).group.participants).toEqual([ANA, LUIS]);
  });

  it('refuses to remove participant 1, the organizer', () => {
    const ana = fourWithExclusions();
    expect(ana.remove(1)).toEqual({ ok: false, error: 'cannot_remove_organizer' });
    expect(ana.rows()).toHaveLength(4);
  });

  it.each([[9], ['2'], [undefined]])(
    'answers participant_not_found for the number %j',
    (number) => {
      const ana = fourWithExclusions();
      expect(ana.remove(number)).toEqual({ ok: false, error: 'participant_not_found' });
      expect(ana.rows()).toHaveLength(4);
    },
  );

  it('answers participant_not_found when the same number is removed twice in a row', () => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.remove(2);
    expect(ana.remove(2)).toEqual({ ok: false, error: 'participant_not_found' });
  });
});

describe('a locked group (the draw is done)', () => {
  it('says in the group answer whether it is locked', () => {
    const ana = anaWithGroup();
    expect(ana.get().group.locked).toBe(false);
    ana.lock();
    expect(ana.get().group.locked).toBe(true);
  });

  it.each([
    ['add', (ana) => ana.add('Marta', 'marta@example.com')],
    ['edit', (ana) => ana.update(2, { name: 'Luisito', email: 'luis@example.com' })],
    ['remove', (ana) => ana.remove(2)],
    ['add with bad values (the lock comes first)', (ana) => ana.add('', 'x@')],
  ])('refuses to %s and changes nothing', (_, action) => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.lock();
    const before = ana.rows();
    expect(action(ana)).toEqual({ ok: false, error: 'locked' });
    expect(ana.rows()).toEqual(before);
  });
});

describe('access: only the organizer of the group', () => {
  const ACTIONS = [
    ['addParticipant', { name: 'Eva', email: 'eva@example.com' }],
    ['updateParticipant', { number: 2, name: 'Eva', email: 'eva@example.com' }],
    ['removeParticipant', { number: 2 }],
  ];

  it.each(ACTIONS)(
    "%s in another organizer's group answers not_found and changes nothing",
    (action, data) => {
      const ana = anaWithGroup();
      ana.add('Luis', 'luis@example.com');
      const before = ana.rows();
      const luis = services('luis@example.com', ana.store);
      const answer = handleRequest(
        JSON.stringify({ action, idToken: 'token', groupId: ana.groupId, ...data }),
        luis,
      );
      expect(answer).toEqual({ ok: false, error: 'not_found' });
      expect(ana.rows()).toEqual(before);
    },
  );

  it.each(ACTIONS)('%s in a group that does not exist answers not_found', (action, data) => {
    const ana = anaWithGroup();
    expect(ana.call(action, { groupId: 'missing-id', ...data })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it.each(ACTIONS)('%s refuses a token Google rejects, touching nothing', (action, data) => {
    const store = memoryStore();
    const svc = services('ana@example.com', store, { status: 400 });
    const answer = handleRequest(
      JSON.stringify({ action, idToken: 'token', groupId: 'some-id', ...data }),
      svc,
    );
    expect(answer).toEqual({ ok: false, error: 'invalid_token' });
    expect(svc.store).not.toHaveBeenCalled();
  });

  it.each(ACTIONS)('%s saves while holding the lock', (action, data) => {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.svc.withLock.mockClear();
    ana.call(action, { groupId: ana.groupId, ...data });
    expect(ana.svc.withLock).toHaveBeenCalledTimes(1);
  });
});

describe("choosing a participant's exclusions (updateParticipant with exclusions)", () => {
  // Ana's group with Luis (2), Marta (3) and Pepe (4).
  function fourParticipants() {
    const ana = anaWithGroup();
    ana.add('Luis', 'luis@example.com');
    ana.add('Marta', 'marta@example.com');
    ana.add('Pepe', 'pepe@example.com');
    return ana;
  }

  // The participants the edit form showed: their numbers and emails.
  function shown(ana) {
    return ana.get().group.participants.map((p) => ({ number: p.number, email: p.email }));
  }

  function saveExclusions(ana, number, exclusions, extra = {}) {
    const member = ana.get().group.participants.find((p) => p.number === number);
    return ana.update(number, {
      name: member.name,
      email: member.number === 1 ? undefined : member.email,
      exclusions,
      participants: shown(ana),
      ...extra,
    });
  }

  const cell = (ana, number) => ana.rows().find((p) => p.number === number).exclusions;

  it('gives each participant their exclusions as a list of numbers when the group is opened', () => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [1, 3]);
    expect(ana.get().group.participants.map((p) => [p.number, p.exclusions])).toEqual([
      [1, []],
      [2, [1, 3]],
      [3, []],
      [4, []],
    ]);
  });

  it('saves them as "1,3" and answers with the whole list, exclusions included', () => {
    const ana = fourParticipants();
    const answer = saveExclusions(ana, 2, [1, 3]);
    expect(answer.ok).toBe(true);
    expect(answer.participants[1]).toEqual({ ...LUIS, exclusions: [1, 3] });
    expect(cell(ana, 2)).toBe('1,3');
  });

  it('accepts them in any order and stores them ascending', () => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [3, 1]);
    expect(cell(ana, 2)).toBe('1,3');
  });

  it('clears them with an empty list', () => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [1, 3]);
    saveExclusions(ana, 2, []);
    expect(cell(ana, 2)).toBe('');
  });

  it('leaves them unchanged when the edit carries no exclusions', () => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [1, 3]);
    expect(ana.update(2, { name: 'Luisito', email: 'luis@example.com' }).ok).toBe(true);
    expect(cell(ana, 2)).toBe('1,3');
  });

  it("saves them together with the participant's name and email", () => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [4], { name: 'Luisito', email: 'luisito@example.com' });
    expect(ana.rows()[1]).toEqual({
      number: 2,
      name: 'Luisito',
      email: 'luisito@example.com',
      exclusions: '4',
    });
  });

  it("leaves everyone else's exclusions as they were: they are one-way", () => {
    const ana = fourParticipants();
    saveExclusions(ana, 1, [3]);
    saveExclusions(ana, 2, [1, 4]);
    expect(cell(ana, 1)).toBe('3');
    expect(cell(ana, 3)).toBe('');
  });

  it('lets me (number 1) choose my own exclusions too', () => {
    const ana = fourParticipants();
    expect(saveExclusions(ana, 1, [2]).ok).toBe(true);
    expect(cell(ana, 1)).toBe('2');
  });

  it('still refuses a change of my own email (number 1), saving nothing', () => {
    const ana = fourParticipants();
    expect(saveExclusions(ana, 1, [2], { email: 'otra@example.com' })).toEqual({
      ok: false,
      error: 'cannot_change_organizer_email',
    });
    expect(cell(ana, 1)).toBe('');
  });

  it('allows excluding every other participant', () => {
    const ana = fourParticipants();
    expect(saveExclusions(ana, 2, [1, 3, 4]).ok).toBe(true);
    expect(cell(ana, 2)).toBe('1,3,4');
  });

  it('starts a new participant with no exclusions', () => {
    const ana = fourParticipants();
    const answer = ana.add('Eva', 'eva@example.com');
    expect(answer.participants[4]).toEqual({
      number: 5,
      name: 'Eva',
      email: 'eva@example.com',
      exclusions: [],
    });
  });

  it.each([
    ['a duplicate', [1, 1]],
    ["the participant's own number", [2]],
    ['a number that is not in the group', [9]],
    ['a number that is not whole', [1.5]],
    ['text instead of a number', ['1']],
    ['something that is not a list', '1,3'],
  ])('refuses %s with invalid_exclusions, saving nothing', (_, exclusions) => {
    const ana = fourParticipants();
    saveExclusions(ana, 2, [3]);
    const before = ana.rows();
    expect(saveExclusions(ana, 2, exclusions, { name: 'Luisito' })).toEqual({
      ok: false,
      error: 'invalid_exclusions',
    });
    expect(ana.rows()).toEqual(before);
  });

  describe('when the list changed under the open form', () => {
    it.each([
      ['someone was removed', (ana) => ana.remove(3)],
      [
        'someone was removed and someone else added',
        (ana) => {
          ana.remove(4);
          ana.add('Eva', 'eva@example.com');
        },
      ],
      ['an email changed', (ana) => ana.update(3, { name: 'Marta', email: 'm@example.com' })],
      ['someone was added', (ana) => ana.add('Eva', 'eva@example.com')],
    ])('refuses the save with list_changed when %s, saving nothing', (_, change) => {
      const ana = fourParticipants();
      const form = shown(ana);
      change(ana);
      const before = ana.rows();
      expect(
        ana.update(2, {
          name: 'Luisito',
          email: 'luis@example.com',
          exclusions: [1],
          participants: form,
        }),
      ).toEqual({ ok: false, error: 'list_changed' });
      expect(ana.rows()).toEqual(before);
    });

    it('accepts the same list, whatever the capitals of the emails', () => {
      const ana = fourParticipants();
      const form = shown(ana).map((p) => ({ ...p, email: p.email.toUpperCase() }));
      expect(
        ana.update(2, {
          name: 'Luis',
          email: 'luis@example.com',
          exclusions: [1],
          participants: form,
        }).ok,
      ).toBe(true);
    });

    it('checks the list before the name and email', () => {
      const ana = fourParticipants();
      const form = shown(ana);
      ana.remove(4);
      expect(ana.update(2, { name: '', email: 'x@', exclusions: [], participants: form })).toEqual({
        ok: false,
        error: 'list_changed',
      });
    });

    it('refuses a shown list that is not a list of numbers and emails', () => {
      const ana = fourParticipants();
      expect(ana.update(2, { name: 'Luis', email: 'luis@example.com', participants: 'x' })).toEqual(
        {
          ok: false,
          error: 'list_changed',
        },
      );
    });
  });

  it('refuses exclusions on a locked group with locked, before anything else', () => {
    const ana = fourParticipants();
    const form = shown(ana);
    ana.lock();
    expect(
      ana.update(2, {
        name: 'Luis',
        email: 'luis@example.com',
        exclusions: [1],
        participants: form,
      }),
    ).toEqual({
      ok: false,
      error: 'locked',
    });
    expect(cell(ana, 2)).toBe('');
  });

  it('gives the exclusions as lists after a removal renumbers them', () => {
    const ana = fourParticipants();
    saveExclusions(ana, 1, [2, 3]);
    saveExclusions(ana, 3, [4]);
    const answer = ana.remove(2);
    expect(answer.participants.map((p) => [p.number, p.exclusions])).toEqual([
      [1, [2]],
      [2, [3]],
      [3, []],
    ]);
  });
});
