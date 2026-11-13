// The blocking layer (web/js/waiting.js): every wait on the server blocks the page at once; after
// 300 ms a spinner shows with the text of the wait; the page is released only when the last wait
// ends, so waits that follow each other show one continuous spinner.
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createWaitLayer, WAIT_TEXTS } = require('../web/js/waiting.js');

// Records every state the layer asks the page to show.
function recordingView() {
  const states = [];
  return {
    states,
    render: (state) => states.push({ ...state }),
    last: () => states[states.length - 1],
    // How many times the spinner went from hidden to shown.
    spinnerStarts: () =>
      states.filter((state, i) => state.spinner && !(i > 0 && states[i - 1].spinner)).length,
  };
}

const FREE = { blocked: false, spinner: false, text: '' };

describe('the blocking layer (createWaitLayer)', () => {
  let view;
  let layer;

  beforeEach(() => {
    vi.useFakeTimers();
    view = recordingView();
    layer = createWaitLayer(view);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks the page at once when a wait starts, with no spinner and no text yet', () => {
    layer.start('Cargando el grupo…');
    expect(view.last()).toEqual({ blocked: true, spinner: false, text: '' });
  });

  it('shows the spinner with its text after 300 ms, not before', () => {
    layer.start('Cargando el grupo…');
    vi.advanceTimersByTime(299);
    expect(view.last().spinner).toBe(false);
    vi.advanceTimersByTime(1);
    expect(view.last()).toEqual({ blocked: true, spinner: true, text: 'Cargando el grupo…' });
  });

  it('never shows the spinner for a wait that ends within 300 ms', () => {
    const wait = layer.start('Guardando los cambios…');
    vi.advanceTimersByTime(150);
    wait.end();
    vi.advanceTimersByTime(1000);
    expect(view.last()).toEqual(FREE);
    expect(view.spinnerStarts()).toBe(0);
  });

  it('releases the page, spinner and text included, when the wait ends', () => {
    const wait = layer.start('Creando el grupo…');
    vi.advanceTimersByTime(500);
    wait.end();
    expect(view.last()).toEqual(FREE);
  });

  it('shows the text only together with the spinner, never alone', () => {
    const first = layer.start('Comprobando tu sesión…');
    vi.advanceTimersByTime(100);
    const second = layer.start('Cargando tus grupos…');
    first.end();
    vi.advanceTimersByTime(400);
    second.end();
    view.states.forEach((state) => {
      if (state.text) expect(state.spinner).toBe(true);
    });
  });

  it('keeps one continuous spinner when the next wait starts before the previous one ends', () => {
    const checking = layer.start('Comprobando tu sesión…');
    vi.advanceTimersByTime(500);
    const loading = layer.start('Cargando tus grupos…');
    checking.end();
    expect(view.last()).toEqual({ blocked: true, spinner: true, text: 'Cargando tus grupos…' });
    vi.advanceTimersByTime(500);
    loading.end();
    expect(view.spinnerStarts()).toBe(1);
    expect(view.states.filter((state) => !state.blocked)).toEqual([FREE]);
  });

  it('counts the 300 ms from the first wait, showing the text of the latest one', () => {
    const checking = layer.start('Comprobando tu sesión…');
    vi.advanceTimersByTime(200);
    layer.start('Cargando tus grupos…');
    checking.end();
    vi.advanceTimersByTime(100);
    expect(view.last()).toEqual({ blocked: true, spinner: true, text: 'Cargando tus grupos…' });
  });

  it('shows the text of the wait that started last among those still running', () => {
    const saving = layer.start('Añadiendo participante…');
    const reloading = layer.start('Cargando el grupo…');
    vi.advanceTimersByTime(300);
    expect(view.last().text).toBe('Cargando el grupo…');
    reloading.end();
    expect(view.last()).toEqual({ blocked: true, spinner: true, text: 'Añadiendo participante…' });
    saving.end();
    expect(view.last()).toEqual(FREE);
  });

  it('does nothing more when the same wait is ended twice', () => {
    const first = layer.start('Cargando el grupo…');
    const second = layer.start('Cambiando el nombre…');
    first.end();
    first.end();
    expect(view.last().blocked).toBe(true);
    second.end();
    expect(view.last()).toEqual(FREE);
  });

  it('waits 300 ms again for a new wait after the page was released', () => {
    const first = layer.start('Cargando el grupo…');
    vi.advanceTimersByTime(400);
    first.end();
    layer.start('Cambiando el nombre…');
    vi.advanceTimersByTime(299);
    expect(view.last()).toEqual({ blocked: true, spinner: false, text: '' });
    vi.advanceTimersByTime(1);
    expect(view.last()).toEqual({ blocked: true, spinner: true, text: 'Cambiando el nombre…' });
  });

  it('leaves no timer behind once the page is released', () => {
    layer.start('Cargando el grupo…').end();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the texts below the spinner (WAIT_TEXTS)', () => {
  it.each([
    ['checkingSession', 'Comprobando tu sesión…'],
    ['loadingGroups', 'Cargando tus grupos…'],
    ['loadingGroup', 'Cargando el grupo…'],
    ['creatingGroup', 'Creando el grupo…'],
    ['renamingGroup', 'Cambiando el nombre…'],
    ['addingParticipant', 'Añadiendo participante…'],
    ['savingParticipant', 'Guardando los cambios…'],
  ])('%s is "%s"', (key, text) => {
    expect(WAIT_TEXTS[key]).toBe(text);
  });

  it('names the participant being removed: "Quitando a <name>…"', () => {
    expect(WAIT_TEXTS.removingParticipant('Luis')).toBe('Quitando a Luis…');
  });
});
