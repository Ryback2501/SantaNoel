/**
 * Request handling for the backend web app.
 *
 * Every request is a POST whose body is a JSON object with an `action`. Nothing the client sends
 * is trusted: the body is parsed and checked here before any action runs.
 */

const ACTIONS = {
  ping: function () {
    return { ok: true };
  },
};

function handleRequest(text) {
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
  return ACTIONS[request.action](request);
}

if (typeof module !== 'undefined') {
  module.exports = { handleRequest };
}
