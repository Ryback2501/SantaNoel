/**
 * The spreadsheet that holds all the data. Its ID lives only in the Script Property
 * `SPREADSHEET_ID`, never in the code.
 *
 * Draw and Exclusions are plain-text columns: otherwise Sheets turns `1-3` into a date, or `1,3`
 * into the number 1.3 in a Spanish-locale spreadsheet.
 */

const SHEETS = [
  {
    name: 'groups',
    headers: ['Group ID', 'Name', 'Creation date', 'Draw', 'Email text', 'Wishlist text'],
    textColumns: ['Draw'],
  },
  {
    name: 'participants',
    headers: [
      'Group ID',
      'Participant number',
      'Name',
      'Email',
      'Exclusions',
      'Token',
      'Email sent',
    ],
    textColumns: ['Exclusions'],
  },
  {
    name: 'wishes',
    headers: ['Group ID', 'Participant number', 'Item position', 'Description', 'Link'],
    textColumns: [],
  },
  {
    name: 'organizers',
    headers: ['Email'],
    textColumns: [],
  },
];

/**
 * Makes sure every tab exists with its header row and its plain-text columns. Tabs that already
 * exist are kept, and a header row that is already filled in is never overwritten.
 */
function ensureSheets(spreadsheet) {
  SHEETS.forEach(function (definition) {
    const sheet =
      spreadsheet.getSheetByName(definition.name) || spreadsheet.insertSheet(definition.name);
    const current =
      sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, definition.headers.length).getValues()[0]
        : [];
    const headerIsEmpty = current.every(function (value) {
      return value === '';
    });
    if (headerIsEmpty) {
      sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
    }
    definition.textColumns.forEach(function (name) {
      const column = definition.headers.indexOf(name) + 1;
      sheet.getRange(1, column, sheet.getMaxRows(), 1).setNumberFormat('@');
    });
  });
}

/**
 * Run once from the Apps Script editor (it also shows Google's permission screen). Creates the
 * spreadsheet if `SPREADSHEET_ID` is not set yet and saves its ID there; otherwise opens it. Then
 * adds whatever tabs, header rows and formats are missing, and removes empty tabs that are not
 * part of the layout (the default first sheet of a new spreadsheet).
 */
function setup() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty('SPREADSHEET_ID');
  let spreadsheet;
  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    spreadsheet = SpreadsheetApp.create('SantaNoel (desarrollo)');
    properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  }
  ensureSheets(spreadsheet);
  const names = SHEETS.map(function (definition) {
    return definition.name;
  });
  spreadsheet.getSheets().forEach(function (sheet) {
    if (names.indexOf(sheet.getName()) === -1 && sheet.getLastRow() === 0) {
      spreadsheet.deleteSheet(sheet);
    }
  });
  console.log('Hoja de cálculo lista: ' + spreadsheet.getUrl());
}

if (typeof module !== 'undefined') {
  module.exports = { SHEETS, ensureSheets };
}
