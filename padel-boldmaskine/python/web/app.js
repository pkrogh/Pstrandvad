// Web-app til Padel Boldmaskine. Ren JavaScript – intet build-trin.
"use strict";

const $ = (id) => document.getElementById(id);
const STATE_NAMES = {
  READY: "Klar", RUNNING: "Hjul kører", MOVING: "Justerer vinkel", HOMING: "Kalibrerer",
  NOT_HOMED: "Ikke kalibreret", FAULT: "Fejl", UNKNOWN: "Ukendt",
};

let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const command = (cmd, value) => api("POST", "/api/command", { cmd, value });

// --- Knapper ----------------------------------------------------------------
document.querySelectorAll("[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await command(btn.dataset.cmd);
      if (btn.dataset.cmd === "estop") toast("Nødstop aktiveret – tryk 'Nulstil fejl' for at fortsætte");
    } catch (e) {
      toast(e.message);
    }
  });
});

// --- Skydere: send først når brugeren slipper (færre kommandoer) -------------
function wheelSpeeds() {
  const speed = Number($("speed").value);
  const spin = Number($("spin").value);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return { left: clamp(speed - spin / 2), right: clamp(speed + spin / 2) };
}

async function sendSpeeds() {
  const { left, right } = wheelSpeeds();
  try {
    await command("left", left);
    await command("right", right);
  } catch (e) { toast(e.message); }
}

for (const id of ["speed", "spin", "angle"]) {
  const input = $(id);
  input.addEventListener("input", () => { $(`out-${id}`).textContent = input.value; });
}
$("speed").addEventListener("change", sendSpeeds);
$("spin").addEventListener("change", sendSpeeds);
$("angle").addEventListener("change", async () => {
  try { await command("angle", Number($("angle").value)); } catch (e) { toast(e.message); }
});

// --- Træningsprogrammer ------------------------------------------------------
async function loadPresets() {
  const list = $("presets");
  list.textContent = "";
  let presets = [];
  try { presets = await api("GET", "/api/presets"); } catch (e) { toast(e.message); return; }
  for (const p of presets) {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = p.name;
    const desc = document.createElement("small");
    desc.textContent = `${p.shots.length * p.repeat} bolde${p.shuffle ? " · tilfældig" : ""}` +
      (p.description ? ` · ${p.description}` : "");
    info.append(title, desc);

    const run = document.createElement("button");
    run.className = "primary";
    run.textContent = "Kør";
    run.onclick = async () => {
      try { await api("POST", "/api/drill/start", { name: p.name }); } catch (e) { toast(e.message); }
    };
    li.append(info, run);

    if (!p.builtin) {
      const del = document.createElement("button");
      del.textContent = "Slet";
      del.onclick = async () => {
        if (!confirm(`Slet "${p.name}"?`)) return;
        try { await api("DELETE", `/api/presets/${encodeURIComponent(p.name)}`); loadPresets(); }
        catch (e) { toast(e.message); }
      };
      li.append(del);
    }
    list.append(li);
  }
}

$("save-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = $("preset-name").value.trim();
  const { left, right } = wheelSpeeds();
  const drill = {
    description: "Eget program",
    repeat: Number($("preset-count").value),
    shots: [{ angle: Number($("angle").value), left, right,
              pause: Number($("preset-pause").value), name: "custom" }],
  };
  try {
    await api("PUT", `/api/presets/${encodeURIComponent(name)}`, drill);
    toast(`Gemt: ${name}`);
    loadPresets();
  } catch (e) { toast(e.message); }
});

// --- Status-polling ------------------------------------------------------------
async function poll() {
  try {
    const s = await api("GET", "/api/status");
    const m = s.machine;
    $("conn").textContent = s.connected ? "Forbundet" : "Ingen forbindelse";
    $("conn").className = `pill ${s.connected ? "ok" : "bad"}`;
    $("st-state").textContent = STATE_NAMES[m.state] || m.state;
    $("st-angle").textContent = `${m.angle.toFixed(1)}°`;
    $("st-left").textContent = `${m.left} / ${m.left_target}`;
    $("st-right").textContent = `${m.right} / ${m.right_target}`;
    $("st-fault").textContent = m.fault === "NONE" ? "Ingen" : m.fault;

    const d = s.drill;
    $("drill-status").textContent = d.running
      ? `Kører "${d.drill}": bold ${d.shots_fired + 1} af ${d.shots_total}`
      : d.error ? `Afbrudt: ${d.error}`
      : d.drill ? `"${d.drill}" færdig – ${d.shots_fired} bolde.` : "Intet program kører.";
  } catch {
    $("conn").textContent = "Server utilgængelig";
    $("conn").className = "pill bad";
  }
}

loadPresets();
poll();
setInterval(poll, 500);
