/**
 * Request handling for the backend web app.
 *
 * Every request is a POST whose body is a JSON object with an `action`. Nothing the client sends
 * is trusted: the body is parsed and checked here before any action runs.
 */

/* global authorizeOrganizer, listGroups, createGroup, getGroup, renameGroup, addParticipant,
   updateParticipant, removeParticipant */

const ACTIONS = {
  ping: function () {
    return { ok: true };
  },
  // Checks the organizer's Google sign-in; answers with their name and email.
  whoami: function (request, services) {
    return organizerCheck()(request.idToken, services);
  },
  // The organizer's groups (apps-script/groups.js). Saves run inside the lock.
  listGroups: asOrganizer(function (request, email, services) {
    return groupActions().listGroups(email, services.store());
  }),
  createGroup: asOrganizer(function (request, email, services) {
    return services.withLock(function () {
      return groupActions().createGroup(request, email, services.store(), services);
    });
  }),
  getGroup: asOrganizer(function (request, email, services) {
    return groupActions().getGroup(request, email, services.store());
  }),
  renameGroup: asOrganizer(function (request, email, services) {
    return services.withLock(function () {
      return groupActions().renameGroup(request, email, services.store());
    });
  }),
  // The participants of the organizer's group (apps-script/participants.js), all inside the lock.
  addParticipant: asOrganizer(function (request, email, services) {
    return services.withLock(function () {
      return participantActions().addParticipant(request, email, services.store());
    });
  }),
  updateParticipant: asOrganizer(function (request, email, services) {
    return services.withLock(function () {
      return participantActions().updateParticipant(request, email, services.store());
    });
  }),
  removeParticipant: asOrganizer(function (request, email, services) {
    return services.withLock(function () {
      return participantActions().removeParticipant(request, email, services.store());
    });
  }),
};

// Runs `action` only for a signed-in organizer, with their verified email; otherwise answers
// with the refusal of the sign-in check, before anything is read or saved.
function asOrganizer(action) {
  return function (request, services) {
    const organizer = organizerCheck()(request.idToken, services);
    if (!organizer.ok) return organizer;
    return action(request, organizer.email, services);
  };
}

// In Apps Script every file shares one global scope; the Node tests load auth.js with require.
function organizerCheck() {
  return typeof module !== 'undefined'
    ? require('./auth.js').authorizeOrganizer
    : authorizeOrganizer;
}

function participantActions() {
  return typeof module !== 'undefined'
    ? require('./participants.js')
    : {
        addParticipant: addParticipant,
        updateParticipant: updateParticipant,
        removeParticipant: removeParticipant,
      };
}

function groupActions() {
  return typeof module !== 'undefined'
    ? require('./groups.js')
    : {
        listGroups: listGroups,
        createGroup: createGroup,
        getGroup: getGroup,
        renameGroup: renameGroup,
      };
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
