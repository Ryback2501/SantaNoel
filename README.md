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
