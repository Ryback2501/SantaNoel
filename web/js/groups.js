/**
 * The organizer's groups on the page. Each function asks the server and turns its answer into
 * what to show, one of:
 *   { kind: 'list', groups: [{ name, url }], message }   my groups (message when there are none)
 *   { kind: 'group', group }                             one group, to show on its page
 *   { kind: 'saved', group: { id, name } }               a create or rename was saved
 *   { kind: 'invalid', message }                         a refused value: show it on the form
 *   { kind: 'notFound', message }                        no such group, or not mine
 *   { kind: 'signin', message }                          go and sign in (message may be '')
 *   { kind: 'error', message }                           a technical failure
 * The server decides everything; the checks here only spare a request that would be refused.
 */

/* global callBackend, storedToken, signInMessageFor */

const NO_GROUPS = 'Todavía no tienes grupos';
const GROUP_NOT_FOUND = 'No se encontró el grupo';
const SAVE_FAILED = 'No se pudo guardar, inténtalo de nuevo';
const LOAD_FAILED = 'No se pudieron cargar los datos, inténtalo de nuevo';
const GROUP_NAME_REQUIRED = 'El nombre del grupo es obligatorio';
const FIRST_NAME_REQUIRED = 'Tu nombre es obligatorio';

// The server's refusals of a value the organizer typed.
const VALUE_MESSAGES = {
  group_name_required: GROUP_NAME_REQUIRED,
  first_name_required: FIRST_NAME_REQUIRED,
  duplicate_name: 'Ya tienes un grupo con ese nombre',
};

// The server's refusals of the sign-in itself.
const SESSION_ERRORS = ['invalid_token', 'session_expired', 'not_authorized'];

async function loadMyGroups(backendUrl, storage, fetchFn) {
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  const answer = await ask(backendUrl, 'listGroups', { idToken: idToken }, fetchFn);
  if (answer && answer.ok === true && Array.isArray(answer.groups)) {
    const groups = answer.groups.map(function (group) {
      return { name: String(group.name), url: groupPageUrl(group.id) };
    });
    return { kind: 'list', groups: groups, message: groups.length ? '' : NO_GROUPS };
  }
  return refusal(answer, LOAD_FAILED);
}

async function createGroup(backendUrl, storage, form, fetchFn) {
  const name = trimmed(form.name);
  if (!name) return { kind: 'invalid', message: GROUP_NAME_REQUIRED };
  const firstName = trimmed(form.firstName);
  if (!firstName) return { kind: 'invalid', message: FIRST_NAME_REQUIRED };
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  const answer = await ask(
    backendUrl,
    'createGroup',
    { idToken: idToken, name: name, firstName: firstName },
    fetchFn,
  );
  return savedOr(answer);
}

async function loadGroup(backendUrl, storage, groupId, fetchFn) {
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  if (!groupId) return { kind: 'notFound', message: GROUP_NOT_FOUND };
  const answer = await ask(backendUrl, 'getGroup', { idToken: idToken, groupId: groupId }, fetchFn);
  if (answer && answer.ok === true && answer.group) {
    return { kind: 'group', group: answer.group };
  }
  return refusal(answer, LOAD_FAILED);
}

async function renameGroup(backendUrl, storage, groupId, newName, fetchFn) {
  const name = trimmed(newName);
  if (!name) return { kind: 'invalid', message: GROUP_NAME_REQUIRED };
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  const answer = await ask(
    backendUrl,
    'renameGroup',
    { idToken: idToken, groupId: groupId, name: name },
    fetchFn,
  );
  return savedOr(answer);
}

/** The address of a group's page. */
function groupPageUrl(groupId) {
  return 'group.html?id=' + encodeURIComponent(groupId);
}

/** The group ID from a page address's query (`location.search`), or '' when there is none. */
function groupIdFrom(search) {
  return new URLSearchParams(search).get('id') || '';
}

// The answer to a create or rename.
function savedOr(answer) {
  if (answer && answer.ok === true && answer.group) {
    return { kind: 'saved', group: { id: answer.group.id, name: answer.group.name } };
  }
  return refusal(answer, SAVE_FAILED);
}

// Any answer that is not ok: a refused value, no such group, the sign-in, or a technical failure.
function refusal(answer, failureMessage) {
  const error = answer && answer.ok === false ? answer.error : null;
  if (Object.prototype.hasOwnProperty.call(VALUE_MESSAGES, error)) {
    return { kind: 'invalid', message: VALUE_MESSAGES[error] };
  }
  if (error === 'not_found') return { kind: 'notFound', message: GROUP_NOT_FOUND };
  if (SESSION_ERRORS.indexOf(error) !== -1) {
    return { kind: 'signin', message: sessionHelpers().signInMessageFor(error) };
  }
  return { kind: 'error', message: failureMessage };
}

// The server's answer, or null when it cannot be reached or answers with an HTTP error.
async function ask(backendUrl, action, data, fetchFn) {
  try {
    return await backendCall()(backendUrl, action, data, fetchFn);
  } catch {
    return null;
  }
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// In the browser every script shares one global scope; the Node tests load them with require.
function backendCall() {
  return typeof module !== 'undefined' ? require('./api.js').callBackend : callBackend;
}

function sessionHelpers() {
  return typeof module !== 'undefined'
    ? require('./auth.js')
    : { storedToken: storedToken, signInMessageFor: signInMessageFor };
}

if (typeof module !== 'undefined') {
  module.exports = {
    loadMyGroups,
    createGroup,
    loadGroup,
    renameGroup,
    groupPageUrl,
    groupIdFrom,
  };
}
