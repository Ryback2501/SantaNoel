/**
 * Entry point of the Apps Script web app. The frontend sends every request as a POST with
 * `Content-Type: text/plain` and a JSON body, which avoids the CORS preflight Apps Script cannot
 * answer. The answer is always JSON.
 */

/* global handleRequest, readOrganizerEmails, readTokenExpiry, spreadsheetStore */

function doPost(e) {
  let result;
  try {
    const body = e && e.postData ? e.postData.contents : '';
    result = handleRequest(body, appsScriptServices());
  } catch (error) {
    console.error(error);
    result = { ok: false, error: 'server_error' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** The real services the actions use (see apps-script/auth.js and apps-script/groups.js). */
function appsScriptServices() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheet = null;
  // Opened once per request, and only by the actions that need it (ping never does).
  function openSpreadsheet() {
    if (!spreadsheet)
      spreadsheet = SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
    return spreadsheet;
  }
  return {
    clientId: properties.getProperty('OAUTH_CLIENT_ID'),
    fetchTokenInfo: function (idToken) {
      // The token goes in the POST body, never in the URL, so no log or trace can capture it.
      const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', {
        method: 'post',
        payload: { id_token: idToken },
        muteHttpExceptions: true,
      });
      let body;
      try {
        body = JSON.parse(response.getContentText());
      } catch {
        body = null;
      }
      return { status: response.getResponseCode(), body: body };
    },
    tokenExpiry: function (idToken) {
      return readTokenExpiry(idToken, function (base64) {
        return Utilities.newBlob(Utilities.base64DecodeWebSafe(base64)).getDataAsString();
      });
    },
    organizerEmails: function () {
      return readOrganizerEmails(openSpreadsheet());
    },
    now: function () {
      return Date.now();
    },
    store: function () {
      return spreadsheetStore(openSpreadsheet());
    },
    newId: function () {
      return Utilities.getUuid();
    },
    // One save at a time for the whole web app, so two requests never mix their rows. If the
    // lock is not free within 10 seconds, waitLock throws and the answer is server_error.
    withLock: function (fn) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
  };
}
