/**
 * An organizer's groups. The caller has already checked the Google sign-in (apps-script/auth.js);
 * `email` is the organizer's verified email from it, never something the client sent.
 *
 * "My groups" are only the groups where I am participant 1. A group that does not exist and
 * another organizer's group get the same answer, `not_found`, so a group's existence is never
 * revealed.
 *
 * `store` is the spreadsheet (spreadsheetStore in sheets.js) or a stand-in in the tests.
 */

function listGroups(email, store) {
  const groups = myGroups(email, store).sort(function (a, b) {
    return timeOf(b.created) - timeOf(a.created) || b.position - a.position;
  });
  return {
    ok: true,
    groups: groups.map(function (group) {
      return { id: group.id, name: group.name };
    }),
  };
}

/** `services` gives `newId()` and `now()` (milliseconds). */
function createGroup(request, email, store, services) {
  const name = cleanText(request.name);
  if (!name) return refuse('group_name_required');
  const firstName = cleanText(request.firstName);
  if (!firstName) return refuse('first_name_required');
  if (hasGroupNamed(myGroups(email, store), name, null)) return refuse('duplicate_name');

  const id = services.newId();
  store.addGroup({ id: id, name: name, created: new Date(services.now()) });
  store.addParticipant({ groupId: id, number: 1, name: firstName, email: email });
  return { ok: true, group: { id: id, name: name } };
}

function getGroup(request, email, store) {
  const group = myGroup(request.groupId, email, store);
  if (!group) return refuse('not_found');
  const participants = store
    .readParticipants()
    .filter(function (participant) {
      return participant.groupId === group.id;
    })
    .sort(function (a, b) {
      return a.number - b.number;
    })
    .map(function (participant) {
      return { number: participant.number, name: participant.name, email: participant.email };
    });
  return { ok: true, group: { id: group.id, name: group.name, participants: participants } };
}

function renameGroup(request, email, store) {
  const mine = myGroups(email, store);
  const group = findGroup(mine, request.groupId);
  if (!group) return refuse('not_found');
  const name = cleanText(request.name);
  if (!name) return refuse('group_name_required');
  if (hasGroupNamed(mine, name, group.id)) return refuse('duplicate_name');

  store.renameGroup(group.id, name);
  return { ok: true, group: { id: group.id, name: name } };
}

// The groups where `email` is participant 1, each with its position in the sheet (for ties).
function myGroups(email, store) {
  const mine = {};
  store.readParticipants().forEach(function (participant) {
    if (participant.number === 1 && sameText(participant.email, email)) {
      mine[participant.groupId] = true;
    }
  });
  return store
    .readGroups()
    .map(function (group, position) {
      return { id: group.id, name: group.name, created: group.created, position: position };
    })
    .filter(function (group) {
      return mine[group.id] === true;
    });
}

function myGroup(groupId, email, store) {
  return findGroup(myGroups(email, store), groupId);
}

function findGroup(groups, groupId) {
  if (typeof groupId !== 'string') return null;
  return (
    groups.find(function (group) {
      return group.id === groupId;
    }) || null
  );
}

// True when one of `groups`, other than the one with `exceptId`, already has this name.
function hasGroupNamed(groups, name, exceptId) {
  return groups.some(function (group) {
    return group.id !== exceptId && sameText(group.name, name);
  });
}

// The text without the spaces at the ends; '' for anything that is not text.
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Equal ignoring upper/lower case and the spaces at the ends.
function sameText(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function timeOf(value) {
  const time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
}

function refuse(error) {
  return { ok: false, error: error };
}

if (typeof module !== 'undefined') {
  module.exports = { listGroups, createGroup, getGroup, renameGroup };
}
