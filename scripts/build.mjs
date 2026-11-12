// Builds the static site: copies web/ into a fresh output folder (dist/ by default, or the folder
// given as the first argument). No bundler needed.
//
// When the BACKEND_URL environment variable is set (the release workflow sets it to the
// production web app), the published config.js points to that backend instead of the
// development one kept in web/config.js.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../web', import.meta.url));
const target = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../dist', import.meta.url));

// An https URL with no spaces, quotes or backslashes, so it can go inside a JS string as is.
const SAFE_HTTPS_URL = /^https:\/\/[^\s'"\\]+$/;

// The published config.js is web/config.js with only the backendUrl value replaced, so every
// other setting (the Google client ID, …) is kept.
const BACKEND_URL_ENTRY = /backendUrl:\s*'[^']*'/;

function configFor(sourceConfig, backendUrl) {
  if (!BACKEND_URL_ENTRY.test(sourceConfig)) {
    console.error('web/config.js has no backendUrl entry to replace.');
    process.exit(1);
  }
  // A function, so a `$` in the address is never read as a replacement pattern.
  return sourceConfig.replace(BACKEND_URL_ENTRY, () => `backendUrl: '${backendUrl}'`);
}

const backendUrl = process.env.BACKEND_URL || undefined;
if (backendUrl !== undefined && !SAFE_HTTPS_URL.test(backendUrl)) {
  console.error('BACKEND_URL must be an https:// address with no spaces or quotes.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

if (backendUrl !== undefined) {
  const configPath = join(target, 'config.js');
  writeFileSync(configPath, configFor(readFileSync(configPath, 'utf8'), backendUrl));
  console.log(`Built ${target} from web/, using the backend ${backendUrl}`);
} else {
  console.log(`Built ${target} from web/`);
}
