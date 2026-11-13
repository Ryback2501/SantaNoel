// Participants on the page (web/js/groups.js): each server answer to add, edit or remove becomes
// what to show — the new list, a Spanish message, the locked view, or "go and sign in".
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  addParticipant,
  updateParticipant,
  removeParticipant,
  loadGroup,
} = require('../web/js/groups.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';
const TOKEN_KEY = 'santanoel.idToken';
const NAME_REQUIRED = 'El nombre es obligatorio';
const EMAIL_INVALID = 'El correo no es válido';
const DUPLICATE_EMAIL = 'Ese correo ya está en el grupo';
const LOCKED = 'El sorteo ya está hecho: la lista está bloqueada';
const PARTICIPANT_NOT_FOUND = 'No se encontró al participante';
const GROUP_NOT_FOUND = 'No se encontró el grupo';
const SAVE_FAILED = 'No se pudo guardar, inténtalo de nuevo';
const EXPIRED = 'Tu sesión ha caducado, inicia sesión de nuevo';

const LIST = [
  { number: 1, name: 'Ana', email: 'ana@example.com' },
  { number: 2, name: 'Luis', email: 'luis@example.com' },
];

function signedIn() {
  return { getItem: (key) => (key === TOKEN_KEY ? 'google-token' : null) };
}

function answering(body) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

function sent(fetchFn) {
  return JSON.parse(fetchFn.mock.calls[0][1].body);
}

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

// The answers every save shares, whatever the action.
const SHARED_REFUSALS = [
  ['name_required', { kind: 'invalid', message: NAME_REQUIRED }],
  ['email_invalid', { kind: 'invalid', message: EMAIL_INVALID }],
  ['duplicate_email', { kind: 'invalid', message: DUPLICATE_EMAIL }],
  ['locked', { kind: 'locked', message: LOCKED }],
  ['participant_not_found', { kind: 'participantNotFound', message: PARTICIPANT_NOT_FOUND }],
  ['not_found', { kind: 'notFound', message: GROUP_NOT_FOUND }],
  ['session_expired', { kind: 'signin', message: EXPIRED }],
];

// Each action, called with good values against a given fetch.
const ACTIONS = [
  [
    'add',
    (fetchFn) =>
      addParticipant(URL, signedIn(), 'g-1', { name: 'Luis', email: 'luis@example.com' }, fetchFn),
  ],
  [
    'edit',
    (fetchFn) =>
      updateParticipant(
        URL,
        signedIn(),
        'g-1',
        2,
        { name: 'Luis', email: 'luis@example.com' },
        fetchFn,
      ),
  ],
  ['remove', (fetchFn) => removeParticipant(URL, signedIn(), 'g-1', 2, fetchFn)],
];

describe('adding a participant (addParticipant)', () => {
  it('sends the group, the name and the email without the spaces at the ends', async () => {
    const fetchFn = answering({ ok: true, participants: LIST });
    await addParticipant(
      URL,
      signedIn(),
      'g-1',
      { name: ' Luis ', email: ' luis@example.com ' },
      fetchFn,
    );
    expect(sent(fetchFn)).toEqual({
      action: 'addParticipant',
      idToken: 'google-token',
      groupId: 'g-1',
      name: 'Luis',
      email: 'luis@example.com',
    });
  });

  it('answers with the new list when it is saved', async () => {
    const view = await addParticipant(
      URL,
      signedIn(),
      'g-1',
      { name: 'Luis', email: 'luis@example.com' },
      answering({ ok: true, participants: LIST }),
    );
    expect(view).toEqual({ kind: 'saved', participants: LIST });
  });

  it.each([
    ['an empty name', { name: '  ', email: 'luis@example.com' }, NAME_REQUIRED],
    ['a bad email', { name: 'Luis', email: 'luis@' }, EMAIL_INVALID],
    ['both, showing the name first', { name: '', email: 'luis@' }, NAME_REQUIRED],
  ])('refuses %s with no server call', async (_, form, message) => {
    const fetchFn = answering({ ok: true, participants: LIST });
    expect(await addParticipant(URL, signedIn(), 'g-1', form, fetchFn)).toEqual({
      kind: 'invalid',
      message,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('editing a participant (updateParticipant)', () => {
  it('sends the group, the number, the name and the email', async () => {
    const fetchFn = answering({ ok: true, participants: LIST });
    await updateParticipant(
      URL,
      signedIn(),
      'g-1',
      2,
      { name: ' Luisito', email: 'l@example.com ' },
      fetchFn,
    );
    expect(sent(fetchFn)).toEqual({
      action: 'updateParticipant',
      idToken: 'google-token',
      groupId: 'g-1',
      number: 2,
      name: 'Luisito',
      email: 'l@example.com',
    });
  });

  it('sends only the name for participant 1, whose email cannot change', async () => {
    const fetchFn = answering({ ok: true, participants: LIST });
    await updateParticipant(URL, signedIn(), 'g-1', 1, { name: 'Anita' }, fetchFn);
    expect(sent(fetchFn)).toEqual({
      action: 'updateParticipant',
      idToken: 'google-token',
      groupId: 'g-1',
      number: 1,
      name: 'Anita',
    });
  });

  it('answers with the new list when it is saved', async () => {
    const view = await updateParticipant(
      URL,
      signedIn(),
      'g-1',
      2,
      { name: 'Luis', email: 'luis@example.com' },
      answering({ ok: true, participants: LIST }),
    );
    expect(view).toEqual({ kind: 'saved', participants: LIST });
  });

  it.each([
    ['an empty name', { name: '', email: 'luis@example.com' }, NAME_REQUIRED],
    ['a bad email', { name: 'Luis', email: 'luis example.com' }, EMAIL_INVALID],
  ])('refuses %s with no server call', async (_, form, message) => {
    const fetchFn = answering({ ok: true, participants: LIST });
    expect(await updateParticipant(URL, signedIn(), 'g-1', 2, form, fetchFn)).toEqual({
      kind: 'invalid',
      message,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a change to participant 1's email", async () => {
    const view = await updateParticipant(
      URL,
      signedIn(),
      'g-1',
      1,
      { name: 'Ana' },
      answering({ ok: false, error: 'cannot_change_organizer_email' }),
    );
    expect(view).toEqual({ kind: 'error', message: SAVE_FAILED });
  });
});

describe('removing a participant (removeParticipant)', () => {
  it('sends the group and the number', async () => {
    const fetchFn = answering({ ok: true, participants: LIST });
    await removeParticipant(URL, signedIn(), 'g-1', 3, fetchFn);
    expect(sent(fetchFn)).toEqual({
      action: 'removeParticipant',
      idToken: 'google-token',
      groupId: 'g-1',
      number: 3,
    });
  });

  it('answers with the new list when it is removed', async () => {
    const view = await removeParticipant(
      URL,
      signedIn(),
      'g-1',
      3,
      answering({ ok: true, participants: LIST }),
    );
    expect(view).toEqual({ kind: 'saved', participants: LIST });
  });
});

describe.each(ACTIONS)('every answer to %s', (_, act) => {
  it.each(SHARED_REFUSALS)('turns the refusal %s into what to show', async (error, view) => {
    expect(await act(answering({ ok: false, error }))).toEqual(view);
  });

  it.each(TECHNICAL_FAILURES)('shows the saving-failure message when %s', async (__, fetchFn) => {
    expect(await act(fetchFn())).toEqual({ kind: 'error', message: SAVE_FAILED });
  });
});

describe('opening a group (loadGroup)', () => {
  it('passes on whether the group is locked', async () => {
    const group = { id: 'g-1', name: 'Navidad 2026', locked: true, participants: LIST };
    expect(await loadGroup(URL, signedIn(), 'g-1', answering({ ok: true, group }))).toEqual({
      kind: 'group',
      group,
    });
  });
});
