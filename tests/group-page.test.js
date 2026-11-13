// A group's page (web/group.html): its name with "Cambiar nombre", participant 1 shown but not
// editable, and the way back to my groups. Nothing of the group shows before the server answers.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

describe("a group's page (web/group.html)", () => {
  const html = readFileSync(new URL('../web/group.html', import.meta.url), 'utf8');
  const renameForm = () => html.match(/<form[^>]*id="rename-form"[\s\S]*?<\/form>/)[0];

  it('is a Spanish page titled "Amigo invisible"', () => {
    expect(html).toMatch(/<html lang="es">/);
    expect(html).toMatch(/<title>\s*Amigo invisible\s*<\/title>/);
  });

  it('has a "Volver a mis grupos" link to the home page', () => {
    expect(html).toMatch(/<a[^>]*href="index\.html"[^>]*>\s*Volver a mis grupos\s*<\/a>/);
  });

  it('has a place for its messages ("No se encontró el grupo", loading failures)', () => {
    expect(html).toMatch(/<p[^>]*id="page-message"[^>]*role="alert"/);
  });

  it("starts with the group's content hidden, so nothing of it shows before the check", () => {
    expect(html).toMatch(/<div[^>]*id="group-content"[^>]*\shidden[\s>]/);
  });

  it("has a place for the group's name and its participants", () => {
    const content = html.match(/<div[^>]*id="group-content"[\s\S]*$/)[0];
    expect(content).toMatch(/id="group-title"/);
    expect(content).toMatch(/<ul[^>]*id="participants"/);
  });

  it('has a "Cambiar nombre" button', () => {
    expect(html).toMatch(/<button[^>]*id="rename-button"[^>]*>\s*Cambiar nombre\s*<\/button>/);
  });

  it('has the rename form, hidden until "Cambiar nombre" is clicked', () => {
    expect(html).toMatch(/<form[^>]*id="rename-form"[^>]*\shidden[\s>]/);
    expect(renameForm()).toMatch(
      /<label[^>]*for="rename-name"[^>]*>\s*Nombre del grupo\s*<\/label>/,
    );
    expect(renameForm()).toMatch(/<input[^>]*id="rename-name"/);
    expect(renameForm()).toMatch(/<button[^>]*type="submit"[^>]*>\s*Guardar\s*<\/button>/);
    expect(renameForm()).toMatch(/<button[^>]*id="rename-cancel"[^>]*>\s*Cancelar\s*<\/button>/);
    expect(renameForm()).toMatch(/<p[^>]*id="rename-message"[^>]*role="alert"/);
  });

  it("has no field other than the group's new name, so participant 1 cannot be edited", () => {
    const fields = html.match(/<(input|textarea|select)\b[^>]*>/g) || [];
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatch(/id="rename-name"/);
  });

  it('loads its scripts in order: config, backend calls, sign-in, groups, then the page', () => {
    const order = ['config.js', 'js/api.js', 'js/auth.js', 'js/groups.js', 'js/group-page.js'].map(
      (src) => html.indexOf(`<script src="${src}"></script>`),
    );
    expect(order.every((position) => position > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('is published by the build', () => {
    // Its own output folder, so it never races the other build test over dist/.
    const out = mkdtempSync(join(tmpdir(), 'santanoel-build-'));
    try {
      execFileSync('node', ['scripts/build.mjs', join(out, 'site')], { cwd: root, stdio: 'pipe' });
      ['group.html', 'js/group-page.js', 'js/groups.js'].forEach((file) => {
        expect(existsSync(join(out, 'site', file))).toBe(true);
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
