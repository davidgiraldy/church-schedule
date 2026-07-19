let currentScheduleId = null;
let currentDressCodePath = null;
let removeDressCodeFlag = false;
let allSchedules = [];
let filterMode = "all";
let filterFrom = null;
let filterTo = null;

document.addEventListener("DOMContentLoaded", () => {
  loadSchedules();

  document.getElementById("btn-new-schedule").addEventListener("click", () => openModal());
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("btn-add-time").addEventListener("click", () => addTimeRow());
  document.getElementById("btn-add-role").addEventListener("click", () => addAssignmentRow("Other", ""));
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
});

function setFilterMode(mode) {
  filterMode = mode;
  document.querySelectorAll(".filter-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  document.getElementById("custom-range").classList.toggle("hidden", mode !== "custom");
  renderFiltered();
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderFiltered() {
  let filtered;
  if (filterMode === "upcoming") {
    const today = todayIso();
    filtered = allSchedules.filter((s) => s.service_date >= today).sort((a, b) => a.service_date.localeCompare(b.service_date));
  } else if (filterMode === "custom") {
    filtered = allSchedules.filter((s) => {
      if (filterFrom && s.service_date < filterFrom) return false;
      if (filterTo && s.service_date > filterTo) return false;
      return true;
    }).sort((a, b) => a.service_date.localeCompare(b.service_date));
  } else {
    filtered = [...allSchedules].sort((a, b) => b.service_date.localeCompare(a.service_date));
  }
  renderScheduleList(filtered);
}

async function loadSchedules() {
  const container = document.getElementById("schedule-list");
  try {
    allSchedules = await window.Api.listSchedules();
    renderFiltered();
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load schedules: ${escapeHtml(err.message)}</p>`;
  }
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

  const dressCodeHtml = s.dress_code_image_path ? `
    <article class="group-card dresscode-card">
      <h4>Dress Code</h4>
      <a href="${window.Api.getDressCodeUrl(s.dress_code_image_path)}" target="_blank" rel="noopener">
        <img src="${window.Api.getDressCodeUrl(s.dress_code_image_path)}" alt="Dress code for ${dateLabel}" />
      </a>
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
          <button class="btn btn-small" data-edit-id="${s.id}">Edit</button>
        </div>
      </div>
      <div class="group-cards">
        ${groupCardsHtml || '<p class="empty-small">No assignments yet.</p>'}
        ${dressCodeHtml}
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

// Full per-slot listing (Singer I, Singer II, ... kept separate) used to populate the edit form.
function groupAssignmentsFull(assignments) {
  const sorted = [...assignments].sort((a, b) => a.role_order - b.role_order);
  const map = new Map();
  for (const a of sorted) {
    if (!map.has(a.role_group)) map.set(a.role_group, []);
    map.get(a.role_group).push(a);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

function openModal(schedule = null) {
  currentScheduleId = schedule ? schedule.id : null;
  currentDressCodePath = schedule ? (schedule.dress_code_image_path || null) : null;
  removeDressCodeFlag = false;
  document.getElementById("modal-title").textContent = schedule ? "Edit Schedule" : "Add Schedule";
  document.getElementById("schedule-id").value = schedule ? schedule.id : "";
  document.getElementById("service-date").value = schedule ? schedule.service_date : "";
  document.getElementById("schedule-label").value = schedule ? (schedule.label || "") : "";
  document.getElementById("btn-delete-schedule").classList.toggle("hidden", !schedule);

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

  document.getElementById("assignments-list").innerHTML = "";
  if (schedule && schedule.schedule_assignments.length) {
    groupAssignmentsFull(schedule.schedule_assignments).forEach((g) => {
      g.items.forEach((a) => addAssignmentRow(g.group, a.role, a.person_name));
    });
  } else {
    window.ROLE_TEMPLATE.forEach((g) => {
      g.roles.forEach((role) => addAssignmentRow(g.group, role, ""));
    });
  }

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

function addAssignmentRow(group = "", role = "", personName = "") {
  const list = document.getElementById("assignments-list");
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.innerHTML = `
    <input type="text" class="assign-group-input" placeholder="Group (e.g. Mimbar)" value="${escapeHtml(group)}" />
    <input type="text" class="assign-role-input" placeholder="Role (e.g. Worship Leader)" value="${escapeHtml(role)}" required />
    <input type="text" class="assign-person-input" placeholder="Assigned name" value="${escapeHtml(personName)}" />
    <button type="button" class="btn-icon btn-remove-row">&times;</button>
  `;
  row.querySelector(".btn-remove-row").addEventListener("click", () => row.remove());
  list.appendChild(row);
}

async function handleSubmit(e) {
  e.preventDefault();
  const service_date = document.getElementById("service-date").value;
  const label = document.getElementById("schedule-label").value.trim();

  const times = [...document.querySelectorAll("#times-list .time-row")].map((row) => ({
    service_time: row.querySelector(".time-input").value,
    note: row.querySelector(".time-note-input").value.trim(),
  }));

  const assignments = [...document.querySelectorAll("#assignments-list .assignment-row")].map((row) => ({
    role_group: row.querySelector(".assign-group-input").value.trim() || "Other",
    role: row.querySelector(".assign-role-input").value.trim(),
    person_name: row.querySelector(".assign-person-input").value.trim(),
  })).filter((a) => a.role);

  const dressCodeFile = document.getElementById("dress-code-file").files[0] || null;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    if (currentScheduleId) {
      await window.Api.updateSchedule(currentScheduleId, {
        service_date, label, times, assignments,
        dressCodeFile, removeDressCode: removeDressCodeFlag, existingDressCodePath: currentDressCodePath,
      });
    } else {
      await window.Api.createSchedule({ service_date, label, times, assignments, dressCodeFile });
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
