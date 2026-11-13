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

  it('has no fields other than the new group name and the participant forms', () => {
    // Participant 1's email is locked in the edit form by the page, and refused by the server.
    const fields = html.match(/<(input|textarea|select)\b[^>]*>/g) || [];
    expect(fields).toHaveLength(5);
    ['id="rename-name"', 'id="participant-name"', 'id="participant-email"'].forEach((id) => {
      expect(fields.some((field) => field.includes(id))).toBe(true);
    });
    ['class="edit-name"', 'class="edit-email"'].forEach((cls) => {
      expect(fields.some((field) => field.includes(cls))).toBe(true);
    });
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

describe("a group's participants (web/group.html)", () => {
  const html = readFileSync(new URL('../web/group.html', import.meta.url), 'utf8');
  const content = () => html.match(/<div[^>]*id="group-content"[\s\S]*?<\/main>/)[0];
  const addForm = () => html.match(/<form[^>]*id="add-participant-form"[\s\S]*?<\/form>/)[0];
  const rowTemplate = () =>
    html.match(/<template[^>]*id="participant-row-template"[\s\S]*?<\/template>/)[0];

  it('has a place for the lock message, above the list', () => {
    expect(content()).toMatch(/<p[^>]*id="lock-message"/);
    expect(content().indexOf('id="lock-message"')).toBeLessThan(
      content().indexOf('id="participants"'),
    );
  });

  it('has an "Añadir participante" button below the list', () => {
    expect(content()).toMatch(
      /<button[^>]*id="add-participant-button"[^>]*>\s*Añadir participante\s*<\/button>/,
    );
    expect(content().indexOf('id="participants"')).toBeLessThan(
      content().indexOf('id="add-participant-button"'),
    );
  });

  it('has the add form, hidden until "Añadir participante" is clicked', () => {
    expect(html).toMatch(/<form[^>]*id="add-participant-form"[^>]*\shidden[\s>]/);
  });

  it.each([
    ['participant-name', 'Nombre'],
    ['participant-email', 'Correo'],
  ])('has the add field %s labelled "%s"', (id, label) => {
    expect(addForm()).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>\\s*${label}\\s*</label>`));
    expect(addForm()).toMatch(new RegExp(`<input[^>]*id="${id}"`));
  });

  it('has "Guardar", "Cancelar" and a place for its message in the add form', () => {
    expect(addForm()).toMatch(/<button[^>]*type="submit"[^>]*>\s*Guardar\s*<\/button>/);
    expect(addForm()).toMatch(
      /<button[^>]*id="add-participant-cancel"[^>]*>\s*Cancelar\s*<\/button>/,
    );
    expect(addForm()).toMatch(/<p[^>]*id="add-participant-message"[^>]*role="alert"/);
  });

  it('has a row template with "Editar" and "Quitar" buttons', () => {
    expect(rowTemplate()).toMatch(
      /<button[^>]*class="[^"]*edit-button[^"]*"[^>]*>\s*Editar\s*<\/button>/,
    );
    expect(rowTemplate()).toMatch(
      /<button[^>]*class="[^"]*remove-button[^"]*"[^>]*>\s*Quitar\s*<\/button>/,
    );
  });

  it('has the edit form inside the row template, hidden, with Nombre and Correo', () => {
    const form = rowTemplate().match(/<form[^>]*class="[^"]*edit-form[^"]*"[\s\S]*?<\/form>/);
    expect(form).not.toBeNull();
    expect(form[0]).toMatch(/<form[^>]*\shidden[\s>]/);
    expect(form[0]).toMatch(/<label>\s*Nombre\s*<input[^>]*class="edit-name"/);
    expect(form[0]).toMatch(/<label>\s*Correo\s*<input[^>]*class="edit-email"/);
    expect(form[0]).toMatch(/<button[^>]*type="submit"[^>]*>\s*Guardar\s*<\/button>/);
    expect(form[0]).toMatch(
      /<button[^>]*class="[^"]*edit-cancel[^"]*"[^>]*>\s*Cancelar\s*<\/button>/,
    );
    expect(form[0]).toMatch(/<p[^>]*class="[^"]*edit-message[^"]*"[^>]*role="alert"/);
  });
});
