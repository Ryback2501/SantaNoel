/* global SANTANOEL_CONFIG, loadGroup, renameGroup, groupIdFrom, addParticipant, updateParticipant,
   removeParticipant, LOAD_FAILED, SAVE_FAILED, LIST_LOCKED, createWaitLayer, pageWaitView,
   WAIT_TEXTS, exclusionsSummary, exclusionsLine, exclusionOptions */

// A group's page (group.html?id=<Group ID>): its name, "Cambiar nombre", and its participants.
document.addEventListener('DOMContentLoaded', async function () {
  const backendUrl = SANTANOEL_CONFIG.backendUrl;
  const groupId = groupIdFrom(window.location.search);
  const pageMessage = document.getElementById('page-message');
  const content = document.getElementById('group-content');
  const title = document.getElementById('group-title');
  const renameButton = document.getElementById('rename-button');
  const renameForm = document.getElementById('rename-form');
  const renameField = document.getElementById('rename-name');
  const renameMessage = document.getElementById('rename-message');
  const lockMessage = document.getElementById('lock-message');
  const list = document.getElementById('participants');
  const listMessage = document.getElementById('participants-message');
  const addButton = document.getElementById('add-participant-button');
  const addForm = document.getElementById('add-participant-form');
  const addName = document.getElementById('participant-name');
  const addEmail = document.getElementById('participant-email');
  const addMessage = document.getElementById('add-participant-message');
  const rowTemplate = document.getElementById('participant-row-template');

  // Every wait on the server blocks the page; it has been blocked since it loaded (group.html).
  const waits = createWaitLayer(
    pageWaitView(
      document.getElementById('wait-layer'),
      document.getElementById('wait-text'),
      document.querySelector('main'),
    ),
  );

  let locked = false;
  let shownParticipants = []; // the list as shown, for the exclusions and the "list changed" check

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
    locked = group.locked === true;
    lockMessage.textContent = locked ? LIST_LOCKED : '';
    showParticipants(group.participants);
    pageMessage.textContent = '';
    content.hidden = false;
  }

  // Asks the server for the group: when the page opens, and again after a lock or a participant
  // that no longer exists. `previous` is the save's wait, still running: it ends only once this
  // wait has started, so the spinner never stops in between.
  async function reloadGroup(previous) {
    const loading = waits.start(WAIT_TEXTS.loadingGroup);
    if (previous) previous.end();
    let view;
    try {
      view = await loadGroup(backendUrl, sessionStorage, groupId);
    } catch {
      view = { kind: 'error', message: LOAD_FAILED };
    }
    loading.end();
    if (view.kind === 'signin') return goToSignIn();
    if (view.kind === 'group') return showGroup(view.group);
    showOnlyMessage(view.message);
  }

  // Only one form is open at a time: opening one closes the others and drops what was typed.
  function closeForms() {
    renameForm.hidden = true;
    renameMessage.textContent = '';
    renameButton.hidden = false;
    addForm.reset();
    addForm.hidden = true;
    addMessage.textContent = '';
    addButton.hidden = locked;
    listMessage.textContent = '';
    list.querySelectorAll('.participant').forEach(function (row) {
      row.querySelector('.edit-form').hidden = true;
      row.querySelector('.participant-buttons').hidden = locked;
      closeExclusions(row);
    });
  }

  // Closes a row's "Puede regalar a" list, keeping its ticks.
  function closeExclusions(row) {
    row.querySelector('.exclusions-panel').hidden = true;
    row.querySelector('.exclusions-toggle').setAttribute('aria-expanded', 'false');
  }

  // A click outside an open "Puede regalar a" field closes its list (the ticks stay).
  document.addEventListener('click', function (event) {
    list.querySelectorAll('.exclusions-field').forEach(function (field) {
      if (!field.contains(event.target)) closeExclusions(field.closest('.participant'));
    });
  });

  function showParticipants(participants) {
    shownParticipants = participants;
    list.textContent = '';
    participants.forEach(function (participant) {
      list.appendChild(participantRow(participant));
    });
    closeForms();
  }

  function participantRow(participant) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const isOrganizer = participant.number === 1;
    const form = row.querySelector('.edit-form');
    const nameField = row.querySelector('.edit-name');
    const emailField = row.querySelector('.edit-email');
    const message = row.querySelector('.edit-message');
    const excluded = participant.exclusions || [];
    row.querySelector('.participant-text').textContent =
      participant.number + '. ' + participant.name + ' · ' + participant.email;
    // Shown also when the list is locked: the only place the exclusions are seen then.
    row.querySelector('.participant-exclusions').textContent = exclusionsLine(
      shownParticipants,
      excluded,
    );
    const exclusions = exclusionsField(row, participant.number, excluded);
    // Participant 1 is the organizer: never removed, and their email is their Google account.
    if (isOrganizer) row.querySelector('.remove-button').remove();
    emailField.readOnly = isOrganizer;

    row.querySelector('.edit-button').addEventListener('click', function () {
      closeForms();
      nameField.value = participant.name;
      emailField.value = participant.email;
      exclusions.reset();
      row.querySelector('.participant-buttons').hidden = true;
      form.hidden = false;
      nameField.focus();
    });

    row.querySelector('.edit-cancel').addEventListener('click', closeForms);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const values = isOrganizer
        ? { name: nameField.value }
        : { name: nameField.value, email: emailField.value };
      values.exclusions = exclusions.excluded();
      values.participants = shownParticipants.map(function (shown) {
        return { number: shown.number, email: shown.email };
      });
      save(form, message, WAIT_TEXTS.savingParticipant, function () {
        return updateParticipant(backendUrl, sessionStorage, groupId, participant.number, values);
      });
    });

    const removeButton = row.querySelector('.remove-button');
    if (removeButton) {
      removeButton.addEventListener('click', function () {
        closeForms();
        // Nothing is blocked while the question is open: only once it is accepted.
        if (!window.confirm('¿Quitar a ' + participant.name + ' del grupo?')) return;
        save(null, listMessage, WAIT_TEXTS.removingParticipant(participant.name), function () {
          return removeParticipant(backendUrl, sessionStorage, groupId, participant.number);
        });
      });
    }
    return row;
  }

  // The "Puede regalar a" field of a row: a button that opens a list of tick boxes (ticked = can
  // give to). Changes stay in the form until "Guardar"; reset() puts back the saved state.
  function exclusionsField(row, number, savedExcluded) {
    const toggle = row.querySelector('.exclusions-toggle');
    const panel = row.querySelector('.exclusions-panel');
    const summary = row.querySelector('.exclusions-summary');
    const options = exclusionOptions(shownParticipants, number, savedExcluded);

    function excluded() {
      return Array.prototype.filter
        .call(panel.querySelectorAll('input[type="checkbox"]'), function (box) {
          return !box.checked;
        })
        .map(function (box) {
          return Number(box.value);
        });
    }

    function showSummary() {
      summary.textContent = exclusionsSummary(shownParticipants, excluded());
      toggle.setAttribute('aria-label', 'Puede regalar a: ' + summary.textContent);
    }

    function reset() {
      panel.textContent = '';
      options.forEach(function (option) {
        const label = document.createElement('label');
        label.className = 'exclusion-option';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = String(option.number);
        box.checked = option.ticked;
        box.addEventListener('change', showSummary);
        label.appendChild(box);
        label.appendChild(document.createTextNode(' ' + option.label));
        panel.appendChild(label);
      });
      // Alone in the group: nobody to choose, so the field cannot be opened.
      toggle.disabled = options.length === 0;
      closeExclusions(row);
      showSummary();
    }

    toggle.addEventListener('click', function () {
      const opening = panel.hidden;
      panel.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) {
        const first = panel.querySelector('input');
        if (first) first.focus();
      }
    });

    // Escape closes only the list (not the form), and the focus goes back to the button.
    row.querySelector('.exclusions-field').addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      closeExclusions(row);
      toggle.focus();
    });

    reset();
    return { reset: reset, excluded: excluded };
  }

  // Runs a participant change, blocking the page with `waitText`, and shows its answer. `form`
  // (null for a removal) keeps what was typed when the change is refused, so it can be fixed.
  async function save(form, message, waitText, change) {
    const saving = waits.start(waitText);
    const buttons = form ? form.querySelectorAll('button') : [];
    buttons.forEach(function (button) {
      button.disabled = true;
    });
    message.textContent = '';
    let view;
    try {
      view = await change();
    } catch {
      view = { kind: 'error', message: SAVE_FAILED };
    }
    buttons.forEach(function (button) {
      button.disabled = false;
    });
    if (
      view.kind === 'locked' ||
      view.kind === 'participantNotFound' ||
      view.kind === 'listChanged'
    ) {
      // The reload continues this wait.
      await reloadGroup(saving);
      // The lock message is already above the list after a lock; otherwise say what happened.
      if (view.kind !== 'locked') listMessage.textContent = view.message;
      return;
    }
    // Released first, so the page can take the focus again.
    saving.end();
    if (view.kind === 'signin') return goToSignIn();
    if (view.kind === 'notFound') return showOnlyMessage(view.message);
    if (view.kind === 'saved') return saved(form, view.participants);
    message.textContent = view.message;
  }

  function saved(form, participants) {
    showParticipants(participants);
    if (form === addForm) {
      // Stays open and empty, ready for the next person.
      addButton.hidden = true;
      addForm.hidden = false;
      addName.focus();
    }
  }

  renameButton.addEventListener('click', function () {
    closeForms();
    renameField.value = title.textContent;
    renameButton.hidden = true;
    renameForm.hidden = false;
    renameField.focus();
  });

  document.getElementById('rename-cancel').addEventListener('click', closeForms);

  renameForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const saveButton = renameForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    renameMessage.textContent = '';
    let view;
    const renaming = waits.start(WAIT_TEXTS.renamingGroup);
    try {
      view = await renameGroup(backendUrl, sessionStorage, groupId, renameField.value);
    } catch {
      view = { kind: 'error', message: SAVE_FAILED };
    } finally {
      renaming.end();
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
    closeForms();
  });

  addButton.addEventListener('click', function () {
    closeForms();
    addButton.hidden = true;
    addForm.hidden = false;
    addName.focus();
  });

  document.getElementById('add-participant-cancel').addEventListener('click', closeForms);

  addForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const values = { name: addName.value, email: addEmail.value };
    save(addForm, addMessage, WAIT_TEXTS.addingParticipant, function () {
      return addParticipant(backendUrl, sessionStorage, groupId, values);
    });
  });

  // Not found, or a loading failure: reloading the page tries again.
  await reloadGroup();
});
