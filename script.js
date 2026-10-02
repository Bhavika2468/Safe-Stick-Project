const state = {
  battery: Number(localStorage.getItem("safestick_battery") || 76),
  threshold: Number(localStorage.getItem("safestick_threshold") || 20),
  connected: true,
  coordinates: { lat: 28.6139, lng: 77.2090 },
  locationHistory: [
    { time: "12:04 AM", coords: "28.6139° N, 77.2090° E" },
    { time: "11:58 PM", coords: "28.6144° N, 77.2082° E" },
    { time: "11:51 PM", coords: "28.6151° N, 77.2074° E" }
  ],
  activities: [
    { time: "12:04 AM", icon: "●", title: "Location updated", detail: "GPS position received", type: "location" },
    { time: "12:03 AM", icon: "▮", title: "Battery: 76%", detail: "Battery status updated", type: "battery" },
    { time: "12:01 AM", icon: "●", title: "Stick connected", detail: "STICK_001 is online", type: "connection" },
    { time: "11:58 PM", icon: "●", title: "Location updated", detail: "GPS position received", type: "location" }
  ],
  alerts: [
    {
      id: 1,
      type: "fall",
      severity: "red",
      title: "Fall detected",
      stick: "STICK_001",
      time: "12:05 AM",
      location: "Delhi, India",
      resolved: false
    },
    {
      id: 2,
      type: "battery",
      severity: "yellow",
      title: "Low battery",
      stick: "STICK_001",
      time: "Yesterday · 8:30 PM",
      location: "Delhi, India",
      resolved: true
    }
  ],
  alertFilter: "all"
};

let map;
let marker;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function currentTime() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date());
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function saveState() {
  localStorage.setItem("safestick_battery", state.battery);
  localStorage.setItem("safestick_threshold", state.threshold);
}

function navigate(page) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  const target = $(`#page-${page}`);
  if (target) target.classList.add("active");

  $$(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  const titleMap = {
    dashboard: "Dashboard",
    person: "Person",
    location: "Live Location",
    alerts: "Alerts",
    battery: "Battery",
    activity: "Activity",
    settings: "Settings"
  };

  $("#pageTitle").textContent = titleMap[page] || "Dashboard";

  if (page === "location" && map) {
    setTimeout(() => map.invalidateSize(), 150);
  }

  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBattery() {
  const battery = Math.max(0, Math.min(100, state.battery));
  const low = battery <= state.threshold;

  $("#batteryValue").textContent = `${battery}%`;
  $("#batteryBigValue").textContent = `${battery}%`;
  $("#profileBattery").textContent = `${battery}%`;
  $("#batteryFill").style.width = `${battery}%`;
  $("#batteryBigFill").style.width = `${battery}%`;
  $("#batteryFill").classList.toggle("low", low);
  $("#batteryBigFill").classList.toggle("low", low);

  $("#batteryStatus").textContent = low ? "Low" : battery <= 35 ? "Moderate" : "Good";

  const bigStatus = $("#batteryBigStatus");
  bigStatus.textContent = low ? "Low" : battery <= 35 ? "Moderate" : "Good";
  bigStatus.className = `status-chip ${low ? "danger" : battery <= 35 ? "warning" : "success"}`;

  $("#thresholdText").textContent = `${state.threshold}%`;
  $("#thresholdValue").textContent = `${state.threshold}%`;
  $("#settingsThreshold").textContent = `${state.threshold}%`;
  $("#batteryThreshold").value = state.threshold;
}

function renderConnection() {
  const online = state.connected;
  $("#connectionText").textContent = online ? "Stick Online" : "Stick Offline";
  $("#connectionPill .status-dot").className = `status-dot ${online ? "online" : "offline"}`;
  $("#personStatusChip").textContent = online ? "Online" : "Offline";
  $("#personStatusChip").className = `status-chip ${online ? "success" : "danger"}`;
  $("#profileConnection").textContent = online ? "12:04 AM" : "Disconnected";
}

function renderLocation() {
  const { lat, lng } = state.coordinates;
  const coordinateText = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  $("#locationText").textContent = coordinateText;
  $("#fullCoordinates").textContent = coordinateText;
  $("#locationUpdated").textContent = "just now";
  $("#fullLocationTime").textContent = "just now";

  if (marker && map) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  }

  const history = $("#locationHistory");
  history.innerHTML = state.locationHistory.slice(0, 5).map(item => `
    <div class="history-item">
      <strong>${item.time}</strong>
      <span>${item.coords}</span>
    </div>
  `).join("");
}

function renderActivity(targetId = "dashboardActivity", limit = 4) {
  const target = $(`#${targetId}`);
  if (!target) return;

  target.innerHTML = state.activities.slice(0, limit).map(item => `
    <div class="activity-row">
      <span class="activity-time">${item.time}</span>
      <span class="activity-icon">${item.icon}</span>
      <div>
        <strong>${item.title}</strong>
        <div class="detail">${item.detail}</div>
      </div>
      <span class="resolved">● logged</span>
    </div>
  `).join("");
}

function renderAlerts() {
  const list = $("#alertList");
  if (!list) return;

  let alerts = [...state.alerts];

  if (state.alertFilter === "unresolved") {
    alerts = alerts.filter(a => !a.resolved);
  } else if (state.alertFilter !== "all") {
    alerts = alerts.filter(a => a.type === state.alertFilter);
  }

  list.innerHTML = alerts.length ? alerts.map(alert => `
    <article class="card alert-card">
      <span class="alert-severity ${alert.severity}"></span>
      <div class="alert-main">
        <h3>${alert.title}</h3>
        <div class="alert-meta">
          <span>Stick: ${alert.stick}</span>
          <span>Time: ${alert.time}</span>
          <span>Location: ${alert.location}</span>
          <span>${alert.resolved ? "Resolved" : "Needs attention"}</span>
        </div>
      </div>
      <div class="alert-actions">
        ${!alert.resolved
          ? `<button class="resolve-button" data-resolve="${alert.id}">Mark resolved</button>`
          : `<button class="resolve-button resolved" data-resolve="${alert.id}">Resolved</button>`
        }
      </div>
    </article>
  `).join("") : `
    <article class="card">
      <p class="muted">No alerts in this category.</p>
    </article>
  `;

  const unresolved = state.alerts.filter(a => !a.resolved);
  $("#activeAlertCount").textContent = `${unresolved.length} active alert${unresolved.length === 1 ? "" : "s"}`;
  $("#alertNavBadge").textContent = unresolved.length;
  $("#alertNavBadge").style.display = unresolved.length ? "grid" : "none";
  $("#notificationDot").style.display = unresolved.length ? "block" : "none";

  const first = unresolved[0];
  $("#dashboardAlertPreview").innerHTML = first ? `
    <span class="alert-severity ${first.severity}"></span>
    <div>
      <strong>${first.title}</strong>
      <span>${first.stick} · ${first.time}</span>
    </div>
    <button class="small-button" data-page-link="alerts">Review</button>
  ` : `
    <span class="alert-severity green"></span>
    <div>
      <strong>No active emergencies</strong>
      <span>Everything looks normal</span>
    </div>
  `;
}

function renderBatteryHistory() {
  const target = $("#batteryHistory");
  if (!target) return;

  const entries = state.activities.filter(a => a.type === "battery");
  target.innerHTML = entries.length ? entries.map(item => `
    <div class="activity-row">
      <span class="activity-time">${item.time}</span>
      <span class="activity-icon">▮</span>
      <div>
        <strong>${item.title}</strong>
        <div class="detail">${item.detail}</div>
      </div>
      <span class="resolved">logged</span>
    </div>
  `).join("") : `<p class="muted" style="padding:15px 0">No battery updates yet.</p>`;
}

function renderAll() {
  renderBattery();
  renderConnection();
  renderLocation();
  renderActivity("dashboardActivity", 4);
  renderActivity("activityPageList", 30);
  renderAlerts();
  renderBatteryHistory();
}

function addActivity(title, detail, icon, type) {
  state.activities.unshift({
    time: currentTime(),
    title,
    detail,
    icon,
    type
  });
}

function addAlert(type, title, severity = "red") {
  state.alerts.unshift({
    id: Date.now(),
    type,
    severity,
    title,
    stick: "STICK_001",
    time: currentTime(),
    location: "Delhi, India",
    resolved: false
  });
}

function initializeMap() {
  if (!window.L) {
    $("#map").innerHTML = `
      <div style="height:100%;display:grid;place-items:center;color:#9099a6;padding:30px;text-align:center">
        Map library could not be loaded.<br>
        Connect to the internet or replace this area with your preferred map SDK.
      </div>
    `;
    return;
  }

  map = L.map("map", { zoomControl: true }).setView(
    [state.coordinates.lat, state.coordinates.lng],
    13
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  marker = L.marker([state.coordinates.lat, state.coordinates.lng])
    .addTo(map)
    .bindPopup("<strong>Rahul Sharma</strong><br>STICK_001 · Live location")
    .openPopup();
}

function refreshLocation() {
  // Demo-only movement. Replace this function with your API/WebSocket GPS update.
  const old = { ...state.coordinates };

  state.coordinates.lat += (Math.random() - 0.5) * 0.002;
  state.coordinates.lng += (Math.random() - 0.5) * 0.002;

  state.locationHistory.unshift({
    time: currentTime(),
    coords: `${state.coordinates.lat.toFixed(4)}° N, ${state.coordinates.lng.toFixed(4)}° E`
  });

  state.locationHistory = state.locationHistory.slice(0, 5);

  addActivity("Location updated", "GPS position received", "●", "location");
  renderAll();
  showToast(`Location refreshed from STICK_001`);
}

function simulateFall() {
  addAlert("fall", "Fall detected", "red");
  addActivity("Fall detected", "Emergency alert from STICK_001", "!", "alert");
  renderAll();
  navigate("alerts");
  showToast("Fall alert created");
}

function simulateLowBattery() {
  state.battery = Math.min(state.battery, Math.max(5, state.threshold - 1));
  saveState();
  addAlert("battery", "Low battery", "yellow");
  addActivity(`Battery: ${state.battery}%`, "Low-battery threshold reached", "▮", "battery");
  renderAll();
  navigate("battery");
  showToast(`Low battery alert: ${state.battery}%`);
}

function simulateReconnect() {
  state.connected = true;
  addActivity("Stick connected", "STICK_001 is online", "●", "connection");
  renderAll();
  showToast("STICK_001 is online");
}

/* Navigation */
$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => navigate(item.dataset.page));
});

$$("[data-page-link]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.pageLink));
});

$("#mobileMenu").addEventListener("click", () => {
  $("#sidebar").classList.add("open");
  $("#sidebarOverlay").classList.add("show");
});

$("#sidebarClose").addEventListener("click", () => {
  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("show");
});

$("#sidebarOverlay").addEventListener("click", () => {
  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("show");
});

$("#notificationButton").addEventListener("click", () => navigate("alerts"));

/* Alerts filters */
$$(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    $$(".filter-button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    state.alertFilter = button.dataset.filter;
    renderAlerts();
  });
});

$("#alertList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-resolve]");
  if (!button) return;

  const alert = state.alerts.find(a => a.id === Number(button.dataset.resolve));
  if (!alert || alert.resolved) return;

  alert.resolved = true;
  addActivity(`${alert.title} resolved`, "Caretaker marked alert as resolved", "✓", "alert");
  renderAll();
  showToast("Alert marked as resolved");
});

/* Battery */
$("#batteryThreshold").addEventListener("input", (event) => {
  state.threshold = Number(event.target.value);
  saveState();
  renderBattery();
});

$("#clearActivity").addEventListener("click", () => {
  state.activities = [];
  renderAll();
  showToast("Demo activity cleared");
});

$("#refreshLocation").addEventListener("click", refreshLocation);
$("#simulateFall").addEventListener("click", simulateFall);
$("#simulateLowBattery").addEventListener("click", simulateLowBattery);
$("#simulateReconnect").addEventListener("click", simulateReconnect);

$("#notificationsToggle").addEventListener("change", (event) => {
  showToast(event.target.checked ? "Notifications enabled" : "Notifications disabled");
});

/* Keep the sync label alive */
setInterval(() => {
  $("#lastSync").textContent = "just now";
}, 30000);

/* Initial render */
renderAll();
initializeMap();
