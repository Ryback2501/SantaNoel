/**
 * Organizer sign-in. Every organizer request carries the Google ID token, and the server checks
 * it on every request before doing anything: Google must accept it, it must be for this app, not
 * expired, with a verified email, and that email must be listed in the `organizers` tab.
 *
 * Everything outside this file is passed in `services`, so the tests need no network:
 *   clientId          the Script Property OAUTH_CLIENT_ID
 *   fetchTokenInfo    (idToken) → { status, body } from Google's tokeninfo endpoint
 *   tokenExpiry       (idToken) → the token's own `exp` (seconds), or null
 *   organizerEmails   () → the emails of the `organizers` tab
 *   now               () → the current time in milliseconds
 */

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

function authorizeOrganizer(idToken, services) {
  if (typeof idToken !== 'string' || idToken === '') {
    return { ok: false, error: 'invalid_token' };
  }
  if (!services.clientId) {
    throw new Error('The Script Property OAUTH_CLIENT_ID is not set');
  }
  const answer = services.fetchTokenInfo(idToken);
  if (answer.status >= 500 || !answer.body) {
    return { ok: false, error: 'server_error' };
  }
  const nowSeconds = services.now() / 1000;
  if (answer.status !== 200) {
    // Google answers the same for an expired token and a made-up one. The token's own expiry,
    // which is not trusted for anything else, only picks the more helpful message.
    const expiry = services.tokenExpiry(idToken);
    const expired = typeof expiry === 'number' && expiry <= nowSeconds;
    return { ok: false, error: expired ? 'session_expired' : 'invalid_token' };
  }
  const info = answer.body;
  if (
    info.aud !== services.clientId ||
    GOOGLE_ISSUERS.indexOf(info.iss) === -1 ||
    String(info.email_verified) !== 'true' ||
    typeof info.email !== 'string'
  ) {
    return { ok: false, error: 'invalid_token' };
  }
  if (!(Number(info.exp) > nowSeconds)) {
    return { ok: false, error: 'session_expired' };
  }
  if (!isOrganizer(info.email, services.organizerEmails())) {
    return { ok: false, error: 'not_authorized' };
  }
  return { ok: true, name: info.name || '', email: info.email };
}

/** True when `email` is in `organizerEmails`, ignoring case and surrounding spaces. */
function isOrganizer(email, organizerEmails) {
  const wanted = String(email).trim().toLowerCase();
  return organizerEmails.some(function (listed) {
    return String(listed).trim().toLowerCase() === wanted;
  });
}

/**
 * Reads the `exp` claim from the token's payload, without checking the signature: use it only
 * to choose an error message. `decode` turns base64 text into a string. Null when unreadable.
 */
function readTokenExpiry(idToken, decode) {
  try {
    const parts = String(idToken).split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1];
    while (payload.length % 4 !== 0) payload += '=';
    const claims = JSON.parse(decode(payload));
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { authorizeOrganizer, isOrganizer, readTokenExpiry };
}
