// The group's texts on the page: the default texts, filling the email's markers (web/js/texts.js),
// saving a text (web/js/groups.js) and its waiting text (web/js/waiting.js).
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  DEFAULT_EMAIL_TEXT,
  DEFAULT_LETTER_TEXT,
  fillMarkers,
  markerPieces,
} = require('../web/js/texts.js');
const { saveGroupText } = require('../web/js/groups.js');
const { WAIT_TEXTS } = require('../web/js/waiting.js');

const URL = 'https://script.google.com/macros/s/EXAMPLE/exec';
const VALUES = { name: 'Ana', group: 'Navidad 2026' };

describe('the default texts', () => {
  it('has the default email text', () => {
    expect(DEFAULT_EMAIL_TEXT).toBe(
      '¡Hola, {{name}}!\n\n' +
        'Ya se ha hecho el sorteo del amigo invisible «{{group}}».\n\n' +
        'En tu enlace personal puedes ver a quién te ha tocado, leer su carta a los Reyes Magos y escribir la tuya:',
    );
  });

  it('has the default letter text, with no markers', () => {
    expect(DEFAULT_LETTER_TEXT).toBe(
      'Queridos Reyes Magos:\n\nEste año me he portado muy bien, así que os pido:',
    );
  });
});

describe("filling the email text's markers (fillMarkers)", () => {
  it('fills {{name}} and {{group}}', () => {
    expect(fillMarkers('Hola {{name}}, bienvenido a {{group}}', VALUES)).toBe(
      'Hola Ana, bienvenido a Navidad 2026',
    );
  });

  it('ignores upper and lower case in the markers', () => {
    expect(fillMarkers('{{name}} {{Name}} {{NAME}} {{GrOuP}}', VALUES)).toBe(
      'Ana Ana Ana Navidad 2026',
    );
  });

  it('fills the same marker every time it appears', () => {
    expect(fillMarkers('{{name}}, {{name}}', VALUES)).toBe('Ana, Ana');
  });

  it.each([
    ['{{nmae}}'],
    ['{{ name }}'],
    ['{{organizer}}'],
    ['{{name'],
    ['name}}'],
    ['}}'],
    ['{name}'],
    ['{{na me}}'],
  ])('leaves %j exactly as written: it is not a marker', (text) => {
    expect(fillMarkers(text, VALUES)).toBe(text);
  });

  it('never fills a filled-in value again', () => {
    expect(fillMarkers('Hola {{name}}', { name: '{{group}}', group: 'X' })).toBe('Hola {{group}}');
  });

  it('inserts values exactly, never as a pattern', () => {
    expect(fillMarkers('Hola {{name}}', { name: "$& $1 $' $$", group: 'X' })).toBe(
      "Hola $& $1 $' $$",
    );
  });

  it('keeps line breaks and blank lines', () => {
    expect(fillMarkers('Hola {{name}}\n\nAdiós', VALUES)).toBe('Hola Ana\n\nAdiós');
  });
});

describe('the pieces of a filled text, so the preview can highlight the values (markerPieces)', () => {
  it('marks which pieces are filled-in values', () => {
    expect(markerPieces('Hola {{name}}, bienvenido a {{GROUP}}!', VALUES)).toEqual([
      { text: 'Hola ', value: false },
      { text: 'Ana', value: true },
      { text: ', bienvenido a ', value: false },
      { text: 'Navidad 2026', value: true },
      { text: '!', value: false },
    ]);
  });

  it('gives one plain piece for a text with no markers', () => {
    expect(markerPieces('Queridos {{nmae}}', VALUES)).toEqual([
      { text: 'Queridos {{nmae}}', value: false },
    ]);
  });

  it('gives no empty pieces', () => {
    expect(markerPieces('{{name}}{{group}}', VALUES)).toEqual([
      { text: 'Ana', value: true },
      { text: 'Navidad 2026', value: true },
    ]);
  });

  it('gives nothing for an empty text', () => {
    expect(markerPieces('', VALUES)).toEqual([]);
  });
});

describe('saving a text (saveGroupText)', () => {
  const storage = { getItem: () => 'google-token' };
  const answering = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));

  it('sends the group, the kind of text and the text as typed', async () => {
    const fetchFn = answering({ ok: true, text: 'Hola' });
    await saveGroupText(URL, storage, 'g-1', 'email', '  Hola \n', fetchFn);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      action: 'setGroupText',
      idToken: 'google-token',
      groupId: 'g-1',
      kind: 'email',
      text: '  Hola \n',
    });
  });

  it('answers with the text as the server stored it', async () => {
    const view = await saveGroupText(
      URL,
      storage,
      'g-1',
      'wishlist',
      ' Queridos ',
      answering({ ok: true, text: 'Queridos' }),
    );
    expect(view).toEqual({ kind: 'saved', text: 'Queridos' });
  });

  it.each([
    [
      'text_too_long',
      { kind: 'invalid', message: 'El texto es demasiado largo (máximo 5000 caracteres)' },
    ],
    ['locked', { kind: 'locked', message: 'El sorteo ya está hecho: la lista está bloqueada' }],
    ['not_found', { kind: 'notFound', message: 'No se encontró el grupo' }],
    [
      'session_expired',
      { kind: 'signin', message: 'Tu sesión ha caducado, inicia sesión de nuevo' },
    ],
    ['server_error', { kind: 'error', message: 'No se pudo guardar, inténtalo de nuevo' }],
  ])('turns %s into what to show', async (error, view) => {
    expect(
      await saveGroupText(URL, storage, 'g-1', 'email', 'Hola', answering({ ok: false, error })),
    ).toEqual(view);
  });

  it('shows the saving-failure message when the server cannot be reached', async () => {
    const fetchFn = vi.fn(async () => Promise.reject(new TypeError('offline')));
    expect(await saveGroupText(URL, storage, 'g-1', 'email', 'Hola', fetchFn)).toEqual({
      kind: 'error',
      message: 'No se pudo guardar, inténtalo de nuevo',
    });
  });

  it('sends me to sign in, with no server call, when I am not signed in', async () => {
    const fetchFn = answering({ ok: true, text: 'Hola' });
    const view = await saveGroupText(URL, { getItem: () => null }, 'g-1', 'email', 'Hola', fetchFn);
    expect(view).toEqual({ kind: 'signin', message: '' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('the waiting text while saving a text', () => {
  it('is "Guardando el texto…"', () => {
    expect(WAIT_TEXTS.savingText).toBe('Guardando el texto…');
  });
});
