/* global checkConnection, startSession, resumeSession, endSession, SIGN_IN_FAILED, SANTANOEL_CONFIG */

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
        try {
          show(await startSession(backendUrl, response.credential, sessionStorage));
        } catch {
          // The browser blocks this site's storage: the session cannot be kept.
          show({ signedIn: false, message: SIGN_IN_FAILED });
        }
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
    try {
      endSession(sessionStorage);
    } catch {
      // Storage blocked: there is no stored token to forget.
    }
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

  // The two checks are independent: each shows its own part as soon as it is ready.
  status.textContent = 'Comprobando la conexión…';
  checkConnection(backendUrl).then(function (connection) {
    status.textContent = connection;
  });
  try {
    show(await resumeSession(backendUrl, sessionStorage));
  } catch {
    // Storage blocked: nothing stored, so show the sign-in button.
    show({ signedIn: false, message: '' });
  }
});
