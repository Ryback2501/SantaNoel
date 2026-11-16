/**
 * The group's two texts: the email text (the customizable message of the email) and the letter
 * text (the introduction above each participant's wishes). The caller has already checked the
 * Google sign-in; `email` is the organizer's verified email. Markers are never validated: they are
 * filled in when the text is used, and anything else stays as written.
 */

/* global myGroup, isLocked, refuse */

const GROUP_TEXT_KINDS = ['email', 'wishlist'];
const GROUP_TEXT_LIMIT = 5000;

/**
 * Saves one text. Checked in this order: the group is mine (`not_found`), it is not locked
 * (`locked`), the kind and the text are valid (`invalid_request`), the length (`text_too_long`).
 * Answers with the text as stored.
 */
function setGroupText(request, email, store) {
  const group = textRules().myGroup(request.groupId, email, store);
  if (!group) return textRules().refuse('not_found');
  if (textRules().isLocked(group)) return textRules().refuse('locked');
  if (GROUP_TEXT_KINDS.indexOf(request.kind) === -1 || typeof request.text !== 'string') {
    return textRules().refuse('invalid_request');
  }
  const text = cleanGroupText(request.text);
  if (text.length > GROUP_TEXT_LIMIT) return textRules().refuse('text_too_long');
  store.setGroupText(group.id, request.kind, text);
  return { ok: true, text: text };
}

/** Windows line breaks become "\n"; spaces and blank lines at the ends are removed. */
function cleanGroupText(text) {
  return text.replace(/\r\n?/g, '\n').replace(/^\s+|\s+$/g, '');
}

// In Apps Script every file shares one global scope; the Node tests load groups.js with require.
function textRules() {
  return typeof module !== 'undefined'
    ? require('./groups.js')
    : { myGroup: myGroup, isLocked: isLocked, refuse: refuse };
}

if (typeof module !== 'undefined') {
  module.exports = { setGroupText };
}
