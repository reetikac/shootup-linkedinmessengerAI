/**
 * sidepanel.js
 *
 * Screen 1 — Profile Setup  : manage multiple named sender profiles
 * Screen 2 — Generate       : pick a profile, scrape recipient, call API
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Update this to your Vercel URL after deploying.
const API_URL      = "http://localhost:3002/api/generate";
const EMAIL_URL    = "http://localhost:3002/api/find-email";
const CONNECT_URL  = "http://localhost:3002/api/connect-message";

// ── State ─────────────────────────────────────────────────────────────────────
let profiles        = [];    // [{ id, profileName, name, role, yearsExp, achievements, intent, tone, length }]
let editingId         = null;  // null = new profile, string = editing existing
let recipientData     = null;  // scraped from LinkedIn content script
let currentResumeB64  = null;  // base64-encoded PDF for the profile being edited/created
let currentResumeName = null;  // filename shown in the chip

// ── Storage helpers ───────────────────────────────────────────────────────────
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function persistProfiles() {
  await storageSet({ profiles });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Screen routing ─────────────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("screen-setup").style.display    = name === "setup"    ? "" : "none";
  document.getElementById("screen-generate").style.display = name === "generate" ? "" : "none";
}

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showSetupStatus(msg, type = "error") {
  const el = document.getElementById("setup-status");
  el.textContent = msg;
  el.className = `status-msg visible ${type}`;
}
function clearSetupStatus() {
  const el = document.getElementById("setup-status");
  el.className = "status-msg";
}

function showGenStatus(msg, type = "error") {
  const el = document.getElementById("gen-status");
  el.textContent = msg;
  el.className = `status-msg visible ${type}`;
}
function clearGenStatus() {
  const el = document.getElementById("gen-status");
  el.className = "status-msg";
}

function showConnectStatus(msg, type = "error") {
  const el = document.getElementById("connect-status");
  el.textContent = msg;
  el.className = `status-msg visible ${type}`;
}
function clearConnectStatus() {
  document.getElementById("connect-status").className = "status-msg";
}

// ── Resume helpers ─────────────────────────────────────────────────────────────
function showResumeChip(filename) {
  document.getElementById("resume-filename-display").textContent = filename;
  document.getElementById("resume-display").style.display = "";
  document.getElementById("resume-pick-btn").style.display = "none";
}

function hideResumeChip() {
  currentResumeB64  = null;
  currentResumeName = null;
  document.getElementById("resume-display").style.display = "none";
  document.getElementById("resume-pick-btn").style.display = "";
  document.getElementById("f-resume").value = "";
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — Profile Setup
// ─────────────────────────────────────────────────────────────────────────────

function renderProfilesList() {
  const container   = document.getElementById("profiles-list");
  const backBtn     = document.getElementById("back-btn");
  const cancelBtn   = document.getElementById("cancel-edit-btn");

  backBtn.style.display   = profiles.length > 0 ? "" : "none";
  cancelBtn.style.display = editingId           ? "" : "none";

  if (profiles.length === 0) {
    container.innerHTML = `<div class="empty-state">No profiles yet — fill in the form below.</div>`;
    return;
  }

  container.innerHTML = profiles
    .map(
      (p) => `
    <div class="profile-chip ${p.id === editingId ? "active" : ""}" data-id="${p.id}">
      <span class="profile-chip-name">${esc(p.profileName)}</span>
      <div class="profile-chip-actions">
        <button class="btn-icon edit-btn" data-id="${p.id}" title="Edit">Edit</button>
        <button class="btn-icon danger delete-btn" data-id="${p.id}" title="Delete">✕</button>
      </div>
    </div>`
    )
    .join("");

  container.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadProfileIntoForm(btn.dataset.id))
  );
  container.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => deleteProfile(btn.dataset.id))
  );
}

function loadProfileIntoForm(id) {
  const p = profiles.find((x) => x.id === id);
  if (!p) return;

  editingId = id;
  document.getElementById("form-title").textContent     = `Editing: ${p.profileName}`;
  document.getElementById("f-profile-name").value       = p.profileName;
  document.getElementById("f-name").value               = p.name;
  document.getElementById("f-role").value               = p.role;
  document.getElementById("f-years-exp").value          = p.yearsExp ?? "";
  document.getElementById("f-achievements").value       = p.achievements;
  document.getElementById("f-intent").value             = p.intent;

  document.getElementById("save-profile-btn").textContent = "Update Profile";
  document.getElementById("cancel-edit-btn").style.display = "";

  // Restore resume chip if this profile has a saved resume
  if (p.resumeBase64) {
    currentResumeB64  = p.resumeBase64;
    currentResumeName = p.resumeFilename ?? "resume.pdf";
    showResumeChip(currentResumeName);
  } else {
    hideResumeChip();
  }

  renderProfilesList(); // refresh active highlight
  document.getElementById("f-profile-name").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent          = "New Profile";
  document.getElementById("f-profile-name").value            = "";
  document.getElementById("f-name").value                    = "";
  document.getElementById("f-role").value                    = "";
  document.getElementById("f-years-exp").value               = "";
  document.getElementById("f-achievements").value            = "";
  document.getElementById("f-intent").value                  = "job_inquiry";
  document.getElementById("save-profile-btn").textContent    = "Save Profile";
  document.getElementById("cancel-edit-btn").style.display   = "none";
  hideResumeChip();
  clearSetupStatus();
  renderProfilesList();
}

async function deleteProfile(id) {
  if (!confirm("Delete this profile?")) return;

  profiles = profiles.filter((p) => p.id !== id);
  await persistProfiles();

  // Clean up selectedProfileId if it pointed at the deleted profile
  const { selectedProfileId } = await storageGet(["selectedProfileId"]);
  if (selectedProfileId === id) {
    await storageSet({ selectedProfileId: profiles[0]?.id ?? null });
  }

  if (editingId === id) resetForm();
  renderProfilesList();
  renderProfileSelector();
}

// ── Resume file input ─────────────────────────────────────────────────────────
document.getElementById("resume-pick-btn").addEventListener("click", () => {
  document.getElementById("f-resume").click();
});

document.getElementById("f-resume").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    showSetupStatus("Please upload a PDF file.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showSetupStatus("Resume must be under 5 MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    currentResumeB64  = ev.target.result.split(",")[1]; // strip "data:...;base64," prefix
    currentResumeName = file.name;
    showResumeChip(file.name);
    clearSetupStatus();
  };
  reader.readAsDataURL(file);
});

document.getElementById("resume-remove-btn").addEventListener("click", hideResumeChip);

// ── Save / Update profile ─────────────────────────────────────────────────────
document.getElementById("save-profile-btn").addEventListener("click", async () => {
  const profileName = document.getElementById("f-profile-name").value.trim();
  const name        = document.getElementById("f-name").value.trim();
  const role        = document.getElementById("f-role").value.trim();

  if (!profileName)    { showSetupStatus('Please enter a profile label (e.g. "PM Outreach").'); return; }
  if (!name)           { showSetupStatus("Please enter your name."); return; }
  if (!role)           { showSetupStatus("Please enter your role."); return; }
  if (!currentResumeB64) { showSetupStatus("Please upload your resume PDF — it's required for email generation."); return; }

  const data = {
    profileName,
    name,
    role,
    yearsExp:       document.getElementById("f-years-exp").value.trim(),
    achievements:   document.getElementById("f-achievements").value.trim(),
    intent:         document.getElementById("f-intent").value,
    resumeBase64:   currentResumeB64,
    resumeFilename: currentResumeName,
  };

  if (editingId) {
    const idx = profiles.findIndex((p) => p.id === editingId);
    if (idx !== -1) profiles[idx] = { ...profiles[idx], ...data };
    await persistProfiles();
    showSetupStatus("Profile updated.", "success");
    resetForm();
    renderProfileSelector();
  } else {
    const newProfile = { id: uid(), ...data };
    profiles.push(newProfile);
    await persistProfiles();
    await storageSet({ selectedProfileId: newProfile.id });
    renderProfilesList();
    resetForm();

    if (profiles.length === 1) {
      // First profile ever — switch straight to generate screen
      renderProfileSelector(newProfile.id);
      showScreen("generate");
    } else {
      showSetupStatus("Profile saved!", "success");
      renderProfileSelector();
    }
  }
});

document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);
document.getElementById("new-profile-btn").addEventListener("click", resetForm);
document.getElementById("back-btn").addEventListener("click", () => showScreen("generate"));

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — Generate
// ─────────────────────────────────────────────────────────────────────────────

// ── Profile selector ──────────────────────────────────────────────────────────
function renderProfileSelector(selectedId) {
  const sel = document.getElementById("profile-selector");

  if (profiles.length === 0) {
    sel.innerHTML = `<option disabled>No profiles saved</option>`;
    return;
  }

  sel.innerHTML = profiles
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${esc(p.profileName)}</option>`
    )
    .join("");
}

document.getElementById("profile-selector").addEventListener("change", async (e) => {
  await storageSet({ selectedProfileId: e.target.value });
});

document.getElementById("edit-profiles-btn").addEventListener("click", () => {
  renderProfilesList();
  showScreen("setup");
});

// ── Recipient scraping (silent — no UI) ──────────────────────────────────────
async function fetchProfile() {
  recipientData = null;
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Fallback: side panel context can sometimes return a non-LinkedIn active tab.
    // In that case, look for any open LinkedIn profile tab.
    if (!tab?.url?.includes("linkedin.com/in/")) {
      const liTabs = await chrome.tabs.query({ url: "https://www.linkedin.com/in/*" });
      if (liTabs.length > 0) tab = liTabs[0];
    }
  } catch (_) { return; }

  if (!tab?.url?.includes("linkedin.com/in/")) return;

  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: "GET_PROFILE", tabId: tab.id });
  } catch (_) { return; }

  if (response?.name) {
    recipientData = response;
    document.getElementById("output-card").style.display = "none";
  }
}

function renderRecipient(data) {
  recipientData = data;
}

// ── Find Email ────────────────────────────────────────────────────────────────
async function findEmails() {
  const btn       = document.getElementById("find-email-btn");
  const resultDiv = document.getElementById("email-results");
  const guessList = document.getElementById("email-guesses-list");

  if (!recipientData) {
    btn.disabled    = true;
    btn.textContent = "Reading profile…";
    await fetchProfile();
    btn.disabled    = false;
    btn.textContent = "✉ Find Email Address";
  }

  if (!recipientData) {
    showGenStatus("Could not read the LinkedIn profile. Make sure you're on a linkedin.com/in/… page, then try again.");
    return;
  }

  btn.disabled    = true;
  btn.textContent = "Searching…";

  try {
    const res = await fetch(EMAIL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: recipientData.name, company: recipientData.company }),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error ?? msg; } catch (_) {}
      throw new Error(msg);
    }

    const { domain, guesses } = await res.json();

    document.getElementById("email-domain-input").value = domain;

    guessList.innerHTML = guesses
      .map((g, i) => `
        <div class="email-guess-row">
          <span class="email-addr" id="eg-${i}">${esc(g.email)}</span>
          <span class="conf-chip ${g.confidence}">${g.confidence}</span>
          <button class="copy-btn email-copy-btn" data-idx="${i}">Copy</button>
        </div>`)
      .join("");

    guessList.querySelectorAll(".email-copy-btn").forEach((copyBtn) => {
      copyBtn.addEventListener("click", () => {
        const domainOverride = document.getElementById("email-domain-input").value.trim();
        const raw   = document.getElementById(`eg-${copyBtn.dataset.idx}`)?.textContent ?? "";
        const local = raw.split("@")[0];
        const email = domainOverride ? `${local}@${domainOverride}` : raw;
        navigator.clipboard.writeText(email).then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          copyBtn.classList.add("copied");
          setTimeout(() => { copyBtn.textContent = orig; copyBtn.classList.remove("copied"); }, 1800);
        });
      });
    });

    resultDiv.style.display = "";
  } catch (err) {
    showGenStatus(`Email finder: ${esc(err.message)}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = "✉ Find Email Address";
  }
}

document.getElementById("find-email-btn").addEventListener("click", findEmails);

// ── Connect Message ───────────────────────────────────────────────────────────
async function generateConnect() {
  clearConnectStatus();

  if (!recipientData) {
    showConnectStatus("Open a LinkedIn profile and click ↻ Refresh first.");
    return;
  }

  const profileId = document.getElementById("profile-selector").value;
  const profile   = profiles.find((p) => p.id === profileId);
  if (!profile) {
    showConnectStatus("Please select a sender profile.");
    return;
  }

  const btn = document.getElementById("connect-btn");
  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span>Generating…`;

  try {
    const res = await fetch(CONNECT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: recipientData,
        sender: {
          name:         profile.name,
          role:         profile.role,
          yearsExp:     profile.yearsExp ?? "",
          achievements: profile.achievements ?? "",
        },
      }),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error ?? msg; } catch (_) {}
      throw new Error(msg);
    }

    const { message, charCount } = await res.json();
    document.getElementById("out-connect").textContent           = message;
    document.getElementById("connect-char-count").textContent    = `${charCount}/280`;
    document.getElementById("connect-char-count").style.color    = charCount > 280 ? "var(--danger)" : "var(--muted)";
    document.getElementById("connect-output").style.display      = "";
  } catch (err) {
    showConnectStatus(`Error: ${esc(err.message)}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = "Draft Connection Message";
  }
}

document.getElementById("connect-btn").addEventListener("click", generateConnect);

document.getElementById("connect-copy-btn").addEventListener("click", () => {
  const text = document.getElementById("out-connect").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("connect-copy-btn");
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1800);
  });
});

// ── Generate ──────────────────────────────────────────────────────────────────
async function generate() {
  clearGenStatus();

  if (!recipientData) {
    showGenStatus("Open a LinkedIn profile and click ↻ Refresh first.");
    return;
  }

  const profileId = document.getElementById("profile-selector").value;
  const profile   = profiles.find((p) => p.id === profileId);
  if (!profile) {
    showGenStatus("Please select a sender profile.");
    return;
  }

  await storageSet({ selectedProfileId: profileId });

  // Loading state
  const genBtn   = document.getElementById("generate-btn");
  const regenBtn = document.getElementById("regenerate-btn");
  genBtn.disabled   = true;
  regenBtn.disabled = true;
  genBtn.innerHTML  = `<span class="spinner"></span>Generating…`;

  try {
    const res = await fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: recipientData,
        sender: {
          name:         profile.name,
          role:         profile.role,
          achievements: profile.achievements,
          intent:       profile.intent,
          resumeBase64: profile.resumeBase64 ?? null,
        },
      }),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error ?? msg; } catch (_) {}
      throw new Error(msg);
    }

    const data = await res.json();
    document.getElementById("out-subject").textContent = data.subject ?? "";
    document.getElementById("out-message").textContent = data.message ?? "";

    const card = document.getElementById("output-card");
    card.style.display = "";
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showGenStatus(`Error: ${esc(err.message)}`);
  } finally {
    genBtn.disabled   = false;
    regenBtn.disabled = false;
    genBtn.textContent = "Generate Message";
  }
}

document.getElementById("generate-btn").addEventListener("click",   generate);
document.getElementById("regenerate-btn").addEventListener("click", generate);

// ── Copy buttons ──────────────────────────────────────────────────────────────
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = document.getElementById(btn.dataset.target)?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove("copied");
      }, 1800);
    });
  });
});

// ── Live recipient updates ────────────────────────────────────────────────────
// When the user navigates to a new LinkedIn profile (SPA nav) or the extension
// injects content.js into an already-open tab, content.js broadcasts PROFILE_DATA
// → background caches it AND writes pendingProfileData to storage
// → this listener fires and auto-refreshes the recipient card.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.pendingProfileData) return;

  // Only update Screen 2 (generate screen)
  if (document.getElementById("screen-generate").style.display === "none") return;

  const { tabId, data } = changes.pendingProfileData.newValue ?? {};
  if (!data?.name) return;

  // Confirm this push is for the tab the panel is currently showing
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id !== tabId) return;
  } catch (_) {
    return;
  }

  recipientData = data;
  document.getElementById("output-card").style.display   = "none";
  document.getElementById("connect-output").style.display = "none";
  clearGenStatus();
});

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────
async function init() {
  const { profiles: saved, selectedProfileId } = await storageGet([
    "profiles",
    "selectedProfileId",
  ]);

  profiles = saved ?? [];

  if (profiles.length === 0) {
    showScreen("setup");
    return;
  }

  // Restore the previously selected profile (or default to first)
  const activeId = selectedProfileId ?? profiles[0].id;

  renderProfilesList();
  renderProfileSelector(activeId);
  showScreen("generate");

  // Kick off recipient scrape in the background (non-blocking)
  fetchProfile();
}

init();
