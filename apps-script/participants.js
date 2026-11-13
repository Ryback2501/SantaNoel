/**
 * The participants of an organizer's group. The caller has already checked the Google sign-in;
 * `email` is the organizer's verified email. Every change is checked in this order: the group is
 * mine (else `not_found`), it is not locked by the draw (`locked`), the participant exists
 * (`participant_not_found`), then the values: name before email.
 *
 * A successful change answers with the group's whole list, `{ ok, participants }`, so the page
 * can show it without asking again. `store` is the spreadsheet or a stand-in in the tests.
 */

/* global myGroup, isLocked, cleanText, sameText, refuse */

// something@something.tld: one @, no spaces, and a dot in the part after the @.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function addParticipant(request, email, store) {
  const group = unlockedGroup(request.groupId, email, store);
  if (group.refusal) return group.refusal;
  const values = checkedValues(request.name, request.email);
  if (values.refusal) return values.refusal;

  const members = participantsOf(group.id, store);
  if (usesEmail(members, values.email, null)) return rules().refuse('duplicate_email');
  const number =
    members.reduce(function (highest, participant) {
      return Math.max(highest, participant.number);
    }, 0) + 1;
  store.addParticipant({
    groupId: group.id,
    number: number,
    name: values.name,
    email: values.email,
  });
  return listAnswer(group.id, store);
}

function updateParticipant(request, email, store) {
  const group = unlockedGroup(request.groupId, email, store);
  if (group.refusal) return group.refusal;
  const members = participantsOf(group.id, store);
  const member = findMember(members, request.number);
  if (!member) return rules().refuse('participant_not_found');

  if (member.number === 1) {
    // The organizer: only the name changes; their email is their Google account.
    const name = rules().cleanText(request.name);
    if (!name) return rules().refuse('name_required');
    if (request.email !== undefined && !rules().sameText(String(request.email), member.email)) {
      return rules().refuse('cannot_change_organizer_email');
    }
    store.updateParticipant(group.id, 1, { name: name });
    return listAnswer(group.id, store);
  }

  const values = checkedValues(request.name, request.email);
  if (values.refusal) return values.refusal;
  if (usesEmail(members, values.email, member.number)) return rules().refuse('duplicate_email');
  store.updateParticipant(group.id, member.number, { name: values.name, email: values.email });
  return listAnswer(group.id, store);
}

/**
 * Deletes the participant's row, moves everyone after them down one number, and rewrites every
 * Exclusions value of the group to match: the removed number is dropped, higher ones shift down.
 */
function removeParticipant(request, email, store) {
  const group = unlockedGroup(request.groupId, email, store);
  if (group.refusal) return group.refusal;
  const members = participantsOf(group.id, store);
  const member = findMember(members, request.number);
  if (!member) return rules().refuse('participant_not_found');
  if (member.number === 1) return rules().refuse('cannot_remove_organizer');

  const removed = member.number;
  store.deleteParticipant(group.id, removed);
  // In number order, so each new number is free by the time it is written.
  members.forEach(function (participant) {
    if (participant.number === removed) return;
    const changes = {};
    if (participant.number > removed) changes.number = participant.number - 1;
    const exclusions = shiftedExclusions(participant.exclusions, removed);
    if (exclusions !== String(participant.exclusions || '')) changes.exclusions = exclusions;
    if (Object.keys(changes).length) store.updateParticipant(group.id, participant.number, changes);
  });
  return listAnswer(group.id, store);
}

/** "2,3,5" without `removed`, and with every higher number one lower. */
function shiftedExclusions(exclusions, removed) {
  return String(exclusions || '')
    .split(',')
    .map(function (part) {
      return Number(part.trim());
    })
    .filter(function (number) {
      return isParticipantNumber(number) && number !== removed;
    })
    .map(function (number) {
      return number > removed ? number - 1 : number;
    })
    .join(',');
}

function isParticipantNumber(number) {
  return Number.isInteger(number) && number > 0;
}

// The organizer's group, if it exists, is theirs and is not locked; otherwise `{ refusal }`.
function unlockedGroup(groupId, email, store) {
  const group = rules().myGroup(groupId, email, store);
  if (!group) return { refusal: rules().refuse('not_found') };
  if (rules().isLocked(group)) return { refusal: rules().refuse('locked') };
  return group;
}

// The trimmed name and email, or `{ refusal }` for the first bad one (name before email).
function checkedValues(rawName, rawEmail) {
  const name = rules().cleanText(rawName);
  if (!name) return { refusal: rules().refuse('name_required') };
  const email = rules().cleanText(rawEmail);
  if (!EMAIL_FORMAT.test(email)) return { refusal: rules().refuse('email_invalid') };
  return { name: name, email: email };
}

// True when a participant other than number `exceptNumber` already has this email.
function usesEmail(members, email, exceptNumber) {
  return members.some(function (participant) {
    return participant.number !== exceptNumber && rules().sameText(participant.email, email);
  });
}

function findMember(members, number) {
  if (typeof number !== 'number') return null;
  return (
    members.find(function (participant) {
      return participant.number === number;
    }) || null
  );
}

// The group's participants, in number order.
function participantsOf(groupId, store) {
  return store
    .readParticipants()
    .filter(function (participant) {
      return participant.groupId === groupId;
    })
    .sort(function (a, b) {
      return a.number - b.number;
    });
}

function listAnswer(groupId, store) {
  return {
    ok: true,
    participants: participantsOf(groupId, store).map(function (participant) {
      return { number: participant.number, name: participant.name, email: participant.email };
    }),
  };
}

// In Apps Script every file shares one global scope; the Node tests load groups.js with require.
function rules() {
  return typeof module !== 'undefined'
    ? require('./groups.js')
    : {
        myGroup: myGroup,
        isLocked: isLocked,
        cleanText: cleanText,
        sameText: sameText,
        refuse: refuse,
      };
}

if (typeof module !== 'undefined') {
  module.exports = { addParticipant, updateParticipant, removeParticipant };
}
