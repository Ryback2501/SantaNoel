/**
 * Sample of the pattern for Apps Script code that unit tests can load.
 *
 * Apps Script runs every file of the project in one shared global scope and has no module
 * system, so plain functions are simply declared here. The `module.exports` line at the end
 * only runs where `module` exists (Node / Vitest), never in Apps Script.
 */

function greet(name) {
  return 'Hola, ' + name;
}

if (typeof module !== 'undefined') {
  module.exports = { greet };
}
