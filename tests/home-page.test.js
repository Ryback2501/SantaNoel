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
});
