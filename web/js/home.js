/* global checkConnection, startSession, resumeSession, endSession, SANTANOEL_CONFIG */

// Home page: the connection status, and the organizer's sign-in with Google.
document.addEventListener('DOMContentLoaded', async function () {
  const status = document.getElementById('server-status');
  const signinArea = document.getElementById('signin-area');
  const signinMessage = document.getElementById('signin-message');
  const organizerArea = document.getElementById('organizer-area');
  const greeting = document.getElementById('greeting');
  const backendUrl = SANTANOEL_CONFIG.backendUrl;

  function show(view) {
    organizerArea.hidden = !view.signedIn;
    signinArea.hidden = view.signedIn;
    greeting.textContent = view.signedIn ? view.greeting : '';
    signinMessage.textContent = view.signedIn ? '' : view.message;
  }

  function setUpGoogleButton() {
    if (!SANTANOEL_CONFIG.googleClientId) {
      console.warn('googleClientId is empty in config.js: the sign-in button cannot be shown.');
      return;
    }
    google.accounts.id.initialize({
      client_id: SANTANOEL_CONFIG.googleClientId,
      // Never sign in by itself: only when the organizer clicks the button.
      auto_select: false,
      callback: async function (response) {
        show(await startSession(backendUrl, response.credential, sessionStorage));
      },
    });
    google.accounts.id.renderButton(document.getElementById('signin-button'), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      locale: 'es',
    });
  }

  document.getElementById('signout-button').addEventListener('click', function () {
    endSession(sessionStorage);
    if (window.google && google.accounts) {
      google.accounts.id.disableAutoSelect();
    }
    show({ signedIn: false, message: '' });
  });

  // Google's script loads on its own (async): set the button up now or when it arrives.
  if (window.google && google.accounts) {
    setUpGoogleButton();
  } else {
    window.onGoogleLibraryLoad = setUpGoogleButton;
  }

  status.textContent = 'Comprobando la conexión…';
  const [view, connection] = await Promise.all([
    resumeSession(backendUrl, sessionStorage),
    checkConnection(backendUrl),
  ]);
  show(view);
  status.textContent = connection;
});
