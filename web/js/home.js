/* global checkConnection, startSession, resumeSession, endSession, SIGN_IN_FAILED, SANTANOEL_CONFIG,
   loadMyGroups, createGroup, groupPageUrl, LOAD_FAILED, SAVE_FAILED, createWaitLayer, pageWaitView,
   WAIT_TEXTS */

// Home page: the connection status, the organizer's sign-in with Google, and their groups.
document.addEventListener('DOMContentLoaded', async function () {
  const status = document.getElementById('server-status');
  const signinArea = document.getElementById('signin-area');
  const signinMessage = document.getElementById('signin-message');
  const organizerArea = document.getElementById('organizer-area');
  const greeting = document.getElementById('greeting');
  const groupsList = document.getElementById('groups-list');
  const groupsMessage = document.getElementById('groups-message');
  const createButton = document.getElementById('create-group-button');
  const createForm = document.getElementById('create-group-form');
  const createMessage = document.getElementById('create-group-message');
  const groupNameField = document.getElementById('group-name');
  const firstNameField = document.getElementById('first-name');
  const backendUrl = SANTANOEL_CONFIG.backendUrl;
  // Every wait on the server blocks the page (the connection check below does not).
  const waits = createWaitLayer(
    pageWaitView(
      document.getElementById('wait-layer'),
      document.getElementById('wait-text'),
      document.querySelector('main'),
    ),
  );

  function show(view) {
    organizerArea.hidden = !view.signedIn;
    signinArea.hidden = view.signedIn;
    greeting.textContent = view.signedIn ? view.greeting : '';
    signinMessage.textContent = view.signedIn ? '' : view.message;
    if (!view.signedIn) clearGroups();
  }

  // After the sign-in check (`checking`, the wait still running): signed in, show the greeting and
  // load the groups. The groups' wait starts before the check's ends, so the spinner never stops.
  async function showOrganizer(view, checking) {
    show(view);
    if (!view.signedIn) return checking.end();
    const loading = waits.start(WAIT_TEXTS.loadingGroups);
    checking.end();
    try {
      await showGroups();
    } finally {
      loading.end();
    }
  }

  // The server refused the sign-in (for example, it expired): back to the button, with its message.
  function backToSignIn(message) {
    try {
      endSession(sessionStorage);
    } catch {
      // Storage blocked: there is no stored token to forget.
    }
    show({ signedIn: false, message: message });
  }

  function clearGroups() {
    groupsList.textContent = '';
    groupsMessage.textContent = '';
    createButton.hidden = true;
    closeCreateForm();
  }

  function addGroupLink(group, atTop) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = group.url;
    link.textContent = group.name;
    item.appendChild(link);
    groupsList.insertBefore(item, atTop ? groupsList.firstChild : null);
  }

  async function showGroups() {
    clearGroups();
    let view;
    try {
      view = await loadMyGroups(backendUrl, sessionStorage);
    } catch {
      view = { kind: 'error', message: LOAD_FAILED };
    }
    if (view.kind === 'signin') return backToSignIn(view.message);
    if (view.kind !== 'list') {
      // Nothing else of the list: reloading the page tries again.
      groupsMessage.textContent = view.message;
      return;
    }
    view.groups.forEach(function (group) {
      addGroupLink(group, false);
    });
    groupsMessage.textContent = view.message;
    createButton.hidden = false;
  }

  function closeCreateForm() {
    createForm.reset();
    createForm.hidden = true;
    createMessage.textContent = '';
  }

  createButton.addEventListener('click', function () {
    createButton.hidden = true;
    createForm.hidden = false;
    groupNameField.focus();
  });

  document.getElementById('create-group-cancel').addEventListener('click', function () {
    closeCreateForm();
    createButton.hidden = false;
  });

  createForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const saveButton = createForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    createMessage.textContent = '';
    let view;
    const creating = waits.start(WAIT_TEXTS.creatingGroup);
    try {
      view = await createGroup(backendUrl, sessionStorage, {
        name: groupNameField.value,
        firstName: firstNameField.value,
      });
    } catch {
      view = { kind: 'error', message: SAVE_FAILED };
    } finally {
      creating.end();
    }
    saveButton.disabled = false;
    if (view.kind === 'signin') return backToSignIn(view.message);
    if (view.kind !== 'saved') {
      // The form keeps what was typed, so it can be fixed and saved again.
      createMessage.textContent = view.message;
      return;
    }
    // The newest group goes first, as in the list from the server.
    addGroupLink({ name: view.group.name, url: groupPageUrl(view.group.id) }, true);
    groupsMessage.textContent = '';
    closeCreateForm();
    createButton.hidden = false;
  });

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
        const checking = waits.start(WAIT_TEXTS.checkingSession);
        let view;
        try {
          view = await startSession(backendUrl, response.credential, sessionStorage);
        } catch {
          // The browser blocks this site's storage: the session cannot be kept.
          view = { signedIn: false, message: SIGN_IN_FAILED };
        }
        await showOrganizer(view, checking);
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
  // The page has been blocked since it loaded (see index.html); this wait takes over from there.
  const checking = waits.start(WAIT_TEXTS.checkingSession);
  let session;
  try {
    session = await resumeSession(backendUrl, sessionStorage);
  } catch {
    // Storage blocked: nothing stored, so show the sign-in button.
    session = { signedIn: false, message: '' };
  }
  await showOrganizer(session, checking);
});
