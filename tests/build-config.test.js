// The build writes the production backend address into the published config when
// BACKEND_URL is set, and keeps the development config otherwise.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const PROD_URL = 'https://script.google.com/macros/s/PRODUCTION-DEPLOYMENT/exec';
const devConfig = readFileSync(join(root, 'web/config.js'), 'utf8');

let outDir;
afterEach(() => rmSync(outDir, { recursive: true, force: true }));

function build(backendUrl) {
  outDir = mkdtempSync(join(tmpdir(), 'santanoel-build-'));
  const env = { ...process.env };
  delete env.BACKEND_URL;
  if (backendUrl !== undefined) env.BACKEND_URL = backendUrl;
  return spawnSync(process.execPath, ['scripts/build.mjs', outDir], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

describe('build with a production backend address (BACKEND_URL)', () => {
  it('writes BACKEND_URL into the published config.js', () => {
    const result = build(PROD_URL);
    expect(result.status).toBe(0);
    const config = readFileSync(join(outDir, 'config.js'), 'utf8');
    expect(config).toContain(`backendUrl: '${PROD_URL}'`);
    expect(config).toContain('const SANTANOEL_CONFIG');
  });

  it('no longer points to the development backend', () => {
    build(PROD_URL);
    const devUrl = devConfig.match(/backendUrl:\s*'([^']+)'/)[1];
    expect(readFileSync(join(outDir, 'config.js'), 'utf8')).not.toContain(devUrl);
  });

  it('leaves every other file as in web/', () => {
    build(PROD_URL);
    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toBe(
      readFileSync(join(root, 'web/index.html'), 'utf8'),
    );
  });

  it('keeps the development config.js when BACKEND_URL is not set', () => {
    const result = build();
    expect(result.status).toBe(0);
    expect(readFileSync(join(outDir, 'config.js'), 'utf8')).toBe(devConfig);
  });

  it('treats an empty BACKEND_URL (an unset repo variable in the workflow) as not set', () => {
    const result = build('');
    expect(result.status).toBe(0);
    expect(readFileSync(join(outDir, 'config.js'), 'utf8')).toBe(devConfig);
  });

  it.each([
    ['not https', 'http://script.google.com/macros/s/X/exec'],
    ['not a URL', 'production'],
    ['with a quote that would break the script', "https://example.com/'; alert(1); '"],
  ])('refuses a BACKEND_URL that is %s and fails the build', (_, url) => {
    const result = build(url);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('BACKEND_URL');
  });
});
