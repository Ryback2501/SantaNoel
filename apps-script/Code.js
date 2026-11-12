/**
 * Entry point of the Apps Script web app. The frontend sends every request as a POST with
 * `Content-Type: text/plain` and a JSON body, which avoids the CORS preflight Apps Script cannot
 * answer. The answer is always JSON.
 */

/* global handleRequest, readOrganizerEmails, readTokenExpiry */

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

/** The real services the actions use (see apps-script/auth.js). */
function appsScriptServices() {
  const properties = PropertiesService.getScriptProperties();
  return {
    clientId: properties.getProperty('OAUTH_CLIENT_ID'),
    fetchTokenInfo: function (idToken) {
      const response = UrlFetchApp.fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
        { muteHttpExceptions: true },
      );
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
      return readOrganizerEmails(SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID')));
    },
    now: function () {
      return Date.now();
    },
  };
}
