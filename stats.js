// ---------- Trainer stats tab ----------
// Club KPIs from the Drive KPI sheets, plus a per-trainer tracker. Automatic values come from
// the Drive / Google Sheet sources. Anything typed or overridden here is saved to the shared
// tracker sheet when TRACKER_DB.url is set (apps-script/Code.gs), otherwise in this browser.

const TRACKER_KEY = "trainerTracker.v1";
const SHARED = !!TRACKER_DB.url;
function pref(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k) || "";
    localStorage.setItem(k, v);
  } catch {}
  return "";
}
function loadLocalTracker() { try { return JSON.parse(localStorage.getItem(TRACKER_KEY)) || {}; } catch { return {}; } }
function saveLocalTracker() { try { localStorage.setItem(TRACKER_KEY, JSON.stringify(TRACKER)); } catch {} }
let TRACKER = SHARED ? {} : loadLocalTracker(); // userId -> { onboarded, cert, billing, notes }
let TRACKER_META = {}; // userId -> { updated, by } from the shared sheet
let MODEL = null;
const sortState = { clubs: { key: "club", dir: 1 }, trainers: { key: "club", dir: 1 } };

const last = (s) => (s && s.length ? s[s.length - 1] : null);
const prior = (s) => (s && s.length > 1 ? s[s.length - 2] : null);
const fmtNum = (v, d = 0) => (v == null || isNaN(v) ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtPct = (v, d = 1) => (v == null || isNaN(v) ? "—" : `${v.toFixed(d)}%`);
const fmtDate = (d) => (d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// ---------- Model ----------
function buildModel(data) {
  const staff = data.staff || [];
  const clubsBy = {};
  staff.forEach((s) => (clubsBy[s.company] ||= new Set()).add(s.club));

  const kpiByKey = new Map();
  (data.kpis || []).forEach((k) => {
    const staffClub = matchClub(k.club, [...(clubsBy[k.company] || [])]);
    const key = `${k.company}|${staffClub || k.club}`;
    kpiByKey.set(key, { ...k, key, club: staffClub || k.club, sheetName: k.club });
  });

  const adoptIdx = nameIndex(data.adoption || []);
  const onbIdx = data.onboarding ? nameIndex(data.onboarding) : null;
  const certIdx = data.certs ? nameIndex(data.certs) : null;
  const ul = data.unlogged;
  const ls = data.lostSheep;

  const trainers = staff.filter((s) => s.role === "pt" && !s.terminated).map((s) => {
    const key = `${s.company}|${s.club}`;
    const adopt = lookupName(adoptIdx, s.name) || null;
    const onb = onbIdx && lookupName(onbIdx, s.name);
    const certRow = certIdx && lookupName(certIdx, s.name);
    const certSources = [certRow && "cert list", onb && onb.certUploaded && "onboarding form",
      adopt && adopt.cert && "app adoption sheet"].filter(Boolean);
    const u = ul && ul.byTrainer.get(s.id);
    const hasPeriods = ul && ul.periods.some((p) => p.company === s.company);
    const lost = ls && ls.index[s.company] && lookupName(ls.index[s.company], s.name);
    const hasLostReport = ls && ls.reports.some((r) => r.company === s.company);
    return {
      id: s.id, name: s.name, club: s.club, company: s.company, key,
      onbSources: [onb && "onboarding sheet", ...certSources.map((x) => `cert on ${x}`)].filter(Boolean),
      certText: (certRow && (certRow.detail || "on cert list")) || (onb && onb.certUploaded && "uploaded on onboarding form")
        || (adopt && adopt.cert) || "",
      // Said they're certified (or working on it) on the form but didn't upload a cert.
      certNote: onb && !onb.certUploaded && onb.certified ? `form says "${onb.certified}", no upload` : "",
      certSources, adopt,
      unlogged: u ? u.avg : hasPeriods ? 0 : null,
      unloggedPeriods: u ? u.periods : {},
      // Lost sheep whose last session was with this trainer (0 when their brand has a report but they're not on it).
      lostSheep: lost ? lost.count : hasLostReport ? 0 : null,
      lostSheepClubs: lost ? lost.clubs : {},
    };
  });

  const clubs = new Map();
  kpiByKey.forEach((k) => clubs.set(k.key, { key: k.key, company: k.company, region: k.region, club: k.club, sheetName: k.sheetName, kpi: k.kpi }));
  trainers.forEach((t) => { if (!clubs.has(t.key)) clubs.set(t.key, { key: t.key, company: t.company, region: "", club: t.club, kpi: {} }); });
  clubs.forEach((c) => {
    // The club's gym (location) on the map tab: same stats-sheet column name, else a fuzzy name match.
    const gyms = GYMS.filter((g) => g.brand === c.company);
    c.gym = gyms.find((g) => g.name === c.sheetName)
      || gyms.find((g) => matchClub(g.name, [c.club]) || (g.label && matchClub(g.label, [c.club]))) || null;
    if (!c.region && c.gym) c.region = c.gym.region;
    const ts = trainers.filter((t) => t.key === c.key);
    ts.forEach((t) => (t.region = c.region));
    c.pts = ts.length;
    const withU = ts.filter((t) => t.unlogged != null);
    c.unlogged = mean(withU.map((t) => t.unlogged));
    // The whole club's unlogged sessions per pay period (sum of its trainers' averages).
    c.unloggedTotal = withU.length ? withU.reduce((sum, t) => sum + t.unlogged, 0) : null;
  });
  return { data, trainers, clubs: [...clubs.values()] };
}

// Effective values: a manual entry wins over the automatic one.
// A cert ticked by hand also counts toward onboarded.
const autoValue = (t, f) => (f === "cert" ? !!t.certText : t.onbSources.length > 0 || (TRACKER[t.id] || {}).cert === true);
function eff(t) {
  const r = TRACKER[t.id] || {};
  return {
    onboarded: r.onboarded ?? autoValue(t, "onboarded"),
    cert: r.cert ?? autoValue(t, "cert"),
    billing: r.billing ?? (t.adopt ? t.adopt.billing : null),
    notes: r.notes || "",
  };
}
function setTracker(id, field, value) {
  const r = (TRACKER[id] ||= {});
  if (value === undefined || value === null || value === "") delete r[field];
  else r[field] = value;
  if (!Object.keys(r).length) delete TRACKER[id];
  if (SHARED) queueSave(id);
  else saveLocalTracker();
}

// ---------- Shared tracker sheet ----------
// Reads are open; saves send the edit key (if the sheet owner set one). Edits are batched and
// sent a moment after the last change. The last save to a trainer's row wins.
const dirty = new Set();
let saveTimer = null;
let retryBy = ""; // label of a save that's waiting on the edit key or a retry
function dbStatus(text, bad) {
  $("dbStatus").textContent = text;
  $("dbStatus").classList.toggle("bad", !!bad);
}
async function dbLoad() {
  const res = await fetch(TRACKER_DB.url, { credentials: "omit" });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "couldn't read the tracker");
  const t = {}, meta = {};
  body.records.forEach((r) => {
    const x = {};
    if (r.onboarded != null) x.onboarded = r.onboarded;
    if (r.cert != null) x.cert = r.cert;
    if (r.billing != null) x.billing = r.billing;
    if (r.notes) x.notes = r.notes;
    if (Object.keys(x).length) t[r.id] = x;
    meta[r.id] = { updated: r.updated, by: r.by };
  });
  // Keep edits that haven't been sent yet.
  dirty.forEach((id) => { if (TRACKER[id]) t[id] = TRACKER[id]; else delete t[id]; });
  TRACKER = t;
  TRACKER_META = meta;
}
function queueSave(id) {
  dirty.add(id);
  dbStatus("Unsaved changes…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(dbSave, 800);
}
async function dbSave(byOverride) {
  byOverride = byOverride || retryBy;
  if (!dirty.size) return;
  const ids = [...dirty];
  dirty.clear();
  const byId = new Map(MODEL.trainers.map((t) => [t.id, t]));
  const records = ids.map((id) => {
    const r = TRACKER[id] || {}, t = byId.get(id) || {};
    return { id, name: t.name, club: t.club, onboarded: r.onboarded ?? null, cert: r.cert ?? null, billing: r.billing ?? null, notes: r.notes || "" };
  });
  dbStatus("Saving…");
  try {
    const res = await fetch(TRACKER_DB.url, {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request: no CORS preflight
      body: JSON.stringify({ key: pref("trackerEditKey"), by: byOverride || pref("trackerName"), records }),
    });
    const body = await res.json();
    if (!body.ok) {
      ids.forEach((id) => dirty.add(id));
      retryBy = byOverride || "";
      if (body.error === "bad key") {
        $("dbKeyRow").hidden = false;
        dbStatus(pref("trackerEditKey") ? "That edit key didn't work — check it and save again" : "Enter the edit key to save your changes", true);
        $("dbKey").focus();
      } else dbStatus(`Couldn't save: ${body.error}`, true);
      return;
    }
    const by = byOverride || pref("trackerName");
    ids.forEach((id) => (TRACKER_META[id] = { updated: new Date().toISOString(), by }));
    retryBy = "";
    $("dbKeyRow").hidden = true;
    dbStatus(`Saved to the shared tracker at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    if (MODEL) renderTrainers();
  } catch (err) {
    console.error(err);
    ids.forEach((id) => dirty.add(id));
    retryBy = byOverride || "";
    dbStatus("Couldn't reach the shared tracker — your changes will retry", true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(dbSave, 15000);
  }
}
async function dbRefresh() {
  if (!SHARED) return;
  dbStatus("Loading the shared tracker…");
  try {
    await dbLoad();
    dbStatus(`Shared tracker · ${Object.keys(TRACKER).length} trainers with entries`);
  } catch (err) {
    console.error(err);
    dbStatus(`Couldn't load the shared tracker: ${err.message}`, true);
  }
  // Edits saved in this browser before the shared tracker was set up.
  const n = Object.keys(loadLocalTracker()).length;
  $("dbMigrate").hidden = !n;
  $("dbMigrate").textContent = `Upload ${n} edit${n === 1 ? "" : "s"} saved in this browser`;
}

// ---------- Filters ----------
const F = () => ({ company: $("fCompany").value, region: $("fRegion").value, club: $("fClub").value });
const inFilter = (x, f) => (!f.company || x.company === f.company) && (!f.region || x.region === f.region) && (!f.club || x.key === f.club);

function fillSelect(el, values, keep) {
  const cur = keep ? el.value : "";
  el.innerHTML = `<option value="">All</option>` + values.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join("");
  el.value = values.some(([v]) => v === cur) ? cur : "";
}
function renderFilters() {
  const f = F();
  const uniq = (xs) => [...new Set(xs)].filter(Boolean).sort();
  fillSelect($("fCompany"), uniq(MODEL.clubs.map((c) => c.company)).map((c) => [c, c]), true);
  const byCo = MODEL.clubs.filter((c) => !$("fCompany").value || c.company === $("fCompany").value);
  fillSelect($("fRegion"), uniq(byCo.map((c) => c.region)).map((r) => [r, r]), true);
  const byRegion = byCo.filter((c) => !$("fRegion").value || c.region === $("fRegion").value);
  fillSelect($("fClub"), byRegion.slice().sort((a, b) => a.club.localeCompare(b.club)).map((c) => [c.key, c.club]), f.club);
}

// ---------- Tiles ----------
function renderTiles() {
  const f = F();
  const ts = MODEL.trainers.filter((t) => inFilter(t, f));
  const cs = MODEL.clubs.filter((c) => inFilter(c, f));
  const e = ts.map(eff);
  const n = ts.length;
  const onb = e.filter((x) => x.onboarded).length;
  const cert = e.filter((x) => x.cert).length;
  const ul = ts.filter((t) => t.unlogged != null);
  const periods = ((MODEL.data.unlogged || {}).periods || []).filter((p) => !f.company || p.company === f.company);
  const onApp = ts.filter((t) => t.adopt && t.adopt.onApp).length;
  const tls = ts.filter((t) => t.lostSheep != null);
  const lsRanges = [...new Set(((MODEL.data.lostSheep || {}).reports || []).filter((r) => !f.company || r.company === f.company).map((r) => r.range))].join(", ");
  const bh = cs.map((c) => last(c.kpi.billing)).filter(Boolean);
  const ls = cs.map((c) => last(c.kpi.lost)).filter(Boolean);
  const npls = cs.map((c) => last(c.kpi.lostNp)).filter(Boolean);
  const share = (x) => (n ? ` · ${Math.round((x / n) * 100)}%` : "");
  const clients = cs.map((c) => last(c.kpi.clients)).filter(Boolean);
  // [label, value, sub, tab]: each tab shows its own tiles.
  const tiles = [
    ["Clubs", fmtNum(cs.length), `${fmtNum(clients.reduce((s, x) => s + x.v, 0))} total clients`, "gyms"],
    ["Trainers", fmtNum(n), `${cs.filter((c) => c.pts).length} clubs`],
    ["Onboarded", `${onb} / ${n}`, `${n - onb} not onboarded${share(onb)}`],
    ["Cert on file", `${cert} / ${n}`, `${n - cert} missing${share(cert)}`],
    ["Avg unlogged sessions", fmtNum(mean(ul.map((t) => t.unlogged)), 2),
      `per trainer per pay period · ${[...new Set(periods.map((p) => p.label))].join(", ") || "no payroll files"}`],
    ["Lost sheep by trainer", fmtNum(tls.reduce((s, t) => s + t.lostSheep, 0)),
      `last session with ${tls.filter((t) => t.lostSheep).length} of ${n} trainers · ${lsRanges || "no lost sheep report"}`],
    ["On the app", `${onApp} / ${n}`, `matched on the app adoption sheet${share(onApp)}`],
    ["Billing health", fmtPct(mean(bh.map((x) => x.v))), `avg of ${bh.length} clubs · ${fmtDate(bh.length ? new Date(Math.max(...bh.map((x) => x.date))) : null)}`, "gyms"],
    ["Lost sheep", fmtNum(ls.reduce((s, x) => s + x.v, 0)), `${fmtNum(npls.reduce((s, x) => s + x.v, 0))} non-prospect · incl. prospects`, "gyms"],
  ];
  $("tiles").innerHTML = tiles.map(([label, value, sub, tab = "trainers"]) =>
    `<div class="tile ${tab}-only"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div><div class="tile-sub">${esc(sub)}</div></div>`).join("");
}

// ---------- Sortable tables ----------
function renderTable(el, name, cols, rows) {
  const st = sortState[name];
  const col = cols.find((c) => c.key === st.key) || cols[0];
  const v = (r) => col.sort(r);
  rows = rows.slice().sort((a, b) => {
    const x = v(a), y = v(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * st.dir;
  });
  el.innerHTML = `<thead><tr>${cols.map((c) =>
    `<th data-k="${c.key}" class="${c.num ? "num" : ""}${c.key === st.key ? (st.dir > 0 ? " asc" : " desc") : ""}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.length ? rows.map((r) => `<tr data-id="${esc(r.id || r.key)}">${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cols.length}" class="empty">Nothing matches these filters.</td></tr>`}</tbody>`;
  el.querySelectorAll("th").forEach((th) => (th.onclick = () => {
    st.dir = st.key === th.dataset.k ? -st.dir : 1;
    st.key = th.dataset.k;
    name === "clubs" ? renderClubs() : renderTrainers();
  }));
  return rows;
}

// Latest value with the change since the previous report. higherIsGood colors the change.
function kpiCell(series, { pct = false, higherIsGood = true } = {}) {
  const a = last(series), b = prior(series);
  if (!a) return "—";
  const val = pct ? fmtPct(a.v) : fmtNum(a.v);
  if (!b || a.v === b.v) return val;
  const diff = a.v - b.v;
  const good = diff > 0 === higherIsGood;
  return `${val} <span class="delta ${good ? "up" : "down"}" title="vs ${fmtDate(b.date)}">${diff > 0 ? "▲" : "▼"}${pct ? Math.abs(diff).toFixed(1) : fmtNum(Math.abs(diff))}</span>`;
}

function renderClubs() {
  const lv = (m) => (c) => (last(c.kpi[m]) || {}).v ?? null;
  const cols = [
    { key: "club", label: "Club", sort: (c) => c.club, html: (c) => `<b>${esc(c.club)}</b><span class="cell-sub">${esc([c.company, c.region].filter(Boolean).join(" · "))}</span>` },
    { key: "tags", label: "Tags", sort: (c) => tagLevel(c) * 10 + clubTags(c).length || null, html: (c) => tagsHtml(c) },
    { key: "pts", label: "Trainers", num: true, sort: (c) => c.pts, html: (c) => fmtNum(c.pts) },
    { key: "onboarded", label: "Onboarded", num: true, sort: (c) => (c.pts ? clubCounts(c).onboarded / c.pts : null), html: (c) =>
      (c.pts ? `${clubCounts(c).onboarded} / ${c.pts}` : "—") },
    { key: "clients", label: "Total clients", num: true, sort: lv("clients"), html: (c) => kpiCell(c.kpi.clients) },
    { key: "lost", label: "Lost sheep<br><small>incl. prospects</small>", num: true, sort: lv("lost"), html: (c) => kpiCell(c.kpi.lost, { higherIsGood: false }) },
    { key: "lostNp", label: "Lost sheep<br><small>non-prospect</small>", num: true, sort: lv("lostNp"), html: (c) => kpiCell(c.kpi.lostNp, { higherIsGood: false }) },
    { key: "lostPct", label: "Lost sheep %", num: true, sort: lv("lostPct"), html: (c) => kpiCell(c.kpi.lostPct, { pct: true, higherIsGood: false }) },
    { key: "billing", label: "Billing health", num: true, sort: lv("billing"), html: (c) => kpiCell(c.kpi.billing, { pct: true }) },
    { key: "late", label: "Late amounts", num: true, sort: lv("late"), html: (c) => kpiCell(c.kpi.late, { higherIsGood: false }) },
    { key: "unloggedTotal", label: "Unlogged sessions<br><small>club, per pay period</small>", num: true, sort: (c) => c.unloggedTotal, html: (c) =>
      `<span class="${c.unloggedTotal > CLUB_TAGS.unloggedMax ? "flag" : ""}">${fmtNum(c.unloggedTotal, c.unloggedTotal % 1 ? 1 : 0)}</span>` },
    { key: "unlogged", label: "Avg unlogged<br><small>per trainer</small>", num: true, sort: (c) => c.unlogged, html: (c) => fmtNum(c.unlogged, 2) },
  ];
  const show = $("cShow").value;
  const rows = MODEL.clubs.filter((c) => inFilter(c, F()) && (!show || tagLevel(c) >= (show === "bad" ? 2 : 1)));
  renderTable($("clubTable"), "clubs", cols, rows);
  const dates = rows.map((c) => last(c.kpi.clients)).filter(Boolean).map((x) => +x.date);
  $("kpiDate").textContent = dates.length ? `Latest report ${fmtDate(new Date(Math.max(...dates)))} · ▲▼ = change since the report before` : "";
}

function renderTrainers() {
  const f = F();
  const q = norm($("tSearch").value);
  const show = $("tShow").value;
  const rows = MODEL.trainers.filter((t) => {
    if (!inFilter(t, f)) return false;
    if (q && !norm(t.name).includes(q)) return false;
    const e = eff(t);
    if (show === "notOnboarded" && e.onboarded) return false;
    if (show === "noCert" && e.cert) return false;
    if (show === "unlogged" && !(t.unlogged > 0)) return false;
    if (show === "lostSheep" && !(t.lostSheep > 0)) return false;
    return true;
  });
  const manual = (t, f) => (TRACKER[t.id] || {})[f] !== undefined;
  const byWho = (t) => { const m = TRACKER_META[t.id]; return m && m.by ? `set by ${esc(m.by)}` : "set by hand"; };
  const resetLink = (t, f) => (manual(t, f) ? ` <button type="button" class="link reset" data-reset="${f}" title="Go back to the automatic value">reset</button>` : "");
  const cols = [
    { key: "name", label: "Trainer", sort: (t) => t.name, html: (t) => `<b>${esc(t.name)}</b><span class="cell-sub">${esc(t.company)}</span>` },
    { key: "club", label: "Club", sort: (t) => `${t.club}|${t.name}`, html: (t) => `${esc(t.club)}<span class="cell-sub">${esc(t.region)}</span>` },
    { key: "onboarded", label: "Onboarded", sort: (t) => +eff(t).onboarded, html: (t) =>
      `<label class="yn"><input type="checkbox" data-f="onboarded" ${eff(t).onboarded ? "checked" : ""}> ${eff(t).onboarded ? "Yes" : "No"}</label>
       <span class="cell-sub">${manual(t, "onboarded") ? byWho(t) : esc(t.onbSources.join(", ") || "not on onboarding sheet")}${resetLink(t, "onboarded")}</span>` },
    { key: "cert", label: "Cert on file", sort: (t) => +eff(t).cert, html: (t) =>
      `<label class="yn"><input type="checkbox" data-f="cert" ${eff(t).cert ? "checked" : ""}> ${eff(t).cert ? "Yes" : "No"}</label>
       <span class="cell-sub">${manual(t, "cert") ? byWho(t) : esc(t.certText || t.certNote)}${resetLink(t, "cert")}</span>` },
    { key: "lostSheep", label: "Lost sheep<br><small>last session with them</small>", num: true, sort: (t) => t.lostSheep, html: (t) =>
      `<span title="${esc(Object.entries(t.lostSheepClubs).map(([c, n]) => `${c}: ${n}`).join(", ") || "none on the lost sheep report")}">${fmtNum(t.lostSheep)}</span>` },
    { key: "billing", label: "Billing health %", num: true, sort: (t) => eff(t).billing, html: (t) => {
      const auto = t.adopt && t.adopt.billing != null ? t.adopt.billing : "";
      const v = (TRACKER[t.id] || {}).billing;
      const m = TRACKER_META[t.id];
      return `<input type="number" min="0" max="100" step="0.1" class="cell-input${eff(t).billing != null && eff(t).billing < 90 ? " warn" : ""}" data-f="billing" value="${v ?? ""}" placeholder="${auto === "" ? "—" : auto}"${auto === "" ? "" : ` title="From the app adoption sheet: ${auto}%"`}>`
        + (v != null && m && /billing report/i.test(m.by) ? `<span class="cell-sub">${esc(m.by.replace(/^.*?(billing report)/i, "$1"))}</span>` : "");
    } },
    { key: "app", label: "App", sort: (t) => (t.adopt ? t.adopt.adoption ?? (t.adopt.onApp ? 0 : -1) : null), html: (t) => t.adopt
      ? `${t.adopt.onApp ? "On app" : "Not on app"}<span class="cell-sub">${fmtPct(t.adopt.adoption, 0)} clients · ${fmtPct(t.adopt.completion, 0)} complete</span>`
      : `<span class="cell-sub">not on adoption sheet</span>` },
    { key: "unlogged", label: "Avg unlogged<br><small>sessions</small>", num: true, sort: (t) => t.unlogged, html: (t) =>
      `<span class="${t.unlogged > 0 ? "flag" : ""}" title="${esc(Object.entries(t.unloggedPeriods).map(([p, n]) => `${p}: ${n}`).join(", ") || "none in the payroll comparisons")}">${fmtNum(t.unlogged, t.unlogged % 1 ? 1 : 0)}</span>` },
    { key: "notes", label: "Notes", sort: (t) => eff(t).notes || null, html: (t) =>
      `<input type="text" class="cell-input notes" data-f="notes" value="${esc(eff(t).notes)}" placeholder="Add a note">` },
  ];
  renderTable($("trainerTable"), "trainers", cols, rows);
}

// Edits in the tracker table.
$("trainerTable").addEventListener("change", (e) => {
  const el = e.target, f = el.dataset.f, tr = el.closest("tr");
  if (!f || !tr) return;
  const t = MODEL.trainers.find((x) => x.id === tr.dataset.id);
  if (el.type === "checkbox") {
    // Store an override only when it differs from the automatic value.
    setTracker(t.id, f, el.checked === autoValue(t, f) ? undefined : el.checked);
    renderTrainers();
  } else if (el.type === "number") {
    setTracker(t.id, f, el.value === "" ? undefined : +el.value);
    if (f === "billing") el.classList.toggle("warn", eff(t).billing != null && eff(t).billing < 90);
  } else {
    setTracker(t.id, f, el.value.trim() || undefined);
  }
  renderTiles();
});
$("trainerTable").addEventListener("click", (e) => {
  const b = e.target.closest("[data-reset]");
  if (!b) return;
  setTracker(b.closest("tr").dataset.id, b.dataset.reset, undefined);
  renderTrainers();
  renderTiles();
});

// ---------- Export / import ----------
const CSV_COLS = ["User ID", "Trainer", "Company", "Region", "Club", "Onboarded", "Onboarded via", "Cert on file", "Cert",
  "Lost sheep", "Billing health %", "On app", "Client adoption %", "Avg unlogged sessions", "Notes"];
const csvCell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));

$("exportBtn").onclick = () => {
  const lines = [CSV_COLS.join(",")];
  MODEL.trainers.slice().sort((a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name)).forEach((t) => {
    const e = eff(t);
    lines.push([t.id, t.name, t.company, t.region, t.club, e.onboarded ? "Yes" : "No",
      (TRACKER[t.id] || {}).onboarded !== undefined ? "set by hand" : t.onbSources.join("; "),
      e.cert ? "Yes" : "No", t.certText || t.certNote, t.lostSheep ?? "", e.billing ?? "",
      t.adopt ? (t.adopt.onApp ? "Yes" : "No") : "", t.adopt && t.adopt.adoption != null ? t.adopt.adoption : "",
      t.unlogged ?? "", e.notes].map(csvCell).join(","));
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `trainer-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$("importFile").onchange = async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const [head, ...rows] = parseCSV(await file.text());
  const h = head.map((x) => x.trim().toLowerCase());
  const col = (name) => h.indexOf(name.toLowerCase());
  const byId = new Map(MODEL.trainers.map((t) => [t.id, t]));
  const byName = nameIndex(MODEL.trainers);
  const yes = (v) => /^(y|yes|true|1)$/i.test(String(v).trim());
  let n = 0;
  rows.forEach((r) => {
    const t = byId.get((r[col("User ID")] || "").trim()) || lookupName(byName, r[col("Trainer")] || "");
    if (!t) return;
    ["cert", "onboarded"].forEach((f) => {
      const i = col(f === "cert" ? "Cert on file" : "Onboarded");
      if (i >= 0 && r[i]) setTracker(t.id, f, yes(r[i]) === autoValue(t, f) ? undefined : yes(r[i]));
    });
    const bh = col("Billing health %"), nt = col("Notes");
    if (bh >= 0 && r[bh] !== "" && +r[bh] !== (t.adopt && t.adopt.billing)) setTracker(t.id, "billing", +r[bh]);
    if (nt >= 0 && r[nt]) setTracker(t.id, "notes", r[nt]);
    n++;
  });
  renderAll();
  $("statsStatus").textContent = `Imported ${n} trainer${n === 1 ? "" : "s"} from ${file.name}`;
};

// ---------- Billing report ----------
// Client-level report (Client Name, Trainer, Status, Days Overdue, …, Location). A trainer's billing
// health = clients with status "Good" ÷ all their clients. Only the per-trainer percentage is kept;
// client names are never stored or sent anywhere.
async function importBillingReport(file) {
  const [head, ...rows] = parseCSV(await file.text());
  const h = (head || []).map((x) => x.replace(/^\uFEFF/, "").trim().toLowerCase());
  const C = { trainer: h.indexOf("trainer"), status: h.indexOf("status"), loc: h.indexOf("location") };
  if (C.trainer < 0 || C.status < 0) throw new Error("expected Trainer and Status columns");
  // Grouped by brand (from Location) as well as name: other brands in the report can share names.
  const per = new Map();
  rows.forEach((r) => {
    const name = (r[C.trainer] || "").trim();
    const company = companyOf(C.loc >= 0 ? r[C.loc] || "" : "");
    if (!name || /^unassigned$/i.test(name) || (C.loc >= 0 && company === "Other")) return;
    const key = `${company}|${name}`;
    const p = per.get(key) || { name, company, total: 0, good: 0 };
    p.total++;
    if (/^good$/i.test((r[C.status] || "").trim())) p.good++;
    per.set(key, p);
  });
  const byCompany = {};
  const unmatched = [];
  let matched = 0;
  per.forEach((p) => {
    const pool = C.loc >= 0 ? MODEL.trainers.filter((t) => t.company === p.company) : MODEL.trainers;
    const t = lookupName((byCompany[p.company] ||= nameIndex(pool)), p.name);
    if (!t) { unmatched.push(p.name); return; }
    setTracker(t.id, "billing", Math.round((p.good / p.total) * 1000) / 10);
    matched++;
  });
  const date = (file.name.match(/\d{4}-\d{2}-\d{2}/) || [new Date().toISOString().slice(0, 10)])[0];
  if (SHARED) { clearTimeout(saveTimer); await dbSave(`Billing report ${date}`); }
  renderAll();
  return { matched, unmatched, trainers: per.size };
}

$("billingFile").onchange = async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file || !MODEL) return;
  try {
    const r = await importBillingReport(file);
    $("statsStatus").textContent = `Billing report: updated ${r.matched} of ${r.trainers} trainers` +
      (r.unmatched.length ? ` · not on the current staff lists: ${r.unmatched.length} (see console)` : "");
    if (r.unmatched.length) console.info("Billing report trainers not matched to a current trainer:", r.unmatched);
  } catch (err) {
    $("statsStatus").textContent = `Couldn't read the billing report: ${err.message}`;
  }
};

// ---------- Sources ----------
function renderSources(data) {
  const st = data.status || {};
  const line = (name, ok, text) => `<li class="${ok ? "ok" : "bad"}"><b>${esc(name)}</b> — ${text}</li>`;
  const err = (k) => esc((st[k] || {}).error || "not loaded");
  const ul = data.unlogged;
  const items = [
    line("Drive folder", st.drive && st.drive.ok, data.drive
      ? `read ${esc(new Date(data.drive.generated).toLocaleString())} (re-read every 3 hours)${data.drive.errors.length ? ` · couldn't read: ${esc(data.drive.errors.join("; "))}` : ""}` : err("drive")),
    line("Staff lists", st.staff && st.staff.ok, data.staffFiles ? `${esc(data.staffFiles.join(", "))} · ${MODEL.trainers.length} active trainers` : err("staff")),
    line("Club KPI sheets", st.kpis && st.kpis.ok, data.kpis ? `${data.kpis.length} clubs from the ${esc(Object.keys(STATS_SHEETS).join(" and "))} stats sheets` : err("kpis")),
    line("Unlogged sessions", st.unlogged && st.unlogged.ok, ul ? ul.periods.map((p) =>
      `${esc(p.company)} ${esc(p.label)}: ${p.total} sessions across ${p.trainers} PTs`).join(" · ") || "no payroll comparison files" : err("unlogged")),
    line("Lost sheep reports", st.lostSheep && st.lostSheep.ok, data.lostSheep ? data.lostSheep.reports.map((r) =>
      `${esc(r.company)}${r.range ? ` ${esc(r.range)}` : ""}: ${fmtNum(r.total)} lost sheep · ${fmtNum(r.total - r.noBooking)} with a last session, across ${r.trainers} trainers · ${MODEL.trainers.filter((t) => t.company === r.company && t.lostSheep).length} matched to current PTs`).join(" · ") || "no lost sheep reports" : err("lostSheep")),
    line("App adoption sheet", st.adoption && st.adoption.ok, data.adoption
      ? `${data.adoption.length} rows · ${MODEL.trainers.filter((t) => t.adopt).length} matched to current PTs` : err("adoption")),
    line("Onboarding sheet", st.onboarding && st.onboarding.ok, data.onboarding
      ? `${data.onboarding.length} responses · ${MODEL.trainers.filter((t) => t.onbSources.includes("onboarding sheet")).length} matched to current PTs · ${data.onboarding.filter((x) => x.certUploaded).length} cert uploads`
      : /401|403|shared|failed to fetch/i.test(err("onboarding")) ? "can't read it yet — share the sheet as \"Anyone with the link can view\"" : err("onboarding")),
    line("Certifications", !!data.certs, data.certs ? `${data.certs.length} on the cert list` : "no separate cert list (CERT_SHEET in data.js) — using onboarding form uploads and the Cert column of the app adoption sheet"),
    line("Trainer tracker", !SHARED || !$("dbStatus").classList.contains("bad"), SHARED
      ? esc($("dbStatus").textContent) : "saved in this browser only — set TRACKER_DB.url in data.js to share it (see apps-script/README.md)"),
  ];
  $("sourceList").innerHTML = items.join("");
}

// ---------- Map view ----------
// Clubs drawn at their gym's location (GYMS in data.js): size = trainers, color = the chosen measure.
let statsView = pref("statsView") === "map" ? "map" : "table";
let smap = null, smapLayer = null, smapFit = true;
function clubCounts(c) {
  const ts = MODEL.trainers.filter((t) => t.key === c.key);
  const e = ts.map(eff);
  return {
    ts, onboarded: e.filter((x) => x.onboarded).length, cert: e.filter((x) => x.cert).length,
    onApp: ts.filter((t) => t.adopt && t.adopt.onApp).length,
  };
}
// Tags (thresholds in CLUB_TAGS): level 2 = red "worse" tag, 1 = tag.
function clubTags(c) {
  const tags = [];
  const bh = (last(c.kpi.billing) || {}).v;
  if (bh != null && bh < CLUB_TAGS.billingBad) tags.push({ level: 2, text: `Billing < ${CLUB_TAGS.billingBad}%` });
  else if (bh != null && bh < CLUB_TAGS.billingWarn) tags.push({ level: 1, text: `Billing < ${CLUB_TAGS.billingWarn}%` });
  if (c.pts && !clubCounts(c).onboarded) tags.push({ level: 1, text: "None onboarded" });
  const lp = (last(c.kpi.lostPct) || {}).v;
  if (lp != null && lp > CLUB_TAGS.lostPctMax) tags.push({ level: 1, text: `Lost sheep > ${CLUB_TAGS.lostPctMax}%` });
  if (c.unloggedTotal > CLUB_TAGS.unloggedMax) tags.push({ level: 1, text: `Unlogged > ${CLUB_TAGS.unloggedMax}` });
  return tags;
}
const tagLevel = (c) => Math.max(0, ...clubTags(c).map((t) => t.level));
const tagsHtml = (c) => clubTags(c).map((t) => `<span class="tag ${t.level === 2 ? "bad" : "warn"}">${esc(t.text)}</span>`).join("")
  || `<span class="tag ok">none</span>`;

const share = (k) => (c, n) => (c.pts ? (n[k] / c.pts) * 100 : null);
const latestKpi = (m) => (c) => (last(c.kpi[m]) || {}).v ?? null;
// absolute: 0-100% scale; otherwise colored relative to the other clubs shown.
const SMAP_MODES = {
  tags: { label: "Tags", value: (c) => tagLevel(c), tOf: (v) => 1 - v / 2, fmt: (v) => ["no tags", "tagged", "red tag"][v],
    legend: "green = no tags · amber = tagged · red = billing under " + CLUB_TAGS.billingBad + "%" },
  onboarded: { label: "Onboarded %", value: share("onboarded"), absolute: true },
  cert: { label: "Cert on file %", value: share("cert"), absolute: true },
  onApp: { label: "Trainers on the app %", value: share("onApp"), absolute: true },
  unloggedTotal: { label: "Unlogged sessions (club)", value: (c) => c.unloggedTotal, lowerIsBetter: true, fmt: (v) => fmtNum(v, 1) },
  unlogged: { label: "Avg unlogged sessions", value: (c) => c.unlogged, lowerIsBetter: true, fmt: (v) => fmtNum(v, 2) },
  billing: { label: "Billing health", value: latestKpi("billing"), fmt: (v) => fmtPct(v) },
  lostPct: { label: "Lost sheep %", value: latestKpi("lostPct"), lowerIsBetter: true, fmt: (v) => fmtPct(v) },
};
// Red (worse) -> amber -> green (better), matching the map tab.
function rampColor(t) {
  const stops = [[214, 40, 40], [240, 170, 30], [42, 157, 75]];
  const x = Math.max(0, Math.min(1, t)) * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  return `rgb(${stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f)).join(",")})`;
}

function ensureStatsMap() {
  if (smap) return;
  smap = L.map("statsMap").setView([36.5, -92], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(smap);
  smapLayer = L.layerGroup().addTo(smap);
  smap.on("popupopen", (e) => {
    const a = e.popup.getElement().querySelector("[data-open-club]");
    if (a) a.onclick = (ev) => { ev.preventDefault(); openClubInTable(a.dataset.openClub); };
  });
}

function clubPopup(c, n) {
  const yn = (v) => (v ? `<span class="yes">✓</span>` : `<span class="no">✗</span>`);
  const row = (label, v) => `<tr><td>${label}</td><td class="num">${v}</td></tr>`;
  const of = (x) => `${x} / ${c.pts}`;
  const trainers = n.ts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => {
    const e = eff(t);
    return `<li>${esc(t.name)} — ${yn(e.onboarded)} onboarded ${yn(e.cert)} cert${t.unlogged ? ` · ${fmtNum(t.unlogged, t.unlogged % 1 ? 1 : 0)} unlogged` : ""}</li>`;
  }).join("");
  return `<div class="club-pop"><b>${esc(c.club)}</b> <span class="muted">${esc([c.company, c.region].filter(Boolean).join(" · "))}</span>
    <div>${tagsHtml(c)}</div>
    <table class="stats">
      ${row("Trainers", c.pts)}
      ${row("Onboarded", of(n.onboarded))}
      ${row("Cert on file", of(n.cert))}
      ${row("On the app", of(n.onApp))}
      ${row("Unlogged sessions (club, per pay period)", fmtNum(c.unloggedTotal, c.unloggedTotal % 1 ? 1 : 0))}
      ${row("Avg unlogged per trainer", fmtNum(c.unlogged, 2))}
      ${row("Billing health", fmtPct(latestKpi("billing")(c)))}
      ${row("Lost sheep %", fmtPct(latestKpi("lostPct")(c)))}
      ${row("Total clients", fmtNum(latestKpi("clients")(c)))}
    </table>
    ${trainers ? `<ul class="trainers">${trainers}</ul>` : `<div class="muted">No trainers on the staff list.</div>`}
    <a href="#" data-open-club="${esc(c.key)}">Open in the table</a></div>`;
}

function renderStatsMap() {
  if (!smap) return;
  const mode = SMAP_MODES[$("sColorBy").value] || SMAP_MODES.onboarded;
  const shown = MODEL.clubs.filter((c) => c.gym && inFilter(c, F()));
  const vals = shown.map((c) => { const n = clubCounts(c); return { c, n, v: mode.value(c, n) }; });
  const known = vals.map((x) => x.v).filter((v) => v != null);
  const min = Math.min(...known), max = Math.max(...known);
  smapLayer.clearLayers();
  vals.forEach(({ c, n, v }) => {
    let t = v == null ? null : mode.tOf ? mode.tOf(v) : mode.absolute ? v / 100 : max > min ? (v - min) / (max - min) : 0.5;
    if (t != null && mode.lowerIsBetter) t = 1 - t;
    const shownVal = v == null ? "—" : mode.fmt ? mode.fmt(v) : fmtPct(v, 0);
    L.circleMarker([c.gym.lat, c.gym.lng], {
      radius: 5 + Math.sqrt(c.pts) * 2.5, color: "#fff", weight: 1.5, fillOpacity: 0.9,
      fillColor: t == null ? "#9aa0a6" : rampColor(t),
    }).bindTooltip(`<b>${esc(c.club)}</b><br>${esc(mode.label)}: ${shownVal} · ${c.pts} trainer${c.pts === 1 ? "" : "s"}`, { direction: "top" })
      .bindPopup(() => clubPopup(c, clubCounts(c)), { maxWidth: 340, minWidth: 260 })
      .addTo(smapLayer);
  });
  $("sLegend").innerHTML = `<span class="ramp"></span><span class="muted">${mode.legend || (mode.absolute ? "0% → 100%" : "worse → better, relative to the clubs shown")}
    · gray = no data · bigger = more trainers · ${MODEL.clubs.filter((c) => !c.gym && inFilter(c, F())).length || "no"} clubs without a map location</span>`;
  if (smapFit && vals.length) {
    smap.fitBounds(L.latLngBounds(vals.map(({ c }) => [c.gym.lat, c.gym.lng])).pad(0.15), { maxZoom: 11 });
    smapFit = false;
  }
}

function setStatsView(v) {
  statsView = v;
  pref("statsView", v);
  document.querySelectorAll("#statsViewButtons button").forEach((b) => b.classList.toggle("on", b.dataset.sview === v));
  $("view-stats").classList.toggle("stats-mapmode", v === "map");
  $("statsMapCard").hidden = v !== "map";
  if (v === "map" && MODEL && statsTab() === "gyms") {
    ensureStatsMap();
    smap.invalidateSize();
    renderStatsMap();
  }
}

function openClubInTable(key) {
  const c = MODEL.clubs.find((x) => x.key === key);
  if (!c) return;
  $("fCompany").value = c.company; renderFilters();
  $("fRegion").value = c.region; renderFilters();
  $("fClub").value = c.key; renderFilters();
  smapFit = true;
  showView("trainers");
  renderAll();
  $("trainerTable").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Render ----------
function renderAll() {
  if (!MODEL) return;
  renderTiles();
  renderClubs();
  renderTrainers();
  if (statsView === "map") setStatsView("map");
}

document.addEventListener("dataloaded", async (e) => {
  const data = e.detail;
  MODEL = buildModel(data);
  renderFilters();
  await dbRefresh();
  renderAll();
  renderSources(data);
  const bad = Object.entries(data.status || {}).filter(([, s]) => !s.ok).map(([k]) => k);
  $("statsStatus").textContent = `Live from Drive · loaded ${data.loaded.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` +
    (bad.length ? ` · ${bad.length} source${bad.length === 1 ? "" : "s"} unavailable (see Sources)` : "");
  $("statsRefresh").disabled = false;
});

["fCompany", "fRegion", "fClub"].forEach((id) => ($(id).onchange = () => { renderFilters(); smapFit = true; renderAll(); }));
$("sColorBy").innerHTML = Object.entries(SMAP_MODES).map(([k, m]) => `<option value="${k}">${esc(m.label)}</option>`).join("");
$("sColorBy").value = pref("statsColorBy") in SMAP_MODES ? pref("statsColorBy") : "onboarded";
$("sColorBy").onchange = () => { pref("statsColorBy", $("sColorBy").value); renderStatsMap(); };
document.querySelectorAll("#statsViewButtons button").forEach((b) => (b.onclick = () => { smapFit = true; setStatsView(b.dataset.sview); }));
setStatsView(statsView);
$("tSearch").oninput = renderTrainers;
$("cShow").onchange = renderClubs;
$("dbBar").hidden = !SHARED;
$("dbName").value = pref("trackerName");
$("dbName").onchange = () => pref("trackerName", $("dbName").value.trim());
$("dbKeySave").onclick = () => { pref("trackerEditKey", $("dbKey").value.trim()); dbSave(); };
$("dbKey").onkeydown = (e) => { if (e.key === "Enter") $("dbKeySave").click(); };
$("dbMigrate").onclick = () => {
  Object.entries(loadLocalTracker()).forEach(([id, r]) => {
    delete r.lostSheep; // now comes from the lost sheep report
    if (Object.keys(r).length) { TRACKER[id] = { ...TRACKER[id], ...r }; dirty.add(id); }
  });
  try { localStorage.removeItem(TRACKER_KEY); } catch {}
  $("dbMigrate").hidden = true;
  renderAll();
  dbSave();
};
window.addEventListener("beforeunload", (e) => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });
$("tShow").onchange = renderTrainers;
$("statsRefresh").onclick = () => {
  $("statsStatus").textContent = "Reloading…";
  $("statsRefresh").disabled = true;
  loadAllData(true);
};

// ---------- Tabs ----------
// "gyms" and "trainers" are two tabs over the same stats page (shared filters and data).
const STATS_TABS = { gyms: "Gym stats", trainers: "Trainer stats" };
const statsTab = () => (!$("view-stats").hidden && ["gyms", "trainers"].find((t) => $("view-stats").classList.contains(`mode-${t}`))) || "";
function showView(name) {
  document.querySelectorAll("#tabs .tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === name));
  const view = STATS_TABS[name] ? "stats" : name;
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  Object.keys(STATS_TABS).forEach((t) => $("view-stats").classList.toggle(`mode-${t}`, t === name));
  if (STATS_TABS[name]) $("statsTitle").textContent = STATS_TABS[name];
  pref("activeTab", name);
  document.dispatchEvent(new CustomEvent("viewchange", { detail: name }));
  if (name === "gyms" && statsView === "map") setStatsView("map");
}
document.querySelectorAll("#tabs .tab").forEach((t) => (t.onclick = () => showView(t.dataset.view)));
{
  const saved = pref("activeTab") === "stats" ? "trainers" : pref("activeTab"); // "stats" = the old combined tab
  if (STATS_TABS[saved] || saved === "rates") showView(saved);
}

loadAllData();
