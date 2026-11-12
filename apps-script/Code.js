/**
 * Entry point of the Apps Script web app. The frontend sends every request as a POST with
 * `Content-Type: text/plain` and a JSON body, which avoids the CORS preflight Apps Script cannot
 * answer. The answer is always JSON.
 */

/* global handleRequest */

function doPost(e) {
  let result;
  try {
    const body = e && e.postData ? e.postData.contents : '';
    result = handleRequest(body);
  } catch (error) {
    console.error(error);
    result = { ok: false, error: 'server_error' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
