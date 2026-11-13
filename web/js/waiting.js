/**
 * The blocking layer: while the page waits for the server, nothing on it can be used.
 *
 * Every wait blocks the page at once. After 300 ms a spinner shows, with the text of the wait
 * that started last among those still running. The page is released only when the last wait
 * ends, so a wait that starts before the previous one ends (checking the sign-in, then loading
 * the groups) shows one continuous spinner whose text changes.
 *
 * The layer only decides what to show; `view.render({ blocked, spinner, text })` shows it.
 */

const SPINNER_DELAY_MS = 300;

// The text below the spinner, for each wait.
const WAIT_TEXTS = {
  checkingSession: 'Comprobando tu sesión…',
  loadingGroups: 'Cargando tus grupos…',
  loadingGroup: 'Cargando el grupo…',
  creatingGroup: 'Creando el grupo…',
  renamingGroup: 'Cambiando el nombre…',
  addingParticipant: 'Añadiendo participante…',
  savingParticipant: 'Guardando los cambios…',
  removingParticipant: function (name) {
    return 'Quitando a ' + name + '…';
  },
};

function createWaitLayer(view) {
  const running = []; // the texts of the waits still running, oldest first
  let spinnerShown = false;
  let spinnerTimer = null;

  function render() {
    const blocked = running.length > 0;
    view.render({
      blocked: blocked,
      spinner: blocked && spinnerShown,
      text: blocked && spinnerShown ? running[running.length - 1].text : '',
    });
  }

  function start(text) {
    const wait = { text: text };
    running.push(wait);
    if (running.length === 1) {
      spinnerTimer = setTimeout(function () {
        spinnerTimer = null;
        spinnerShown = true;
        render();
      }, SPINNER_DELAY_MS);
    }
    render();
    return {
      end: function () {
        const index = running.indexOf(wait);
        if (index === -1) return; // already ended
        running.splice(index, 1);
        if (running.length === 0) {
          clearTimeout(spinnerTimer);
          spinnerTimer = null;
          spinnerShown = false;
        }
        render();
      },
    };
  }

  return { start: start };
}

/**
 * Shows the layer's state on a page: `layer` (the #wait-layer element), `text` (its status text)
 * and `content` (the page's <main>, made inert while blocked). The focus leaves the page while it
 * is blocked and comes back where it was.
 */
function pageWaitView(layer, text, content) {
  let focused = null;
  return {
    render: function (state) {
      if (state.blocked && !content.inert) {
        focused = document.activeElement;
        if (focused && typeof focused.blur === 'function') focused.blur();
      }
      content.inert = state.blocked;
      layer.hidden = !state.blocked;
      layer.classList.toggle('is-visible', state.spinner);
      // Set only with the spinner, so screen readers announce it then, and on every change.
      if (text.textContent !== state.text) text.textContent = state.text;
      if (!state.blocked && focused) {
        if (focused.isConnected && typeof focused.focus === 'function') focused.focus();
        focused = null;
      }
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createWaitLayer, WAIT_TEXTS };
}
