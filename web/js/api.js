/**
 * Talks to the backend (the Apps Script web app).
 *
 * Every request is a POST with `Content-Type: text/plain` and a JSON body: a "simple" request,
 * so the browser sends no CORS preflight, which Apps Script cannot answer.
 */

const CONNECTED_MESSAGE = 'Conectado con el servidor';
const DISCONNECTED_MESSAGE = 'No se puede conectar con el servidor';

async function callBackend(backendUrl, action, data, fetchFn) {
  const send = fetchFn || fetch;
  const response = await send(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({}, data, { action: action })),
  });
  if (!response.ok) {
    throw new Error('The backend answered with an HTTP error');
  }
  return response.json();
}

async function checkConnection(backendUrl, fetchFn) {
  try {
    const answer = await callBackend(backendUrl, 'ping', {}, fetchFn);
    return answer && answer.ok === true ? CONNECTED_MESSAGE : DISCONNECTED_MESSAGE;
  } catch {
    return DISCONNECTED_MESSAGE;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { callBackend, checkConnection };
}
