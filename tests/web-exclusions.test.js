// Exclusions on the page: the texts of the "Puede regalar a" field and of the row line
// (web/js/exclusions.js), and what the participant edit sends and shows (web/js/groups.js).
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { exclusionsSummary, exclusionsLine, exclusionOptions } = require('../web/js/exclusions.js');
const { updateParticipant } = require('../web/js/groups.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';
const LIST_CHANGED = 'La lista de participantes ha cambiado, revisa las exclusiones';

const PARTICIPANTS = [
  { number: 1, name: 'Ana', email: 'ana@example.com', exclusions: [] },
  { number: 2, name: 'Luis', email: 'luis@example.com', exclusions: [] },
  { number: 3, name: 'Marta', email: 'marta@example.com', exclusions: [] },
  { number: 4, name: 'Ana', email: 'ana2@example.com', exclusions: [] },
];

describe('the closed "Puede regalar a" field (exclusionsSummary)', () => {
  it('says "Todos" when nobody is excluded', () => {
    expect(exclusionsSummary(PARTICIPANTS, [])).toBe('Todos');
  });

  it('says "Todos menos" and the names of the excluded, in number order', () => {
    expect(exclusionsSummary(PARTICIPANTS, [3, 1])).toBe('Todos menos Ana, Marta');
  });

  it('names everyone when everyone else is excluded', () => {
    expect(exclusionsSummary(PARTICIPANTS, [1, 3, 4])).toBe('Todos menos Ana, Marta, Ana');
  });

  it('ignores numbers that are not in the list', () => {
    expect(exclusionsSummary(PARTICIPANTS, [9])).toBe('Todos');
  });
});

describe("the row's second line (exclusionsLine)", () => {
  it('is empty when nobody is excluded', () => {
    expect(exclusionsLine(PARTICIPANTS, [])).toBe('');
  });

  it('says "No regalará a:" and the names of the excluded, in number order', () => {
    expect(exclusionsLine(PARTICIPANTS, [3, 1])).toBe('No regalará a: Ana, Marta');
  });
});

describe('editing a participant with exclusions (updateParticipant)', () => {
  const storage = { getItem: () => 'google-token' };
  const answering = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));
  const shown = PARTICIPANTS.map((p) => ({ number: p.number, email: p.email }));

  it('sends the exclusions and the participants the form showed', async () => {
    const fetchFn = answering({ ok: true, participants: PARTICIPANTS });
    await updateParticipant(
      URL,
      storage,
      'g-1',
      2,
      { name: 'Luis', email: 'luis@example.com', exclusions: [1, 3], participants: shown },
      fetchFn,
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      action: 'updateParticipant',
      idToken: 'google-token',
      groupId: 'g-1',
      number: 2,
      name: 'Luis',
      email: 'luis@example.com',
      exclusions: [1, 3],
      participants: shown,
    });
  });

  it('sends them for participant 1 too, still without an email', async () => {
    const fetchFn = answering({ ok: true, participants: PARTICIPANTS });
    await updateParticipant(
      URL,
      storage,
      'g-1',
      1,
      { name: 'Ana', exclusions: [2], participants: shown },
      fetchFn,
    );
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(sent.exclusions).toEqual([2]);
    expect(sent.participants).toEqual(shown);
    expect('email' in sent).toBe(false);
  });

  it('sends neither when the form gives none', async () => {
    const fetchFn = answering({ ok: true, participants: PARTICIPANTS });
    await updateParticipant(
      URL,
      storage,
      'g-1',
      2,
      { name: 'Luis', email: 'luis@example.com' },
      fetchFn,
    );
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect('exclusions' in sent).toBe(false);
    expect('participants' in sent).toBe(false);
  });

  it.each([['list_changed'], ['invalid_exclusions']])(
    'says the list changed when the server answers %s',
    async (error) => {
      const view = await updateParticipant(
        URL,
        storage,
        'g-1',
        2,
        { name: 'Luis', email: 'luis@example.com', exclusions: [1], participants: shown },
        answering({ ok: false, error }),
      );
      expect(view).toEqual({ kind: 'listChanged', message: LIST_CHANGED });
    },
  );
});

describe('the tick boxes of the "Puede regalar a" field (exclusionOptions)', () => {
  it('lists every other participant as "<number>. <name>", in number order, all ticked with no exclusions', () => {
    expect(exclusionOptions(PARTICIPANTS, 2, [])).toEqual([
      { number: 1, label: '1. Ana', ticked: true },
      { number: 3, label: '3. Marta', ticked: true },
      { number: 4, label: '4. Ana', ticked: true },
    ]);
  });

  it('unticks the excluded ones: ticked means "can give to"', () => {
    expect(exclusionOptions(PARTICIPANTS, 2, [3, 1]).map((o) => [o.number, o.ticked])).toEqual([
      [1, false],
      [3, false],
      [4, true],
    ]);
  });

  it('lists nobody when the participant is alone in the group', () => {
    expect(exclusionOptions([PARTICIPANTS[0]], 1, [])).toEqual([]);
  });
});
