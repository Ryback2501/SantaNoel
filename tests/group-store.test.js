// Groups and participants in the spreadsheet (spreadsheetStore in apps-script/sheets.js): the
// rows the server reads and writes in the `groups` and `participants` tabs.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { spreadsheetStore } = require('../apps-script/sheets.js');

const CREATED = new Date(Date.UTC(2026, 10, 13, 12, 0, 0));

// Minimal stand-in for a Spreadsheet whose tabs hold rows of values (row 1 is the header), and
// remembers the number format of every cell written.
function fakeSpreadsheet(tabs) {
  const sheets = {};
  Object.entries(tabs).forEach(([name, rows]) => {
    const sheet = {
      rows: rows.map((row) => [...row]),
      formats: {},
      getLastRow: () => sheet.rows.length,
      getLastColumn: () => sheet.rows[0].length,
      getRange(row, col, numRows, numCols) {
        return {
          getValues: () =>
            sheet.rows
              .slice(row - 1, row - 1 + numRows)
              .map((r) => r.slice(col - 1, col - 1 + numCols)),
          setValues(values) {
            values.forEach((valueRow, i) => {
              const target = (sheet.rows[row - 1 + i] = sheet.rows[row - 1 + i] || []);
              valueRow.forEach((value, j) => {
                target[col - 1 + j] = value;
              });
            });
          },
          setNumberFormats(formats) {
            formats.forEach((formatRow, i) =>
              formatRow.forEach((format, j) => {
                sheet.formats[`${row + i},${col + j}`] = format;
              }),
            );
          },
        };
      },
    };
    sheets[name] = sheet;
  });
  return { sheets, getSheetByName: (name) => sheets[name] || null };
}

const GROUP_HEADERS = ['Group ID', 'Name', 'Creation date', 'Draw', 'Email text', 'Wishlist text'];
const PARTICIPANT_HEADERS = [
  'Group ID',
  'Participant number',
  'Name',
  'Email',
  'Exclusions',
  'Token',
  'Email sent',
];

function spreadsheet(groupRows = [], participantRows = []) {
  return fakeSpreadsheet({
    groups: [GROUP_HEADERS, ...groupRows],
    participants: [PARTICIPANT_HEADERS, ...participantRows],
  });
}

describe('groups and participants in the spreadsheet (spreadsheetStore)', () => {
  it('reads no groups or participants when the tabs have only their header', () => {
    const store = spreadsheetStore(spreadsheet());
    expect(store.readGroups()).toEqual([]);
    expect(store.readParticipants()).toEqual([]);
  });

  it('reads the groups below the header', () => {
    const ss = spreadsheet([['g-1', 'Navidad 2026', CREATED, '', '', '']]);
    expect(spreadsheetStore(ss).readGroups()).toEqual([
      { id: 'g-1', name: 'Navidad 2026', created: CREATED },
    ]);
  });

  it('reads a name the spreadsheet turned into a number back as text', () => {
    const ss = spreadsheet(
      [['g-1', 2026, CREATED, '', '', '']],
      [['g-1', 1, 2026, 'a@b.c', '', '', '']],
    );
    const store = spreadsheetStore(ss);
    expect(store.readGroups()[0].name).toBe('2026');
    expect(store.readParticipants()[0].name).toBe('2026');
  });

  it('reads the participants below the header, with their number as a number', () => {
    const ss = spreadsheet([], [['g-1', '1', 'Ana', 'ana@example.com', '', '', '']]);
    expect(spreadsheetStore(ss).readParticipants()).toEqual([
      { groupId: 'g-1', number: 1, name: 'Ana', email: 'ana@example.com' },
    ]);
  });

  it('adds a group as a new row, with Draw, Email text and Wishlist text empty', () => {
    const ss = spreadsheet([['g-0', 'Navidad 2025', CREATED, '', '', '']]);
    spreadsheetStore(ss).addGroup({ id: 'g-1', name: 'Navidad 2026', created: CREATED });
    expect(ss.sheets.groups.rows[2]).toEqual(['g-1', 'Navidad 2026', CREATED, '', '', '']);
  });

  it('writes the Group ID and Name of a new group as plain text', () => {
    const ss = spreadsheet();
    spreadsheetStore(ss).addGroup({ id: 'g-1', name: '1/12', created: CREATED });
    expect(ss.sheets.groups.formats['2,1']).toBe('@');
    expect(ss.sheets.groups.formats['2,2']).toBe('@');
  });

  it('adds a participant as a new row, with Exclusions, Token and Email sent empty', () => {
    const ss = spreadsheet();
    spreadsheetStore(ss).addParticipant({
      groupId: 'g-1',
      number: 1,
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(ss.sheets.participants.rows[1]).toEqual([
      'g-1',
      1,
      'Ana',
      'ana@example.com',
      '',
      '',
      '',
    ]);
  });

  it('writes the Group ID, Name and Email of a new participant as plain text', () => {
    const ss = spreadsheet();
    spreadsheetStore(ss).addParticipant({
      groupId: 'g-1',
      number: 1,
      name: '2026',
      email: 'a@b.c',
    });
    expect(ss.sheets.participants.formats['2,1']).toBe('@');
    expect(ss.sheets.participants.formats['2,3']).toBe('@');
    expect(ss.sheets.participants.formats['2,4']).toBe('@');
  });

  it('renames a group by changing only the Name of its row', () => {
    const ss = spreadsheet([
      ['g-1', 'Navidad 2026', CREATED, '', '', ''],
      ['g-2', 'Navidad 2027', CREATED, '1-2', '', ''],
    ]);
    spreadsheetStore(ss).renameGroup('g-2', 'Navidad en casa');
    expect(ss.sheets.groups.rows[1]).toEqual(['g-1', 'Navidad 2026', CREATED, '', '', '']);
    expect(ss.sheets.groups.rows[2]).toEqual(['g-2', 'Navidad en casa', CREATED, '1-2', '', '']);
  });
});
