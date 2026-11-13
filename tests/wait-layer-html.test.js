// The blocking layer in the pages (web/index.html, web/group.html): present and blocking from the
// start, before any script runs, so no button is usable before the first check.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe.each([
  ['the home page', 'index.html', 'js/home.js'],
  ["a group's page", 'group.html', 'js/group-page.js'],
])('the blocking layer in %s', (_, file, pageScript) => {
  const html = readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8');
  const layer = () => html.match(/<div[^>]*id="wait-layer"[\s\S]*?<\/div>\s*<\/div>/);

  it('has the layer, outside the page content', () => {
    expect(layer()).not.toBeNull();
    const main = html.match(/<main[\s\S]*?<\/main>/)[0];
    expect(main).not.toContain('id="wait-layer"');
  });

  it('starts with the layer shown, so the page is blocked before any script runs', () => {
    expect(html).toMatch(/<div[^>]*id="wait-layer"/);
    expect(html.match(/<div[^>]*id="wait-layer"[^>]*>/)[0]).not.toMatch(/\shidden[\s>]/);
  });

  it('starts with the page content inert: nothing can be clicked or reached with the keyboard', () => {
    expect(html).toMatch(/<main[^>]*\sinert[\s>]/);
  });

  it('has the spinner inside the layer', () => {
    expect(layer()[0]).toMatch(/class="spinner"/);
  });

  it('has the text below the spinner in a status region, empty at first', () => {
    expect(layer()[0]).toMatch(/<p[^>]*id="wait-text"[^>]*role="status"[^>]*><\/p>/);
    expect(layer()[0].indexOf('class="spinner"')).toBeLessThan(
      layer()[0].indexOf('id="wait-text"'),
    );
  });

  it('loads the layer script before the page script', () => {
    const waiting = html.indexOf('<script src="js/waiting.js"></script>');
    expect(waiting).toBeGreaterThan(-1);
    expect(waiting).toBeLessThan(html.indexOf(`<script src="${pageScript}"></script>`));
  });
});
