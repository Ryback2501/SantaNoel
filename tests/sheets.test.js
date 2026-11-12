// The spreadsheet layout (apps-script/sheets.js): the tabs, their exact header row, and the
// columns that must be plain text.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { SHEETS, ensureSheets } = require('../apps-script/sheets.js');

const EXPECTED = {
  groups: ['Group ID', 'Name', 'Creation date', 'Draw', 'Email text', 'Wishlist text'],
  participants: [
    'Group ID',
    'Participant number',
    'Name',
    'Email',
    'Exclusions',
    'Token',
    'Email sent',
  ],
  wishes: ['Group ID', 'Participant number', 'Item position', 'Description', 'Link'],
  organizers: ['Email'],
};

// Minimal stand-in for SpreadsheetApp's Spreadsheet / Sheet / Range, recording what is written.
function fakeSpreadsheet(existing = {}) {
  const sheets = {};
  function makeSheet(name, headers = []) {
    const sheet = {
      name,
      headers: [...headers],
      formats: {},
      getMaxRows: () => 1000,
      getLastColumn: () => sheet.headers.length,
      getRange(row, col, numRows, numCols) {
        return {
          getValues: () => [sheet.headers.slice(col - 1, col - 1 + numCols)],
          setValues(values) {
            expect(row).toBe(1);
            sheet.headers = [...values[0]];
          },
          setNumberFormat(format) {
            expect(numCols).toBe(1);
            sheet.formats[col] = { format, row, numRows };
          },
        };
      },
    };
    sheets[name] = sheet;
    return sheet;
  }
  Object.entries(existing).forEach(([name, headers]) => makeSheet(name, headers));
  return {
    sheets,
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => makeSheet(name),
  };
}

describe('spreadsheet layout (apps-script/sheets.js)', () => {
  it('defines exactly the tabs groups, participants, wishes and organizers', () => {
    expect(SHEETS.map((s) => s.name)).toEqual(['groups', 'participants', 'wishes', 'organizers']);
  });

  it.each(Object.entries(EXPECTED))('gives the %s tab its exact columns', (name, headers) => {
    expect(SHEETS.find((s) => s.name === name).headers).toEqual(headers);
  });

  it('creates every missing tab with its header row', () => {
    const ss = fakeSpreadsheet();
    ensureSheets(ss);
    Object.entries(EXPECTED).forEach(([name, headers]) => {
      expect(ss.sheets[name].headers).toEqual(headers);
    });
  });

  it('formats the whole Draw and Exclusions columns as plain text', () => {
    const ss = fakeSpreadsheet();
    ensureSheets(ss);
    expect(ss.sheets.groups.formats[4]).toEqual({ format: '@', row: 1, numRows: 1000 });
    expect(ss.sheets.participants.formats[5]).toEqual({ format: '@', row: 1, numRows: 1000 });
    expect(Object.keys(ss.sheets.groups.formats)).toEqual(['4']);
    expect(Object.keys(ss.sheets.participants.formats)).toEqual(['5']);
    expect(ss.sheets.wishes.formats).toEqual({});
    expect(ss.sheets.organizers.formats).toEqual({});
  });

  it('keeps tabs that already exist and writes their header row only when it is empty', () => {
    const ss = fakeSpreadsheet({ groups: EXPECTED.groups, organizers: [] });
    ensureSheets(ss);
    expect(ss.sheets.groups.headers).toEqual(EXPECTED.groups);
    expect(ss.sheets.organizers.headers).toEqual(['Email']);
    expect(Object.keys(ss.sheets).sort()).toEqual(
      ['groups', 'organizers', 'participants', 'wishes'].sort(),
    );
  });
});
