/**
 * The texts and the tick boxes of a participant's exclusions on the group page. `participants`
 * is the group's list ({ number, name, … }); `excluded` the numbers this participant will not
 * give a present to. Names go in number order (names can repeat; the tick boxes add the number).
 */

/** The closed "Puede regalar a" field: "Todos", or "Todos menos Ana, Marta". */
function exclusionsSummary(participants, excluded) {
  const names = excludedNames(participants, excluded);
  return names.length ? 'Todos menos ' + names.join(', ') : 'Todos';
}

/** The row's second line: "No regalará a: Ana, Marta", or '' when nobody is excluded. */
function exclusionsLine(participants, excluded) {
  const names = excludedNames(participants, excluded);
  return names.length ? 'No regalará a: ' + names.join(', ') : '';
}

/** One tick box per other participant: ticked means "can give to", so the excluded are unticked. */
function exclusionOptions(participants, number, excluded) {
  return inNumberOrder(participants)
    .filter(function (participant) {
      return participant.number !== number;
    })
    .map(function (participant) {
      return {
        number: participant.number,
        label: participant.number + '. ' + participant.name,
        ticked: excluded.indexOf(participant.number) === -1,
      };
    });
}

function excludedNames(participants, excluded) {
  return inNumberOrder(participants)
    .filter(function (participant) {
      return excluded.indexOf(participant.number) !== -1;
    })
    .map(function (participant) {
      return participant.name;
    });
}

function inNumberOrder(participants) {
  return participants.slice().sort(function (a, b) {
    return a.number - b.number;
  });
}

if (typeof module !== 'undefined') {
  module.exports = { exclusionsSummary, exclusionsLine, exclusionOptions };
}
