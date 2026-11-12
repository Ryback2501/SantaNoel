// Builds the static site: copies web/ into a fresh output folder (dist/ by default, or the folder
// given as the first argument). No bundler needed.
//
// When the BACKEND_URL environment variable is set (the release workflow sets it to the
// production web app), the published config.js points to that backend instead of the
// development one kept in web/config.js.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../web', import.meta.url));
const target = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../dist', import.meta.url));

// An https URL with no spaces, quotes or backslashes, so it can go inside a JS string as is.
const SAFE_HTTPS_URL = /^https:\/\/[^\s'"\\]+$/;

function configFor(backendUrl) {
  return `// Public settings of the site (no secrets here). Written by the build for this release.
const SANTANOEL_CONFIG = {
  backendUrl: '${backendUrl}',
};
`;
}

// An empty value counts as not set: an unset repo variable reaches the workflow as ''.
const backendUrl = process.env.BACKEND_URL || undefined;
if (backendUrl !== undefined && !SAFE_HTTPS_URL.test(backendUrl)) {
  console.error('BACKEND_URL must be an https:// address with no spaces or quotes.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

if (backendUrl !== undefined) {
  writeFileSync(join(target, 'config.js'), configFor(backendUrl));
  console.log(`Built ${target} from web/, using the backend ${backendUrl}`);
} else {
  console.log(`Built ${target} from web/`);
}
