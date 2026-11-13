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

/** The emails in the Email column of the `organizers` tab (below the header), without blanks. */
function readOrganizerEmails(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('organizers');
  const rows = sheet.getLastRow() - 1;
  if (rows < 1) return [];
  return sheet
    .getRange(2, 1, rows, 1)
    .getValues()
    .map(function (row) {
      return String(row[0]).trim();
    })
    .filter(function (email) {
      return email !== '';
    });
}

/**
 * The groups and participants tabs, as the server's group code sees them (apps-script/groups.js):
 * plain objects in, plain objects out. Text cells are written as plain text, so a name like
 * `2026` or `1/12` never becomes a number or a date.
 */
function spreadsheetStore(spreadsheet) {
  function rowsOf(name) {
    const sheet = spreadsheet.getSheetByName(name);
    const count = sheet.getLastRow() - 1;
    if (count < 1) return [];
    return sheet.getRange(2, 1, count, sheet.getLastColumn()).getValues();
  }

  // Appends one row; `textColumns` are the 1-based columns written as plain text.
  function append(name, values, textColumns) {
    const sheet = spreadsheet.getSheetByName(name);
    const row = sheet.getLastRow() + 1;
    textColumns.forEach(function (column) {
      sheet.getRange(row, column, 1, 1).setNumberFormats([['@']]);
    });
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  }

  return {
    readGroups: function () {
      return rowsOf('groups')
        .filter(function (row) {
          return row[0] !== '';
        })
        .map(function (row) {
          return {
            id: String(row[0]),
            name: String(row[1]),
            created: row[2],
            draw: String(row[3]),
          };
        });
    },
    readParticipants: function () {
      return rowsOf('participants')
        .filter(function (row) {
          return row[0] !== '';
        })
        .map(function (row) {
          return {
            groupId: String(row[0]),
            number: Number(row[1]),
            name: String(row[2]),
            email: String(row[3]),
            exclusions: String(row[4]),
          };
        });
    },
    addGroup: function (group) {
      append('groups', [group.id, group.name, group.created, '', '', ''], [1, 2]);
    },
    addParticipant: function (participant) {
      append(
        'participants',
        [participant.groupId, participant.number, participant.name, participant.email, '', '', ''],
        [1, 3, 4],
      );
    },
    renameGroup: function (id, name) {
      const index = rowsOf('groups').findIndex(function (row) {
        return String(row[0]) === id;
      });
      if (index === -1) throw new Error('No group with ID ' + id);
      const cell = spreadsheet.getSheetByName('groups').getRange(index + 2, 2, 1, 1);
      cell.setNumberFormats([['@']]);
      cell.setValues([[name]]);
    },
    // Changes only the given fields (number, name, email, exclusions) of one participant's row.
    updateParticipant: function (groupId, number, changes) {
      const row = participantRow(groupId, number);
      const sheet = spreadsheet.getSheetByName('participants');
      Object.keys(PARTICIPANT_CELLS).forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(changes, field)) return;
        const cell = sheet.getRange(row, PARTICIPANT_CELLS[field].column, 1, 1);
        if (PARTICIPANT_CELLS[field].text) cell.setNumberFormats([['@']]);
        cell.setValues([[changes[field]]]);
      });
    },
    deleteParticipant: function (groupId, number) {
      spreadsheet.getSheetByName('participants').deleteRow(participantRow(groupId, number));
    },
  };

  // The sheet row (1-based) of a group's participant.
  function participantRow(groupId, number) {
    const index = rowsOf('participants').findIndex(function (row) {
      return String(row[0]) === groupId && Number(row[1]) === number;
    });
    if (index === -1) throw new Error('No participant ' + number + ' in group ' + groupId);
    return index + 2;
  }
}

// The participant fields that can change, with their column and whether it is plain text.
const PARTICIPANT_CELLS = {
  number: { column: 2, text: false },
  name: { column: 3, text: true },
  email: { column: 4, text: true },
  exclusions: { column: 5, text: true },
};

if (typeof module !== 'undefined') {
  module.exports = { SHEETS, ensureSheets, readOrganizerEmails, spreadsheetStore };
}
