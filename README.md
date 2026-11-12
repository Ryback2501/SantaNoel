# SantaNoel

A personal-use web app, in Spanish, to organize a Secret Santa ("amigo invisible"): create a group, draw who gives a present to whom (respecting exclusions), email each participant a personal link, and share letters to the Three Kings (wish lists).

- `web/` — the static frontend (HTML, CSS, JavaScript), published to GitHub Pages.
- `apps-script/` — the Google Apps Script backend.
- `tests/` — unit tests (Vitest).
- `scripts/` — project tooling (the build).

## Requirements

- Node.js 22 or newer, with npm.

## Install

```bash
npm ci
```

## Start the app locally

```bash
npm run dev
```

It serves `web/` at http://localhost:5173, reachable only from this computer (caching off, so a reload always shows your latest changes). Open that address in the browser. Stop it with `Ctrl+C`.

## Lint

```bash
npm run lint
```

Runs ESLint, then checks the formatting with Prettier. To fix the formatting of a file: `npx prettier --write <file>`.

## Unit tests

```bash
npm run test:unit
```

Code in `apps-script/` that needs tests is written as plain functions and ends with:

```js
if (typeof module !== 'undefined') {
  module.exports = { myFunction };
}
```

Apps Script ignores that block, and the tests load the file with `require` (see `tests/example.test.js`).

## Build

```bash
npm run build
```

Copies `web/` into a fresh `dist/` folder, which is what gets published.

## Backend (Google Apps Script)

The backend is a Google Apps Script web app in `apps-script/`. It is the only part that reads or writes the spreadsheet. The page talks to it with `POST` requests whose body is JSON sent as `text/plain` (this avoids the CORS preflight that Apps Script cannot answer).

There are two Apps Script projects, each with its own spreadsheet:

- **Development**: used by `npm run dev` and manual tests. `apps-script/.clasp.json` points to it, and `web/config.js` holds its web app address.
- **Production**: deployed only by a release.

clasp (the Apps Script command-line tool) is run on demand with a pinned version through `npm run clasp -- <command>`; it is not installed as a dependency. Its credentials are saved in `~/.clasprc.json`, outside the repository, and must never be committed.

### Day-to-day commands

```bash
npm run backend:push     # upload apps-script/ to the development project
npm run backend:deploy   # publish what was uploaded to the development web app (same address every time)
```

A change to the backend is visible to the page only after both commands.

### Setting up a backend from scratch

The development project already exists for this repository. These are the steps used to create it, and the ones to repeat for a new project.

1. Turn on the **Apps Script API** for your Google account: https://script.google.com/home/usersettings
2. Log in once: `npm run clasp -- login`, and allow access in the browser.
3. Create the project in an empty folder outside the repository (so clasp cannot overwrite `apps-script/appsscript.json`):
   ```bash
   npx --yes @google/clasp@3.4.1 create-script --type standalone --title "SantaNoel (desarrollo)"
   ```
   Copy the `scriptId` it writes to `.clasp.json` into `apps-script/.clasp.json`.
4. Upload the code: `npm run backend:push`.
5. Create the spreadsheet: open the project (`https://script.google.com/d/<scriptId>/edit`), choose the function **`setup`** in the file `sheets.gs`, and click **Run**. Accept Google's permission screen (for your own script, "Advanced → Go to … (unsafe)"). `setup` creates the spreadsheet with every tab and column, formats Draw and Exclusions as plain text, and saves its ID in the Script Property `SPREADSHEET_ID`. Running it again only adds what is missing.
6. Create the web app deployment once: `cd apps-script && npx --yes @google/clasp@3.4.1 create-deployment -d desarrollo`. Put the deployment ID it prints in `package.json` → `config.devDeploymentId`, and the address `https://script.google.com/macros/s/<deploymentId>/exec` in `web/config.js`.
7. Run `npm run dev`: the home page shows "Conectado con el servidor".

### Script Properties

Settings and secrets of the backend live in the project's **Script Properties** (Apps Script editor → Project Settings → Script Properties), never in the code or the frontend. Every property must be set in both projects (development and production).

| Property          | What it is                                                            | Set by                            |
| ----------------- | --------------------------------------------------------------------- | --------------------------------- |
| `SPREADSHEET_ID`  | ID of the spreadsheet with the data                                   | `setup` (above)                   |
| `OAUTH_CLIENT_ID` | Client ID of "Sign in with Google" (same value as in `web/config.js`) | by hand (see "Organizer sign-in") |

### Spreadsheet

All data lives in one spreadsheet per project, with these tabs (row 1 holds the column names):

- `groups`: Group ID · Name · Creation date · Draw · Email text · Wishlist text
- `participants`: Group ID · Participant number · Name · Email · Exclusions · Token · Email sent
- `wishes`: Group ID · Participant number · Item position · Description · Link
- `organizers`: Email (the Google accounts allowed to organize; edited by hand)

The spreadsheet is not shared with anyone: the web app runs as its owner and controls access itself.

### Organizer sign-in (Google)

Organizers sign in with "Sign in with Google". The page gets a Google ID token and sends it with every organizer request; the server checks it with Google on every request (`whoami` and every later organizer action) and lets in only the emails of the `organizers` tab. The token is kept only for the browser tab (`sessionStorage`); "Cerrar sesión" forgets it.

One OAuth client serves development and production. To create it (once):

1. Open the Google Cloud console (https://console.cloud.google.com/) with the same Google account, and create a project (for example "SantaNoel").
2. **Google Auth Platform → Branding** (the OAuth consent screen): app name "Amigo invisible", your email as support and developer contact; audience **External**. Under **Audience**, publish the app (**In production**): sign-in asks only for name and email, which needs no Google review; in "Testing" only the listed test users could sign in.
3. **Google Auth Platform → Clients → Create client**: type **Web application**, name "SantaNoel web". **Authorized JavaScript origins**: `http://localhost:5173` and `https://ryback2501.github.io`. No redirect URIs.
4. Copy the **Client ID** (`….apps.googleusercontent.com`; it is public, not a secret) into:
   - `web/config.js` → `googleClientId`;
   - the Script Property `OAUTH_CLIENT_ID` of **both** Apps Script projects.
5. Add the organizers' Google emails to the `organizers` tab of each spreadsheet (one per row, below the header).

The backend calls Google to check tokens, so each Apps Script project needs that permission once: after pushing this code, run `setup` again in the editor and accept the new permission. In production, also deploy once from the editor (**Deploy → Manage deployments → edit → New version → Deploy**), as in the production setup; otherwise the web app keeps refusing calls.

To check the server by hand (`<url>` is the web app address):

```bash
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data '{"action":"whoami","idToken":"made-up"}' <url>
# {"ok":false,"error":"invalid_token"}
```

## Production

Every release (a `dev → main` fast-forward) runs `.github/workflows/release.yml`, which:

1. builds the site with `BACKEND_URL` set, so the published `config.js` points to the production backend (local `npm run dev` keeps the development one);
2. publishes the site to GitHub Pages: https://ryback2501.github.io/SantaNoel/ (when `PAGES_DEPLOY_ENABLED` is `true`);
3. runs `scripts/deploy-backend.sh`, which pushes `apps-script/` to the production project and updates its **existing** web app deployment, so the backend address never changes (when `BACKEND_DEPLOY_ENABLED` is `true`).

### GitHub settings

Repo variables (Settings → Secrets and variables → Actions → Variables):

| Variable                    | Value                                                    |
| --------------------------- | -------------------------------------------------------- |
| `BACKEND_URL`               | `https://script.google.com/macros/s/<deploymentId>/exec` |
| `APPS_SCRIPT_ID`            | the production `scriptId`                                |
| `APPS_SCRIPT_DEPLOYMENT_ID` | the production web app deployment ID                     |
| `PAGES_DEPLOY_ENABLED`      | `true`                                                   |
| `BACKEND_DEPLOY_ENABLED`    | `true`                                                   |

Secret: `CLASPRC_JSON`, the content of `~/.clasprc.json` (the clasp credentials). It is never committed: the workflow writes it to the runner only for the backend job and deletes it afterwards. If `BACKEND_URL` is not set, the Pages deploy stops with an error rather than publish a site that talks to the development backend. The site is published only after the backend deploy succeeds (or when that deploy is turned off).

### Setting up production from scratch

1. Turn on the **Apps Script API** and log in with clasp (steps 1–2 of the backend setup above).
2. In an empty folder outside the repository, create the project, copy the code in, upload it and create the web app deployment:
   ```bash
   npx --yes @google/clasp@3.4.1 create-script --type standalone --title "SantaNoel" --rootDir .
   cp <repo>/apps-script/*.js <repo>/apps-script/appsscript.json .
   npx --yes @google/clasp@3.4.1 push --force
   npx --yes @google/clasp@3.4.1 create-deployment -d produccion
   ```
   The `scriptId` is in that folder's `.clasp.json`; the deployment ID is printed by the last command.
3. Open the project (`https://script.google.com/d/<scriptId>/edit`) and run **`setup`** in `sheets.gs`, as in step 5 of the backend setup. Rename the spreadsheet it creates to "SantaNoel" in Drive (the name is only a label; the code uses the ID).
4. Still in the editor, deploy once by hand so the web app gets your authorization: **Deploy → Manage deployments → `produccion` → edit (pencil) → Version: New version → Deploy**, and accept the permission screen ("This app hasn't been verified by Google" is expected for your own script: continue). Without this step the web app answers every call with "Acceso denegado", even with "Who has access: Anyone". The deployment ID does not change, and later releases update it from the command line.
5. Check it answers: `curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data '{"action":"ping"}' https://script.google.com/macros/s/<deploymentId>/exec` prints `{"ok":true}`.
6. Set every Script Property of the checklist above in the production project (`setup` sets `SPREADSHEET_ID`).
7. Turn on Pages with GitHub Actions as its source: `gh api -X POST repos/Ryback2501/SantaNoel/pages -f build_type=workflow`.
8. Set the repo variables of the table above, and the secret yourself: `gh secret set CLASPRC_JSON < ~/.clasprc.json`.
9. Cut a release: the site shows "Conectado con el servidor".

### Maintenance

- **The backend job fails with an authentication error**: the clasp token expired or was revoked. Run `npm run clasp -- login` again, then `gh secret set CLASPRC_JSON < ~/.clasprc.json`, and re-run the failed job.
- **A new Script Property** (added by a later change) must be set in the production project before the next release.
- **A change that needs a new Google permission** (for example the first one that calls an outside service): before the next release, run `setup` once in the production editor to accept it, then deploy once from the editor (**Deploy → Manage deployments → edit → New version → Deploy**).
- **Google sign-in**: the OAuth client's authorized JavaScript origins must include `https://ryback2501.github.io` (and `http://localhost:5173` for development).
