/* global SANTANOEL_CONFIG, loadGroup, renameGroup, groupIdFrom, LOAD_FAILED, SAVE_FAILED */

// A group's page (group.html?id=<Group ID>): its name, "Cambiar nombre", and its participants.
document.addEventListener('DOMContentLoaded', async function () {
  const backendUrl = SANTANOEL_CONFIG.backendUrl;
  const groupId = groupIdFrom(window.location.search);
  const pageMessage = document.getElementById('page-message');
  const content = document.getElementById('group-content');
  const title = document.getElementById('group-title');
  const participants = document.getElementById('participants');
  const renameButton = document.getElementById('rename-button');
  const renameForm = document.getElementById('rename-form');
  const renameField = document.getElementById('rename-name');
  const renameMessage = document.getElementById('rename-message');

  // Not signed in, or the session ended: the home page shows the sign-in (and why, if it expired).
  function goToSignIn() {
    window.location.replace('index.html');
  }

  // "No se encontró el grupo" or a loading failure: the message and nothing of the group.
  function showOnlyMessage(message) {
    content.hidden = true;
    pageMessage.textContent = message;
  }

  function showGroup(group) {
    title.textContent = group.name;
    participants.textContent = '';
    group.participants.forEach(function (participant) {
      const item = document.createElement('li');
      item.textContent = participant.name + ' · ' + participant.email;
      participants.appendChild(item);
    });
    pageMessage.textContent = '';
    content.hidden = false;
  }

  function closeRenameForm() {
    renameForm.hidden = true;
    renameMessage.textContent = '';
    renameButton.hidden = false;
  }

  renameButton.addEventListener('click', function () {
    renameField.value = title.textContent;
    renameButton.hidden = true;
    renameForm.hidden = false;
    renameField.focus();
  });

  document.getElementById('rename-cancel').addEventListener('click', closeRenameForm);

  renameForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const saveButton = renameForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    renameMessage.textContent = '';
    let view;
    try {
      view = await renameGroup(backendUrl, sessionStorage, groupId, renameField.value);
    } catch {
      view = { kind: 'error', message: SAVE_FAILED };
    }
    saveButton.disabled = false;
    if (view.kind === 'signin') return goToSignIn();
    if (view.kind === 'notFound') return showOnlyMessage(view.message);
    if (view.kind !== 'saved') {
      // The form keeps what was typed, so it can be fixed and saved again.
      renameMessage.textContent = view.message;
      return;
    }
    title.textContent = view.group.name;
    closeRenameForm();
  });

  let view;
  try {
    view = await loadGroup(backendUrl, sessionStorage, groupId);
  } catch {
    view = { kind: 'error', message: LOAD_FAILED };
  }
  if (view.kind === 'signin') return goToSignIn();
  if (view.kind === 'group') return showGroup(view.group);
  // Not found, or a loading failure: reloading the page tries again.
  showOnlyMessage(view.message);
});
