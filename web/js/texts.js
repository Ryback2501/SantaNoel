/**
 * The group's two texts. The email text can use two markers, `{{name}}` (the participant receiving
 * the email) and `{{group}}` (the group's name), in any upper or lower case; anything else stays as
 * written. The letter text has no markers: it is shown exactly as written.
 * An empty text means the default one.
 */

const DEFAULT_EMAIL_TEXT =
  '¡Hola, {{name}}!\n\n' +
  'Ya se ha hecho el sorteo del amigo invisible «{{group}}».\n\n' +
  'En tu enlace personal puedes ver a quién te ha tocado, leer su carta a los Reyes Magos y ' +
  'escribir la tuya:';

const DEFAULT_LETTER_TEXT =
  'Queridos Reyes Magos:\n\nEste año me he portado muy bien, así que os pido:';

/**
 * The text split into pieces, each `{ text, value }`: `value` is true for a filled-in marker, so
 * the preview can highlight it. One pass: a filled-in value is never scanned again.
 */
function markerPieces(text, values) {
  const markers = /\{\{(name|group)\}\}/gi;
  const pieces = [];
  let from = 0;
  let match;
  while ((match = markers.exec(text)) !== null) {
    if (match.index > from) pieces.push({ text: text.slice(from, match.index), value: false });
    pieces.push({ text: String(values[match[1].toLowerCase()]), value: true });
    from = markers.lastIndex;
  }
  if (from < text.length) pieces.push({ text: text.slice(from), value: false });
  return pieces.filter(function (piece) {
    return piece.text !== '';
  });
}

/** The text with its markers filled in. */
function fillMarkers(text, values) {
  return markerPieces(text, values)
    .map(function (piece) {
      return piece.text;
    })
    .join('');
}

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_EMAIL_TEXT,
    DEFAULT_LETTER_TEXT,
    markerPieces,
    fillMarkers,
  };
}
