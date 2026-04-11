import "./style.css";

// 1. STABLE IMPORT (Avoids the 'Failed to resolve' error)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 2. DATABASE SETUP
const supabaseUrl = "https://orhcmllshkgqdektxshs.supabase.co";
const supabaseKey = "sb_publishable_1dTR4wmkKA4KPLqMa-tYaw_0GbMx41P";
const supabase = createClient(supabaseUrl, supabaseKey);

if (import.meta.env.DEV && typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

// 3. APP STATE (Preserving your Role & Member logic)
const appState = {
  callings: [],
  members: [], // Loaded from your 'members' table [cite: 1]
  assignableNames: [],
  units: [
    "Allenton Ward",
    "Ashburton Ward",
    "Avon River Ward",
    "Cashmere Ward",
    "Hagley Ward",
    "Mona Vale Ward",
    "Rangiora Ward",
    "Riccarton Ward",
    "Stake",
  ],
  expandedGridId: null,
  expandedSustainingIds: new Set(),
};

// 4. CORE LOGIC
async function startApp() {
  const app = document.getElementById("app");

  // Fetch members from database
  const { data: members, error } = await supabase.from("members").select("*");

  if (error) {
    console.error("Error fetching members:", error);
    alert(`Database Error: ${error.message}`);
    return;
  }

  if (members) {
    appState.members = members;
    appState.assignableNames = members
      .filter((m) => m.role !== "viewer")
      .map((m) => m.name);
  }

  const isLoggedIn = localStorage.getItem("isLoggedIn");
  if (isLoggedIn) {
    await fetchCallings();
    renderHeader();
    renderCards();
  } else {
    renderLogin();
  }
}

async function fetchCallings() {
  const { data, error } = await supabase
    .from("callings")
    .select("*")
    .order("created_at", { ascending: false });
  if (!error) appState.callings = data;
}

// 5. LOGIN LOGIC (Restoring the Admin/Stake Password logic )
window.login = async function (e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const selectedName = formData.get("authName");
  const enteredPassword = formData.get("authPassword");

  // 1. Define the master passwords clearly
  const STAKE_PW = "stake2026";
  const ADMIN_PW = "admin789";

  // 2. Find the person in your loaded appState.members
  const person = appState.members.find((m) => m.name === selectedName);

  if (!person) {
    alert("Please select a name from the list first!");
    return;
  }

  // 3. Resolve required password type robustly.
  // Prefer explicit shared_password_type, but fall back to role when needed.
  const sharedPasswordType = String(person.shared_password_type ?? "")
    .toLowerCase()
    .trim();
  const roleType = String(person.role ?? "")
    .toLowerCase()
    .trim();

  const isAdminType =
    sharedPasswordType.includes("admin") ||
    (!sharedPasswordType && roleType.includes("admin"));

  const requiredType = isAdminType ? "admin" : "stake";
  const correctPassword = isAdminType ? ADMIN_PW : STAKE_PW;

  // DEBUG LOG - Open your console (F12) to see this!
  console.log(
    `[Stake Callings] Logging in as: ${selectedName} | role=${roleType || "(none)"} | shared_password_type=${sharedPasswordType || "(none)"} | expects=${requiredType}`,
  );

  if (enteredPassword.trim() === correctPassword) {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", person.name);
    localStorage.setItem("userRole", person.role); // Sets 'admin', 'assign', or 'viewer'
    window.location.reload();
  } else {
    alert(
      `Access Denied. For ${selectedName}, you must use the ${requiredType} password.`,
    );
  }
};
// 6. UI RENDERING (White Cards / Blue Blocks)
function renderCards() {
  const list = document.getElementById("data-list");
  if (!list) return;

  list.innerHTML = appState.callings
    .map((row) => {
      const isExpanded = appState.expandedGridId === row.id;
      const isRelease = row.type?.toUpperCase() === "RELEASE";

      return `
      <article class="card">
        <div style="background: ${isRelease ? "#FFD43B" : "#4E5FF2"}; padding: 10px; text-align: center; font-weight: 900; color: ${isRelease ? "#000" : "#fff"};">
          ${isRelease ? "RELEASE" : "CALLING"}
        </div>

        <div style="padding: 25px;">
          <h2 style="margin: 0; font-size: 1.6rem;">${row.name}</h2>
          <p style="color: #666; margin: 4px 0;">${row.position}</p>
          <p style="color: #c24d7c; font-weight: bold;">${row.unit}</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <label class="workflow-block ${row.sp_approved ? "done" : ""}" style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: ${row.sp_approved ? "#d5e9f4" : "#eef7fb"}; border-radius: 12px; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" ${row.sp_approved ? "checked" : ""} onchange="window.updateField('${row.id}', 'sp_approved', this.checked)">
                <span style="font-weight: bold;">S.Pres Approved</span>
              </div>
              ${row.sp_approved_date ? `<span style="font-size: 0.75rem; color: #666; margin-left: 26px;">${new Date(row.sp_approved_date).toLocaleDateString()}</span>` : ""}
            </label>
            <label class="workflow-block ${row.hc_sustained ? "done" : ""}" style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: ${row.hc_sustained ? "#d5e9f4" : "#eef7fb"}; border-radius: 12px; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" ${row.hc_sustained ? "checked" : ""} onchange="window.updateField('${row.id}', 'hc_sustained', this.checked)">
                <span style="font-weight: bold;">SHC Sustained</span>
              </div>
              ${row.hc_sustained_date ? `<span style="font-size: 0.75rem; color: #666; margin-left: 26px;">${new Date(row.hc_sustained_date).toLocaleDateString()}</span>` : ""}
            </label>
          </div>

          <button onclick="window.toggleDetails('${row.id}')" 
                  style="width: 100%; padding: 12px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; font-weight: bold; color: #555; cursor: pointer;">
            ${isExpanded ? "▲ Hide Details" : "▼ Show Workflow Details"}
          </button>

          <div style="display: ${isExpanded ? "block" : "none"}; margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ccc;">
             <p style="font-size: 0.8rem; color: #888; margin-bottom: 10px;">DETAILED STEPS:</p>
             <div style="background: #fdfdfd; padding: 15px; border-radius: 10px; border: 1px solid #eee;">
                <div style="display: grid; gap: 12px; margin-bottom: 14px;">
                  <div>
                    <label style="display: block; font-size: 0.75rem; color: #666; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Interview assigned to</label>
                    <select
                      onchange="window.updateAssignment('${row.id}', 'interview_by', this.value)"
                      style="width: 100%; padding: 10px 12px; border: 1px solid #d7dbe3; border-radius: 8px; background: #fff; color: #333; font-size: 0.95rem;"
                    >
                      <option value="">Select interviewer...</option>
                      ${appState.assignableNames
                        .map(
                          (name) =>
                            `<option value="${name}" ${row.interview_by === name ? "selected" : ""}>${name}</option>`,
                        )
                        .join("")}
                    </select>
                  </div>

                  <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: ${row.interviewed ? "#dff5e8" : "#f5f7fa"}; color: #333; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" ${row.interviewed ? "checked" : ""} onchange="window.updateField('${row.id}', 'interviewed', this.checked)">
                    <span>Interview completed</span>
                  </label>

                  <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: ${row.prev_release ? "#fff2d8" : "#f5f7fa"}; color: #333; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" ${row.prev_release ? "checked" : ""} onchange="window.updateField('${row.id}', 'prev_release', this.checked)">
                    <span>Reminder: verify previous release</span>
                  </label>
                </div>

                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #e0e0e0;">
                  <button onclick="window.toggleSustainingUnits('${row.id}')" style="width: 100%; padding: 10px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; font-weight: 600; color: #1976d2; cursor: pointer; font-size: 0.9rem;">
                    ${appState.expandedSustainingIds.has(row.id) ? "▲ Hide" : "▼ Show"} Sustaining Units
                  </button>

                  ${
                    appState.expandedSustainingIds.has(row.id)
                      ? `
                    <div style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                      <p style="font-size: 0.75rem; color: #666; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase;">Units to sustain</p>
                      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${appState.units
                          .map((unit) => {
                            const selectedUnits = Array.isArray(
                              row.units_sustained,
                            )
                              ? row.units_sustained
                              : [];
                            const isSelected = selectedUnits.includes(unit);
                            return `
                            <button
                              onclick="window.updateSustainedUnits('${row.id}', '${unit}')"
                              style="padding: 8px 12px; border-radius: 20px; border: 1px solid #ccc; background: ${isSelected ? "#4CAF50" : "#fff"}; color: ${isSelected ? "#fff" : "#333"}; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;"
                            >
                              ${unit}
                            </button>
                          `;
                          })
                          .join("")}
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>

                <p style="margin: 14px 0 0 0; color: #444;">Status: <strong>${row.status || "In Progress"}</strong></p>
             </div>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
}

// 7. HELPER FUNCTIONS
window.toggleDetails = (id) => {
  // If the clicked card is already open, close it (null). Otherwise, open it.
  appState.expandedGridId = appState.expandedGridId === id ? null : id;
  renderCards();
};

window.toggleSustainingUnits = (id) => {
  if (appState.expandedSustainingIds.has(id)) {
    appState.expandedSustainingIds.delete(id);
  } else {
    appState.expandedSustainingIds.add(id);
  }
  renderCards();
};

window.updateSustainedUnits = async (id, unitName) => {
  const item = appState.callings.find((c) => c.id === id);
  if (!item) return;

  let sustaining = Array.isArray(item.units_sustained)
    ? [...item.units_sustained]
    : [];

  // Toggle the unit
  if (sustaining.includes(unitName)) {
    sustaining = sustaining.filter((u) => u !== unitName);
  } else {
    sustaining.push(unitName);
  }

  // Update local state
  item.units_sustained = sustaining;

  // Update database
  const { error } = await supabase
    .from("callings")
    .update({ units_sustained: sustaining })
    .eq("id", id);

  if (error) {
    console.error("Error updating sustaining units:", error);
    alert(`Failed to update sustaining units: ${error.message}`);
  } else {
    console.log("Sustaining units updated:", sustaining);
    renderCards();
  }
};

window.updateAssignment = async (id, field, value) => {
  const { error } = await supabase
    .from("callings")
    .update({ [field]: value || null })
    .eq("id", id);

  if (error) {
    console.error("Assignment update error:", error);
    alert(`Failed to update assignment: ${error.message}`);
    return;
  }

  const item = appState.callings.find((c) => c.id === id);
  if (item) {
    item[field] = value || null;
  }

  renderCards();
};

window.updateField = async (id, field, value) => {
  // Prepare the update object
  const updateData = {};

  // interviewed uses one timestamp column: checked => timestamp, unchecked => null
  if (field === "interviewed") {
    updateData[field] = value ? new Date().toISOString() : null;
  } else {
    updateData[field] = value;
  }

  // Add timestamp when checkbox is checked
  if (value === true) {
    const timestamp = new Date().toISOString();
    if (field === "sp_approved") {
      updateData.sp_approved_date = timestamp;
    } else if (field === "hc_sustained") {
      updateData.hc_sustained_date = timestamp;
    }
  } else if (value === false) {
    // Clear timestamp when unchecked - use null for timestamp columns
    if (field === "sp_approved") {
      updateData.sp_approved_date = null;
    } else if (field === "hc_sustained") {
      updateData.hc_sustained_date = null;
    }
  }

  console.log("Updating:", id, "with data:", updateData);

  const { error } = await supabase
    .from("callings")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Update error:", error);
    alert(`Failed to update: ${error.message}`);
  } else {
    console.log("Update successful");
    const item = appState.callings.find((c) => c.id === id);
    // Update all fields in local state
    Object.assign(item, updateData);
    renderCards();
  }
};

function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <h2>Stake Sign In</h2>
        <form onsubmit="window.login(event)">
          <select name="authName" required>
            <option value="">Select Name...</option>
            ${appState.members.map((m) => `<option value="${m.name}">${m.name}</option>`).join("")}
          </select>
          <input id="pw-input" type="password" name="authPassword" placeholder="Password" required>
          <label>
            <input
              type="checkbox"
              onchange="document.getElementById('pw-input').type = this.checked ? 'text' : 'password'"
            >
            Show password
          </label>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  `;
}

function renderHeader() {
  const app = document.getElementById("app");
  const header = document.createElement("header");
  header.className = "main-header";
  header.innerHTML = `
    <h1>Stake Callings</h1>
    <button onclick="localStorage.clear(); location.reload();">Sign Out</button>
  `;
  app.prepend(header);

  // Create the data-list container if it doesn't exist
  if (!document.getElementById("data-list")) {
    const list = document.createElement("div");
    list.id = "data-list";
    app.appendChild(list);
  }
}

startApp();
