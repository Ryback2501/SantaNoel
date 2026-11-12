// Builds the static site: copies web/ into a fresh dist/ (no bundler needed).
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../web', import.meta.url));
const target = fileURLToPath(new URL('../dist', import.meta.url));

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log('Built dist/ from web/');
