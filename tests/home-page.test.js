import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WELCOME =
  'Organiza tu amigo invisible: haz el sorteo, envía los correos y comparte la carta a los Reyes Magos.';

describe('home page (web/index.html)', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

  it('is titled "Amigo invisible"', () => {
    expect(html).toMatch(/<title>\s*Amigo invisible\s*<\/title>/);
  });

  it('shows the Spanish welcome text', () => {
    expect(html).toContain(WELCOME);
  });

  it("loads Google's sign-in script", () => {
    expect(html).toContain('<script src="https://accounts.google.com/gsi/client" async');
  });

  it('has a place for the "Iniciar sesión con Google" button', () => {
    expect(html).toMatch(/id="signin-button"/);
  });

  it('starts with the organizer area hidden, so it never shows before the check', () => {
    expect(html).toMatch(/<section[^>]*id="organizer-area"[^>]*\shidden[\s>]/);
  });

  it('has a "Cerrar sesión" button inside the organizer area', () => {
    const area = html.match(/<section[^>]*id="organizer-area"[\s\S]*?<\/section>/);
    expect(area).not.toBeNull();
    expect(area[0]).toMatch(/<button[^>]*id="signout-button"[^>]*>\s*Cerrar sesión\s*<\/button>/);
  });
  describe('my groups (organizer area)', () => {
    const area = () => html.match(/<section[^>]*id="organizer-area"[\s\S]*?<\/section>/)[0];

    it('has a place for my groups list and for its message', () => {
      expect(area()).toMatch(/<ul[^>]*id="groups-list"/);
      expect(area()).toMatch(/<p[^>]*id="groups-message"/);
    });

    it('has a "Crear grupo" button', () => {
      expect(area()).toMatch(
        /<button[^>]*id="create-group-button"[^>]*>\s*Crear grupo\s*<\/button>/,
      );
    });

    it('has the create form, hidden until "Crear grupo" is clicked', () => {
      expect(area()).toMatch(/<form[^>]*id="create-group-form"[^>]*\shidden[\s>]/);
    });

    it.each([
      ['group-name', 'Nombre del grupo'],
      ['first-name', 'Tu nombre'],
    ])('has the field %s labelled "%s", starting empty', (id, label) => {
      const form = area().match(/<form[^>]*id="create-group-form"[\s\S]*?<\/form>/)[0];
      expect(form).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>\\s*${label}\\s*</label>`));
      const input = form.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
      expect(input).not.toBeNull();
      expect(input[0]).not.toMatch(/\svalue=/);
    });

    it('has "Guardar", "Cancelar" and a place for its message in the create form', () => {
      const form = area().match(/<form[^>]*id="create-group-form"[\s\S]*?<\/form>/)[0];
      expect(form).toMatch(/<button[^>]*type="submit"[^>]*>\s*Guardar\s*<\/button>/);
      expect(form).toMatch(/<button[^>]*id="create-group-cancel"[^>]*>\s*Cancelar\s*<\/button>/);
      expect(form).toMatch(/<p[^>]*id="create-group-message"[^>]*role="alert"/);
    });

    it('loads the groups script after the sign-in script and before the page script', () => {
      const order = ['js/auth.js', 'js/groups.js', 'js/home.js'].map((src) =>
        html.indexOf(`<script src="${src}"></script>`),
      );
      expect(order.every((position) => position > -1)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });
  });
});
