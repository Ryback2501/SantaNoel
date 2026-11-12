import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('npm run build', () => {
  it('creates dist/ containing the home page', () => {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });

    const built = new URL('../dist/index.html', import.meta.url);
    expect(existsSync(built)).toBe(true);
    expect(readFileSync(built, 'utf8')).toBe(
      readFileSync(new URL('../web/index.html', import.meta.url), 'utf8'),
    );
  });
});
