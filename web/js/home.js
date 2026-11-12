/* global checkConnection, SANTANOEL_CONFIG */

// Home page: shows whether the backend is reachable.
document.addEventListener('DOMContentLoaded', async function () {
  const status = document.getElementById('server-status');
  status.textContent = 'Comprobando la conexión…';
  status.textContent = await checkConnection(SANTANOEL_CONFIG.backendUrl);
});
