/**
 * The organizer's groups on the page. Each function asks the server and turns its answer into
 * what to show, one of:
 *   { kind: 'list', groups: [{ name, url }], message }   my groups (message when there are none)
 *   { kind: 'group', group }                             one group, to show on its page
 *   { kind: 'saved', group: { id, name } }               a create or rename was saved
 *   { kind: 'invalid', message }                         a refused value: show it on the form
 *   { kind: 'saved', participants }                      a participant change was saved
 *   { kind: 'notFound', message }                        no such group, or not mine
 *   { kind: 'participantNotFound', message }             that participant no longer exists
 *   { kind: 'locked', message }                          the draw is done: the list is locked
 *   { kind: 'listChanged', message }                     the list changed under an open form
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
const NAME_REQUIRED = 'El nombre es obligatorio';
const EMAIL_INVALID = 'El correo no es válido';
const LIST_LOCKED = 'El sorteo ya está hecho: la lista está bloqueada';
const PARTICIPANT_NOT_FOUND = 'No se encontró al participante';
const LIST_CHANGED = 'La lista de participantes ha cambiado, revisa las exclusiones';

// something@something.tld, the same simple check as the server's.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The server's refusals of a value the organizer typed.
const VALUE_MESSAGES = {
  group_name_required: GROUP_NAME_REQUIRED,
  first_name_required: FIRST_NAME_REQUIRED,
  duplicate_name: 'Ya tienes un grupo con ese nombre',
  name_required: NAME_REQUIRED,
  email_invalid: EMAIL_INVALID,
  duplicate_email: 'Ese correo ya está en el grupo',
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

async function addParticipant(backendUrl, storage, groupId, form, fetchFn) {
  const values = checkedParticipant(form.name, form.email);
  if (values.message) return { kind: 'invalid', message: values.message };
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  const answer = await ask(
    backendUrl,
    'addParticipant',
    { idToken: idToken, groupId: groupId, name: values.name, email: values.email },
    fetchFn,
  );
  return listOr(answer);
}

/**
 * For participant 1 (the organizer) `form.email` is left out: their email cannot change.
 * `form.exclusions` (numbers) and `form.participants` (the list the form showed, numbers and
 * emails) are sent only when given, so the server can tell when the list changed meanwhile.
 */
async function updateParticipant(backendUrl, storage, groupId, number, form, fetchFn) {
  const data = { groupId: groupId, number: number };
  if (form.email === undefined) {
    data.name = trimmed(form.name);
    if (!data.name) return { kind: 'invalid', message: NAME_REQUIRED };
  } else {
    const values = checkedParticipant(form.name, form.email);
    if (values.message) return { kind: 'invalid', message: values.message };
    data.name = values.name;
    data.email = values.email;
  }
  if (form.exclusions !== undefined) data.exclusions = form.exclusions;
  if (form.participants !== undefined) data.participants = form.participants;
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  data.idToken = idToken;
  return listOr(await ask(backendUrl, 'updateParticipant', data, fetchFn));
}

async function removeParticipant(backendUrl, storage, groupId, number, fetchFn) {
  const idToken = sessionHelpers().storedToken(storage);
  if (!idToken) return { kind: 'signin', message: '' };
  const answer = await ask(
    backendUrl,
    'removeParticipant',
    { idToken: idToken, groupId: groupId, number: number },
    fetchFn,
  );
  return listOr(answer);
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

// The answer to a participant change: the group's new list, or why not.
function listOr(answer) {
  if (answer && answer.ok === true && Array.isArray(answer.participants)) {
    return { kind: 'saved', participants: answer.participants };
  }
  return refusal(answer, SAVE_FAILED);
}

// The trimmed name and email, or the message for the first bad one (name before email).
function checkedParticipant(rawName, rawEmail) {
  const name = trimmed(rawName);
  if (!name) return { message: NAME_REQUIRED };
  const email = trimmed(rawEmail);
  if (!EMAIL_FORMAT.test(email)) return { message: EMAIL_INVALID };
  return { name: name, email: email };
}

// Any answer that is not ok: a refused value, no such group, the sign-in, or a technical failure.
function refusal(answer, failureMessage) {
  const error = answer && answer.ok === false ? answer.error : null;
  if (Object.prototype.hasOwnProperty.call(VALUE_MESSAGES, error)) {
    return { kind: 'invalid', message: VALUE_MESSAGES[error] };
  }
  if (error === 'not_found') return { kind: 'notFound', message: GROUP_NOT_FOUND };
  if (error === 'locked') return { kind: 'locked', message: LIST_LOCKED };
  if (error === 'list_changed' || error === 'invalid_exclusions') {
    return { kind: 'listChanged', message: LIST_CHANGED };
  }
  if (error === 'participant_not_found') {
    return { kind: 'participantNotFound', message: PARTICIPANT_NOT_FOUND };
  }
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
    addParticipant,
    updateParticipant,
    removeParticipant,
    groupPageUrl,
    groupIdFrom,
  };
}
