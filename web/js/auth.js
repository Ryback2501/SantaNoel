/**
 * Organizer sign-in on the page. Google gives the page an ID token; the page keeps it only for
 * this browser tab (sessionStorage) and asks the server, with `whoami`, who it belongs to. The
 * server decides; the page only turns its answer into what to show:
 *   { signedIn: true, greeting }   or   { signedIn: false, message }
 */

/* global callBackend */

const TOKEN_KEY = 'santanoel.idToken';

const SIGN_IN_MESSAGES = {
  not_authorized: 'Esta cuenta no está autorizada para organizar',
  session_expired: 'Tu sesión ha caducado, inicia sesión de nuevo',
};
const SIGN_IN_FAILED = 'No se pudo iniciar sesión, inténtalo de nuevo';

function greetingFor(name) {
  return name ? 'Hola, ' + name : 'Hola';
}

/** Google has just signed the organizer in: keep the token and ask the server. */
async function startSession(backendUrl, idToken, storage, fetchFn) {
  storage.setItem(TOKEN_KEY, idToken);
  return checkSession(backendUrl, idToken, storage, fetchFn);
}

/** The page has just loaded: check the token kept from before, if any. */
async function resumeSession(backendUrl, storage, fetchFn) {
  const idToken = storage.getItem(TOKEN_KEY);
  if (!idToken) {
    return { signedIn: false, message: '' };
  }
  return checkSession(backendUrl, idToken, storage, fetchFn);
}

/** "Cerrar sesión": forget the token. */
function endSession(storage) {
  storage.removeItem(TOKEN_KEY);
}

/** The token kept for this tab, for the other requests of the page; null when there is none. */
function storedToken(storage) {
  try {
    return storage.getItem(TOKEN_KEY) || null;
  } catch {
    // The browser blocks this site's storage: nothing can be kept.
    return null;
  }
}

/** The message for a sign-in refusal (session_expired, not_authorized, …) from the server. */
function signInMessageFor(error) {
  return Object.prototype.hasOwnProperty.call(SIGN_IN_MESSAGES, error)
    ? SIGN_IN_MESSAGES[error]
    : SIGN_IN_FAILED;
}

async function checkSession(backendUrl, idToken, storage, fetchFn) {
  let answer;
  try {
    answer = await backendCall()(backendUrl, 'whoami', { idToken: idToken }, fetchFn);
  } catch {
    answer = null;
  }
  if (answer && answer.ok === true) {
    return { signedIn: true, greeting: greetingFor(answer.name) };
  }
  // Any refusal or failure: forget the token, so a reload does not try it again.
  endSession(storage);
  return { signedIn: false, message: signInMessageFor(answer && answer.error) };
}

// In the browser every script shares one global scope; the Node tests load api.js with require.
function backendCall() {
  return typeof module !== 'undefined' ? require('./api.js').callBackend : callBackend;
}

if (typeof module !== 'undefined') {
  module.exports = {
    startSession,
    resumeSession,
    endSession,
    greetingFor,
    storedToken,
    signInMessageFor,
  };
}
