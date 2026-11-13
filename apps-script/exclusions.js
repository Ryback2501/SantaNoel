/**
 * The Exclusions cell of a participant: the numbers of the participants they will not give a
 * present to, separated by commas, ascending, no spaces ("1,3,5"), or empty when there are none.
 * The column is plain text, so Sheets never turns "1,3" into a number or a date.
 */

/** "1,3" → [1, 3]. Anything that is not a participant number (a whole number from 1) is skipped. */
function parseExclusions(cell) {
  return String(cell === undefined || cell === null ? '' : cell)
    .split(',')
    .map(function (part) {
      return part.trim() === '' ? NaN : Number(part);
    })
    .filter(function (number) {
      return Number.isInteger(number) && number > 0;
    });
}

/** [3, 1] → "1,3": ascending, no spaces; [] → "". */
function formatExclusions(numbers) {
  return numbers
    .slice()
    .sort(function (a, b) {
      return a - b;
    })
    .join(',');
}

if (typeof module !== 'undefined') {
  module.exports = { parseExclusions, formatExclusions };
}
