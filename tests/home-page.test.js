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
});
