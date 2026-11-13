/**
 * Request handling for the backend web app.
 *
 * Every request is a POST whose body is a JSON object with an `action`. Nothing the client sends
 * is trusted: the body is parsed and checked here before any action runs.
 */

/* global authorizeOrganizer */

const ACTIONS = {
  ping: function () {
    return { ok: true };
  },
  // Checks the organizer's Google sign-in; answers with their name and email.
  whoami: function (request, services) {
    return organizerCheck()(request.idToken, services);
  },
};

// In Apps Script every file shares one global scope; the Node tests load auth.js with require.
function organizerCheck() {
  return typeof module !== 'undefined'
    ? require('./auth.js').authorizeOrganizer
    : authorizeOrganizer;
}

/**
 * `services` are the outside world the actions use (Google's token check, Script Properties, the
 * spreadsheet): the real ones in Code.js, fakes in the tests.
 */
function handleRequest(text, services) {
  let request;
  try {
    request = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  if (
    request === null ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    typeof request.action !== 'string'
  ) {
    return { ok: false, error: 'invalid_request' };
  }
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, request.action)) {
    return { ok: false, error: 'unknown_action' };
  }
  return ACTIONS[request.action](request, services);
}

if (typeof module !== 'undefined') {
  module.exports = { handleRequest };
}
