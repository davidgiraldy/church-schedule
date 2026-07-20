let currentScheduleId = null;
let currentDressCodePath = null;
let removeDressCodeFlag = false;
let editingAssignments = [];
let assignmentsEditMode = false;
let assignmentsSortable = null;
let allSchedules = [];
let knownPeople = [];
let currentView = "schedule";
let peopleSearch = "";
let filterMode = "upcoming";
let filterFrom = null;
let filterTo = null;
let filterYear = null;
let filterMonth = null;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

document.addEventListener("DOMContentLoaded", () => {
  loadSchedules();

  document.getElementById("btn-new-schedule").addEventListener("click", () => openModal());
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("service-date").addEventListener("input", checkDuplicateDate);
  document.getElementById("btn-add-time").addEventListener("click", () => addTimeRow());
  document.getElementById("btn-add-role").addEventListener("click", () => {
    editingAssignments.push({ role_group: "", role: "", person_name: "" });
    renderAssignmentsEditor();
  });
  document.getElementById("btn-toggle-role-edit").addEventListener("click", () => {
    assignmentsEditMode = !assignmentsEditMode;
    renderAssignmentsEditor();
  });
  document.getElementById("schedule-form").addEventListener("submit", handleSubmit);
  document.getElementById("btn-delete-schedule").addEventListener("click", handleDelete);

  document.getElementById("dress-code-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    removeDressCodeFlag = false;
    const preview = document.getElementById("dress-code-preview");
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    document.getElementById("btn-remove-dresscode").classList.remove("hidden");
  });
  document.getElementById("btn-remove-dresscode").addEventListener("click", () => {
    removeDressCodeFlag = true;
    document.getElementById("dress-code-file").value = "";
    document.getElementById("dress-code-preview").classList.add("hidden");
    document.getElementById("btn-remove-dresscode").classList.add("hidden");
  });

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => setFilterMode(tab.dataset.mode));
  });
  document.getElementById("btn-apply-filter").addEventListener("click", () => {
    filterFrom = document.getElementById("filter-from").value || null;
    filterTo = document.getElementById("filter-to").value || null;
    renderFiltered();
  });
  document.getElementById("btn-clear-filter").addEventListener("click", () => {
    filterFrom = null;
    filterTo = null;
    document.getElementById("filter-from").value = "";
    document.getElementById("filter-to").value = "";
    renderFiltered();
  });

  document.getElementById("filter-month-select").addEventListener("change", (e) => {
    filterMonth = e.target.value;
    renderFiltered();
  });
  document.getElementById("filter-year-select").addEventListener("change", (e) => {
    filterYear = e.target.value;
    renderFiltered();
  });

  document.getElementById("btn-view-people").addEventListener("click", () => {
    switchView(currentView === "people" ? "schedule" : "people");
  });
  document.getElementById("people-search").addEventListener("input", (e) => {
    peopleSearch = e.target.value.trim().toLowerCase();
    renderPeopleView();
  });
});

function setFilterMode(mode) {
  filterMode = mode;
  document.querySelectorAll(".filter-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  document.getElementById("custom-range").classList.toggle("hidden", mode !== "custom");
  document.getElementById("month-range").classList.toggle("hidden", mode !== "month");
  renderFiltered();
}

// Upcoming treats the current week's schedule as "done" once it's past noon on the
// service day, so it rolls over to next week's schedule instead of showing a stale one.
function upcomingCutoffDate() {
  const now = new Date();
  const base = now.getHours() >= 12
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function populateMonthYearOptions() {
  const now = new Date();
  const monthSelect = document.getElementById("filter-month-select");
  const yearSelect = document.getElementById("filter-year-select");

  if (!filterMonth) filterMonth = String(now.getMonth() + 1).padStart(2, "0");
  if (!filterYear) filterYear = String(now.getFullYear());

  monthSelect.innerHTML = MONTH_NAMES.map((name, i) => {
    const value = String(i + 1).padStart(2, "0");
    return `<option value="${value}">${name}</option>`;
  }).join("");
  monthSelect.value = filterMonth;

  const years = new Set(allSchedules.map((s) => s.service_date.slice(0, 4)));
  years.add(String(now.getFullYear()));
  const sortedYears = [...years].sort();
  yearSelect.innerHTML = sortedYears.map((y) => `<option value="${y}">${y}</option>`).join("");
  yearSelect.value = filterYear;
}

function renderFiltered() {
  let filtered;
  if (filterMode === "upcoming") {
    const cutoff = upcomingCutoffDate();
    filtered = allSchedules.filter((s) => s.service_date >= cutoff).sort((a, b) => a.service_date.localeCompare(b.service_date));
  } else if (filterMode === "custom") {
    filtered = allSchedules.filter((s) => {
      if (filterFrom && s.service_date < filterFrom) return false;
      if (filterTo && s.service_date > filterTo) return false;
      return true;
    }).sort((a, b) => a.service_date.localeCompare(b.service_date));
  } else if (filterMode === "month") {
    const prefix = `${filterYear}-${filterMonth}`;
    filtered = allSchedules.filter((s) => s.service_date.startsWith(prefix)).sort((a, b) => a.service_date.localeCompare(b.service_date));
  } else {
    filtered = [...allSchedules].sort((a, b) => b.service_date.localeCompare(a.service_date));
  }
  renderScheduleList(filtered);
}

async function loadSchedules() {
  const container = document.getElementById("schedule-list");
  try {
    allSchedules = await window.Api.listSchedules();
    populateMonthYearOptions();
    renderFiltered();
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load schedules: ${escapeHtml(err.message)}</p>`;
  }
  try {
    knownPeople = await window.Api.listPeople();
    populatePeopleDatalist();
  } catch (err) {
    // Non-critical: autocomplete just stays empty if this fails.
  }
}

function populatePeopleDatalist() {
  document.getElementById("people-datalist").innerHTML =
    knownPeople.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join("");
}

function switchView(view) {
  currentView = view;
  document.getElementById("filter-bar").classList.toggle("hidden", view !== "schedule");
  document.getElementById("schedule-list").classList.toggle("hidden", view !== "schedule");
  document.getElementById("people-view").classList.toggle("hidden", view !== "people");
  document.getElementById("btn-new-schedule").classList.toggle("hidden", view !== "schedule");
  document.getElementById("btn-view-people").textContent = view === "people" ? "Back to Schedule" : "People";
  if (view === "people") renderPeopleView();
}

// Every person's service history, derived straight from already-loaded schedule data —
// no extra query needed since the "people" table only exists to power autocomplete.
function renderPeopleView() {
  const container = document.getElementById("people-list");
  const statsMap = new Map();
  for (const s of allSchedules) {
    for (const a of s.schedule_assignments) {
      const name = (a.person_name || "").trim();
      if (!name || name === "-") continue;
      if (!statsMap.has(name)) statsMap.set(name, []);
      statsMap.get(name).push({ date: s.service_date, role: a.role, role_group: a.role_group });
    }
  }

  const people = [...statsMap.entries()]
    .map(([name, entries]) => ({
      name,
      entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .filter((p) => !peopleSearch || p.name.toLowerCase().includes(peopleSearch))
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));

  if (!people.length) {
    container.innerHTML = `<p class="empty">${statsMap.size ? "No names match your search." : "No one has been assigned to a schedule yet."}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="people-list-card">
      ${people.map((p) => `
        <div class="person-row">
          <button type="button" class="person-row-toggle">
            <span class="person-row-name">${escapeHtml(p.name)}</span>
            <span class="person-row-meta">
              <span class="badge">${p.entries.length}×</span>
              <span class="expand-caret">&#9662;</span>
            </span>
          </button>
          <div class="person-row-details hidden">
            <ul>
              ${p.entries.map((e) => `
                <li><span class="role">${formatDate(e.date)}</span><span class="person">${escapeHtml(baseRoleLabel(e.role))}</span></li>
              `).join("")}
            </ul>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  container.querySelectorAll(".person-row-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("expanded");
      btn.nextElementSibling.classList.toggle("hidden");
    });
  });
}

function renderScheduleList(schedules) {
  const container = document.getElementById("schedule-list");
  if (!schedules.length) {
    const msg = allSchedules.length
      ? "No schedules match this filter."
      : 'No schedules yet. Click "+ Add Schedule" to get started.';
    container.innerHTML = `<p class="empty">${msg}</p>`;
    return;
  }

  container.innerHTML = schedules.map((s) => scheduleCardHtml(s)).join("");

  container.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const schedule = schedules.find((s) => s.id === btn.dataset.editId);
      openModal(schedule);
    });
  });

  container.querySelectorAll("[data-share-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const schedule = schedules.find((s) => s.id === btn.dataset.shareId);
      shareSchedule(schedule, btn);
    });
  });
}

function scheduleCardHtml(s) {
  const dateLabel = formatDate(s.service_date);
  const times = [...s.schedule_times].sort((a, b) => a.service_time.localeCompare(b.service_time));
  const timesHtml = times.map((t) => `<span class="badge">${formatTime(t.service_time)}${t.note ? " · " + escapeHtml(t.note) : ""}</span>`).join("");

  const groups = groupAssignmentsCompact(s.schedule_assignments);
  const groupCardsHtml = groups.map((g) => `
    <article class="group-card">
      <h4>${escapeHtml(g.group)}</h4>
      <ul>
        ${g.items.map((item) => {
          if (!item.names.length) {
            return `<li><span class="role">${escapeHtml(item.label)}</span><span class="person unset">-</span></li>`;
          }
          const linesHtml = item.names.map((n) => `<span class="person-line">${escapeHtml(n)}</span>`).join("");
          return `<li><span class="role">${escapeHtml(item.label)}</span><span class="person-list">${linesHtml}</span></li>`;
        }).join("")}
      </ul>
    </article>
  `).join("");

  const dressCodeImageHtml = s.dress_code_image_path ? `
    <article class="group-card dresscode-card">
      <h4>Dress Code</h4>
      <a href="${window.Api.getDressCodeUrl(s.dress_code_image_path)}" target="_blank" rel="noopener">
        <img src="${window.Api.getDressCodeUrl(s.dress_code_image_path)}" alt="Dress code for ${dateLabel}" />
      </a>
    </article>
  ` : "";

  const dressCodeNotesCardHtml = s.dress_code_notes ? `
    <article class="group-card">
      <h4>Dress Code Detail</h4>
      ${dressCodeNotesHtml(s.dress_code_notes)}
    </article>
  ` : "";

  return `
    <section class="schedule-block">
      <div class="schedule-header-card">
        <div>
          <h3>${dateLabel}</h3>
          ${s.label ? `<span class="label-tag">${escapeHtml(s.label)}</span>` : ""}
          <div class="times-row">${timesHtml || '<span class="badge muted">Time not set</span>'}</div>
        </div>
        <div class="header-right">
          <button class="btn btn-small" data-share-id="${s.id}">Share</button>
          <button class="btn btn-small" data-edit-id="${s.id}">Edit</button>
        </div>
      </div>
      <div class="group-cards">
        ${groupCardsHtml || '<p class="empty-small">No assignments yet.</p>'}
        ${dressCodeImageHtml}
        ${dressCodeNotesCardHtml}
      </div>
    </section>
  `;
}

// Roles like "Singer I", "Singer II" collapse into one "Singer" line joining the filled names,
// mirroring how the church's own printed schedule graphics present it.
function baseRoleLabel(role) {
  return role.replace(/\s+(I{1,3}|IV|VI{0,1}|IX|X)$/, "").trim();
}

function groupAssignmentsCompact(assignments) {
  const sorted = [...assignments].sort((a, b) => a.role_order - b.role_order);
  const groupMap = new Map();
  for (const a of sorted) {
    if (!groupMap.has(a.role_group)) groupMap.set(a.role_group, new Map());
    const baseMap = groupMap.get(a.role_group);
    const label = baseRoleLabel(a.role);
    if (!baseMap.has(label)) baseMap.set(label, { order: a.role_order, names: [] });
    if (a.person_name) baseMap.get(label).names.push(a.person_name);
  }
  return [...groupMap.entries()].map(([group, baseMap]) => ({
    group,
    items: [...baseMap.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([label, { names }]) => ({ label, names })),
  }));
}

// Groups a flat assignments array by role_group, preserving first-seen order.
function groupByRoleGroup(assignments) {
  const map = new Map();
  assignments.forEach((a, index) => {
    if (!map.has(a.role_group)) map.set(a.role_group, []);
    map.get(a.role_group).push({ ...a, index });
  });
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

function openModal(schedule = null) {
  currentScheduleId = schedule ? schedule.id : null;
  currentDressCodePath = schedule ? (schedule.dress_code_image_path || null) : null;
  removeDressCodeFlag = false;
  document.getElementById("modal-title").textContent = schedule ? "Edit Schedule" : "Add Schedule";
  document.getElementById("schedule-id").value = schedule ? schedule.id : "";
  document.getElementById("service-date").value = schedule ? schedule.service_date : "";
  document.getElementById("service-date").classList.remove("input-error");
  document.getElementById("date-error").classList.add("hidden");
  document.getElementById("schedule-label").value = schedule ? (schedule.label || "") : "";
  document.getElementById("btn-delete-schedule").classList.toggle("hidden", !schedule);

  document.getElementById("dress-code-notes").value = schedule ? (schedule.dress_code_notes || "") : "";

  document.getElementById("dress-code-file").value = "";
  const preview = document.getElementById("dress-code-preview");
  const removeBtn = document.getElementById("btn-remove-dresscode");
  if (currentDressCodePath) {
    preview.src = window.Api.getDressCodeUrl(currentDressCodePath);
    preview.classList.remove("hidden");
    removeBtn.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
    removeBtn.classList.add("hidden");
  }

  document.getElementById("times-list").innerHTML = "";
  if (schedule && schedule.schedule_times.length) {
    [...schedule.schedule_times]
      .sort((a, b) => a.service_time.localeCompare(b.service_time))
      .forEach((t) => addTimeRow(t.service_time, t.note));
  } else {
    addTimeRow("08:00");
    addTimeRow("10:00");
  }

  assignmentsEditMode = false;
  if (schedule && schedule.schedule_assignments.length) {
    editingAssignments = [...schedule.schedule_assignments]
      .sort((a, b) => a.role_order - b.role_order)
      .map((a) => ({ role_group: a.role_group, role: a.role, person_name: a.person_name || "" }));
  } else {
    editingAssignments = [];
    window.ROLE_TEMPLATE.forEach((g) => {
      g.roles.forEach((role) => editingAssignments.push({ role_group: g.group, role, person_name: "" }));
    });
  }
  renderAssignmentsEditor();

  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  currentScheduleId = null;
}

function addTimeRow(value = "", note = "") {
  const list = document.getElementById("times-list");
  const row = document.createElement("div");
  row.className = "time-row";
  row.innerHTML = `
    <input type="time" class="time-input" value="${value}" required />
    <input type="text" class="time-note-input" placeholder="Note (optional)" value="${escapeHtml(note)}" />
    <button type="button" class="btn-icon btn-remove-row">&times;</button>
  `;
  row.querySelector(".btn-remove-row").addEventListener("click", () => row.remove());
  list.appendChild(row);
}

function renderAssignmentsEditor() {
  document.getElementById("btn-add-role").classList.toggle("hidden", !assignmentsEditMode);
  document.getElementById("btn-toggle-role-edit").textContent = assignmentsEditMode ? "Done Editing Roles" : "Edit Roles";
  if (assignmentsEditMode) renderAssignmentsEditMode();
  else renderAssignmentsQuickFill();
}

// Default view: just role labels + a name input, grouped by section — this is the form
// used every week to fill in who's serving, so role/group structure stays out of the way.
function renderAssignmentsQuickFill() {
  destroyAssignmentsSortable();
  const list = document.getElementById("assignments-list");
  const groups = groupByRoleGroup(editingAssignments);
  list.innerHTML = groups.map((g) => `
    <div class="quickfill-group">
      <h5>${escapeHtml(g.group) || "Other"}</h5>
      ${g.items.map((a) => `
        <div class="quickfill-row">
          <span class="quickfill-role">${escapeHtml(a.role)}</span>
          <input type="text" class="quickfill-name-input" list="people-datalist" data-index="${a.index}" placeholder="Not assigned" value="${escapeHtml(a.person_name)}" />
        </div>
      `).join("")}
    </div>
  `).join("");

  list.querySelectorAll(".quickfill-name-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      editingAssignments[Number(e.target.dataset.index)].person_name = e.target.value;
    });
  });
}

// Structure view: full Group/Role/Name rows, for creating, renaming, reordering, or removing roles.
// Rows are reorderable by dragging the handle (SortableJS), touch and mouse both work.
function renderAssignmentsEditMode() {
  destroyAssignmentsSortable();
  const list = document.getElementById("assignments-list");
  list.innerHTML = editingAssignments.map((a, index) => `
    <div class="assignment-row" data-index="${index}">
      <span class="drag-handle">&#9776;</span>
      <input type="text" class="assign-group-input" placeholder="Group (e.g. Stage)" value="${escapeHtml(a.role_group)}" />
      <input type="text" class="assign-role-input" placeholder="Role (e.g. Worship Leader)" value="${escapeHtml(a.role)}" required />
      <input type="text" class="assign-person-input" list="people-datalist" placeholder="Assigned name" value="${escapeHtml(a.person_name)}" />
      <button type="button" class="btn-icon btn-remove-row">&times;</button>
    </div>
  `).join("");

  list.querySelectorAll(".assignment-row").forEach((row) => {
    const index = Number(row.dataset.index);
    row.querySelector(".assign-group-input").addEventListener("input", (e) => {
      editingAssignments[index].role_group = e.target.value;
    });
    row.querySelector(".assign-role-input").addEventListener("input", (e) => {
      editingAssignments[index].role = e.target.value;
    });
    row.querySelector(".assign-person-input").addEventListener("input", (e) => {
      editingAssignments[index].person_name = e.target.value;
    });
    row.querySelector(".btn-remove-row").addEventListener("click", () => {
      editingAssignments.splice(index, 1);
      renderAssignmentsEditMode();
    });
  });

  assignmentsSortable = Sortable.create(list, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: (evt) => {
      if (evt.oldIndex === evt.newIndex) return;
      const [moved] = editingAssignments.splice(evt.oldIndex, 1);
      editingAssignments.splice(evt.newIndex, 0, moved);
      renderAssignmentsEditMode();
    },
  });
}

function destroyAssignmentsSortable() {
  if (assignmentsSortable) {
    assignmentsSortable.destroy();
    assignmentsSortable = null;
  }
}

function checkDuplicateDate() {
  const dateInput = document.getElementById("service-date");
  const errorEl = document.getElementById("date-error");
  const isDuplicate = allSchedules.some((s) => s.service_date === dateInput.value && s.id !== currentScheduleId);
  errorEl.classList.toggle("hidden", !isDuplicate);
  dateInput.classList.toggle("input-error", isDuplicate);
  return isDuplicate;
}

async function handleSubmit(e) {
  e.preventDefault();
  const service_date = document.getElementById("service-date").value;
  const label = document.getElementById("schedule-label").value.trim();

  if (checkDuplicateDate()) {
    document.getElementById("service-date").focus();
    return;
  }

  const times = [...document.querySelectorAll("#times-list .time-row")].map((row) => ({
    service_time: row.querySelector(".time-input").value,
    note: row.querySelector(".time-note-input").value.trim(),
  }));

  const assignments = editingAssignments
    .map((a) => ({
      role_group: a.role_group.trim() || "Other",
      role: a.role.trim(),
      person_name: a.person_name.trim(),
    }))
    .filter((a) => a.role);

  const dressCodeFile = document.getElementById("dress-code-file").files[0] || null;
  const dressCodeNotes = document.getElementById("dress-code-notes").value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    if (currentScheduleId) {
      await window.Api.updateSchedule(currentScheduleId, {
        service_date, label, times, assignments, dressCodeNotes,
        dressCodeFile, removeDressCode: removeDressCodeFlag, existingDressCodePath: currentDressCodePath,
      });
    } else {
      await window.Api.createSchedule({ service_date, label, times, assignments, dressCodeFile, dressCodeNotes });
    }
    try {
      await window.Api.syncPeople(assignments.map((a) => a.person_name));
    } catch (err) {
      // Non-critical: the schedule itself already saved successfully.
    }
    closeModal();
    await loadSchedules();
  } catch (err) {
    alert("Failed to save schedule: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleDelete() {
  if (!currentScheduleId) return;
  if (!confirm("Delete this schedule and all its assignments?")) return;
  try {
    await window.Api.deleteSchedule(currentScheduleId);
    closeModal();
    await loadSchedules();
  } catch (err) {
    alert("Failed to delete schedule: " + err.message);
  }
}

async function shareSchedule(s, triggerBtn) {
  const originalLabel = triggerBtn.textContent;
  triggerBtn.disabled = true;
  triggerBtn.textContent = "Preparing...";

  const root = document.createElement("div");
  root.className = "share-render-root";
  root.innerHTML = buildShareCardHtml(s);
  document.body.appendChild(root);

  try {
    await waitForImages(root);
    const canvas = await html2canvas(root.querySelector(".share-card"), { backgroundColor: "#f3ede0", scale: 2, useCORS: true });
    root.remove();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const filename = `schedule-${s.service_date}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Weekly Service Schedule" });
      } catch (err) {
        if (err.name !== "AbortError") downloadBlob(blob, filename);
      }
    } else {
      downloadBlob(blob, filename);
    }
  } catch (err) {
    root.remove();
    alert("Failed to generate share image: " + err.message);
  } finally {
    triggerBtn.disabled = false;
    triggerBtn.textContent = originalLabel;
  }
}

function waitForImages(container) {
  const imgs = [...container.querySelectorAll("img")];
  return Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener("load", resolve);
    img.addEventListener("error", resolve);
  })));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Standalone, single-column layout for the shareable PNG — stacked sections read far
// better than the 3-column desktop grid once compressed into a WhatsApp chat thumbnail.
function buildShareCardHtml(s) {
  const dateLabel = formatDate(s.service_date);
  const times = [...s.schedule_times].sort((a, b) => a.service_time.localeCompare(b.service_time));
  const timesHtml = times.map((t) => `<span class="badge">${formatTime(t.service_time)}${t.note ? " · " + escapeHtml(t.note) : ""}</span>`).join("");

  const groups = groupAssignmentsCompact(s.schedule_assignments);
  const sectionsHtml = groups.map((g) => `
    <div class="share-section">
      <h4>${escapeHtml(g.group)}</h4>
      <ul>
        ${g.items.map((item) => {
          if (!item.names.length) {
            return `<li><span class="role">${escapeHtml(item.label)}</span><span class="person unset">-</span></li>`;
          }
          const linesHtml = item.names.map((n) => `<span class="person-line">${escapeHtml(n)}</span>`).join("");
          return `<li><span class="role">${escapeHtml(item.label)}</span><span class="person-list">${linesHtml}</span></li>`;
        }).join("")}
      </ul>
    </div>
  `).join("");

  const dressCodeImageHtml = s.dress_code_image_path ? `
    <div class="share-section">
      <h4>Dress Code</h4>
      <img class="share-dresscode-img" crossorigin="anonymous" src="${window.Api.getDressCodeUrl(s.dress_code_image_path)}" alt="Dress code" />
    </div>
  ` : "";

  const dressCodeNotesCardHtml = s.dress_code_notes ? `
    <div class="share-section">
      <h4>Dress Code Detail</h4>
      ${dressCodeNotesHtml(s.dress_code_notes)}
    </div>
  ` : "";

  return `
    <div class="share-card">
      <div class="share-header">
        <img class="share-logo" src="assets/logo-icon.svg" alt="" />
        <div class="share-church-name">GBI House of Happiness</div>
      </div>
      <div class="share-date">${dateLabel}</div>
      ${s.label ? `<span class="label-tag">${escapeHtml(s.label)}</span>` : ""}
      <div class="times-row share-times-row">${timesHtml}</div>
      <div class="share-sections">
        ${sectionsHtml}
        ${dressCodeImageHtml}
        ${dressCodeNotesCardHtml}
      </div>
      <div class="share-footer">Weekly Service Schedule</div>
    </div>
  `;
}

function dressCodeNotesHtml(notes) {
  const lines = (notes || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "";
  return `<ul class="dresscode-notes-list">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function formatDate(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(hhmmss) {
  return hhmmss.slice(0, 5);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
