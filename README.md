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

| Property         | What it is                          | Set by          |
| ---------------- | ----------------------------------- | --------------- |
| `SPREADSHEET_ID` | ID of the spreadsheet with the data | `setup` (above) |

### Spreadsheet

All data lives in one spreadsheet per project, with these tabs (row 1 holds the column names):

- `groups`: Group ID · Name · Creation date · Draw · Email text · Wishlist text
- `participants`: Group ID · Participant number · Name · Email · Exclusions · Token · Email sent
- `wishes`: Group ID · Participant number · Item position · Description · Link
- `organizers`: Email (the Google accounts allowed to organize; edited by hand)

The spreadsheet is not shared with anyone: the web app runs as its owner and controls access itself.
