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
let TRACKER = SHARED ? {} : loadLocalTracker(); // userId -> { onboarded, cert, billing, notes, certLink, certExpires }
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
  // Clients on the app per trainer (data.drive.appClients: a Lumin snapshot or a billing health export).
  const appRows = (data.drive && data.drive.appClients && data.drive.appClients.rows) || [];
  const findApp = appMatcher(appRows);
  const onbIdx = data.onboarding ? nameIndex(data.onboarding) : null;
  const certIdx = data.certs ? nameIndex(data.certs) : null;
  const ul = data.unlogged;
  const ls = data.lostSheep;

  const trainers = staff.filter((s) => s.role === "pt" && !s.terminated).map((s) => {
    const key = `${s.company}|${s.club}`;
    const adopt = appAdoption(lookupName(adoptIdx, s.name) || null, findApp(s), appRows.length > 0);
    const onb = onbIdx && lookupName(onbIdx, s.name);
    // (onbForm: filled in the onboarding form, i.e. on the onboarding sheet)
    const certRow = certIdx && lookupName(certIdx, s.name);
    const certSources = [certRow && "cert list", onb && onb.certUploaded && "onboarding form",
      adopt && adopt.cert && "app adoption sheet"].filter(Boolean);
    const u = ul && ul.byTrainer.get(s.id);
    const hasPeriods = ul && ul.periods.some((p) => p.company === s.company);
    const lost = ls && ls.index[s.company] && lookupName(ls.index[s.company], s.name);
    const hasLostReport = ls && ls.reports.some((r) => r.company === s.company);
    return {
      id: s.id, name: s.name, club: s.club, company: s.company, key, hired: s.hired, onbForm: !!onb,
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

// App adoption = the trainer's clients in the billing health export (billed through the app) ÷ their
// total clients on the app adoption sheet, capped at 100%. Without the export, the sheet's own
// adoption % is used. Workout completion and the rest still come from the adoption sheet.
// Matches a staff member to their app row. Lumin shows trainers as first name + last initial
// ("Aaron S."): match on brand + first name + initial, and when two share that, on club too.
// Billing export rows have full names: match by name within the brand.
function appMatcher(rows) {
  const short = /^(\S+)\s+(\S)\.?$/;
  const byKey = new Map(), full = {};
  rows.forEach((r) => {
    const m = norm(String(r.trainer).replace(/\([^)]*\)/g, " ")).match(short); // drop "(nickname)"
    if (m) {
      const k = `${r.company}|${m[1]}|${m[2]}`;
      (byKey.get(k) || byKey.set(k, []).get(k)).push(r);
    } else (full[r.company] ||= []).push(r);
  });
  const fullIdx = Object.fromEntries(Object.entries(full).map(([co, rs]) => [co, nameIndex(rs, (r) => r.trainer)]));
  return (s) => {
    const parts = norm(s.name).split(" ").filter((p, i, all) => !(i > 1 && i === all.length - 1 && /^(jr|sr|ii|iii|iv)$/.test(p)));
    const cands = byKey.get(`${s.company}|${parts[0]}|${(parts[parts.length - 1] || "")[0]}`) || [];
    const atClub = cands.filter((r) => (r.clubs || []).some((c) => matchClub(c, [s.club])));
    if (atClub.length === 1) return atClub[0];
    if (!atClub.length && cands.length === 1) return cands[0];
    return fullIdx[s.company] ? lookupName(fullIdx[s.company], s.name) || null : null;
  };
}

function appAdoption(sheet, app, haveExport) {
  if (!haveExport) return sheet;
  const clients = app ? app.clients : 0;
  if (!sheet && !app) return null;
  const total = sheet ? sheet.totalClients : null;
  return {
    ...(sheet || {}),
    onApp: clients > 0 || !!(sheet && sheet.onApp),
    clientsInApp: clients,
    totalClients: total,
    adoption: total ? Math.min(100, (clients / total) * 100) : null,
    rating: app && app.rating != null ? app.rating : sheet ? sheet.stars : null,
    reviews: app ? app.reviews || 0 : null,
    inLumin: !!app, // has a Lumin Pro account (matched in the Lumin snapshot), even with 0 clients
    fromExport: true,
  };
}

// Hire date ("YYYY-MM-DD", the staff list's "date added") and time since.
const fmtHired = (d) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
function tenure(d) {
  const months = Math.floor((Date.now() - new Date(`${d}T12:00`)) / (30.44 * 864e5));
  if (months < 1) return "new this month";
  return months < 12 ? `${months} mo` : `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ""}`;
}

// Effective values: a manual entry wins over the automatic one.
// A cert ticked by hand, or a complete onboarding checklist, also counts toward onboarded.
const autoValue = (t, f) => (f === "cert" ? !!t.certText
  : t.onbSources.length > 0 || (TRACKER[t.id] || {}).cert === true || checklistProgress(t.id).complete);

// ---------- Onboarding checklist ----------
// ONBOARDING_CHECKLIST (data.js); each trainer's ticks are TRACKER[id].checklist =
// { itemId: { d: "YYYY-MM-DD", by } | "na" } ("na" = an optional item marked not needed).
// Onboarding % counts those items plus a cert on file (the tracker's Cert on file). Automatic ticks:
// - hired more than ONBOARDED_AFTER_MONTHS ago (staff list hire date): every item, so they're at 100%
//   with a cert on file, or one short of it without;
// - a cert on file and the onboarding form filled in: the whole first section (Week 1).
const ONBOARDED_AFTER_MONTHS = 3;
// Items ticked from the data we have (thresholds in ONBOARDING_AUTO, data.js). Each returns the reason
// shown on the onboarding page, or "" when the data doesn't show it. Worked out on every load, so a
// tick comes off again if the numbers drop.
function dataChecks(t) {
  const A = ONBOARDING_AUTO, a = t.adopt || {}, r = TRACKER[t.id] || {};
  const billing = r.billing ?? a.billing ?? null;
  const full = a.adoption != null && a.adoption >= A.adoptionPct;
  const adoptWhy = !full ? "" : a.clientsInApp > a.totalClients
    ? `100% adoption (${fmtNum(a.clientsInApp)} active in Lumin, ${fmtNum(a.totalClients)} total on the adoption sheet)`
    : `100% adoption (all ${fmtNum(a.totalClients)} clients in Lumin)`;
  const comp = a.completion != null ? a.completion : null;
  return {
    lumin_app: a.inLumin ? "has a Lumin Pro account" : "",
    clients_app: adoptWhy,
    clients_lumin: adoptWhy,
    app_every_client: adoptWhy,
    workout_cards: full && comp > 0 ? `${adoptWhy}, completing ${fmtPct(comp, 0)} of their workouts` : "",
    app_workouts: full && comp >= A.completionPct ? `${adoptWhy}, ${fmtPct(comp, 0)} workout completion` : "",
    progress_tracked: comp >= A.completionPct ? `${fmtPct(comp, 0)} workout completion (adoption sheet)` : "",
    high_energy: a.rating >= A.minRating && (a.reviews || 0) >= A.minReviews ? `★ ${a.rating.toFixed(1)} from ${fmtNum(a.reviews)} Lumin reviews` : "",
    billing_health: billing != null && billing >= A.billingPct ? `billing health ${fmtPct(billing, 0)}` : "",
  };
}
const CHECK_ITEMS = ONBOARDING_CHECKLIST.flatMap((s) => s.items);
function hiredOver(t, months) {
  if (!t || !t.hired) return false;
  const d = new Date(`${t.hired}T12:00`);
  d.setMonth(d.getMonth() + months);
  return d <= new Date();
}
const AUTO_WEEK1 = new Set(ONBOARDING_CHECKLIST[0].items.map((i) => i.id));
let DB_HAS_CHECKLIST = true; // false when the tracker's Apps Script predates the checklist column
const trainerById = (id) => (MODEL._byId ||= new Map(MODEL.trainers.map((t) => [t.id, t]))).get(id);
function checklistProgress(id) {
  const t = MODEL && trainerById(id), r = TRACKER[id] || {}, c = r.checklist || {};
  // Cert as on the tracker, worked out directly (eff() would loop back here through onboarded).
  const certOn = !!t && (r.cert ?? !!t.certText);
  const tenured = hiredOver(t, ONBOARDED_AFTER_MONTHS);
  const auto = !tenured && certOn && !!t.onbForm;
  const data = t ? dataChecks(t) : {};
  // Why an item is ticked automatically ("" = it isn't): tenure, then the data, then cert + form for Week 1.
  const autoWhy = (i) => (tenured ? `hired over ${ONBOARDED_AFTER_MONTHS} months ago` : data[i.id]
    || (auto && AUTO_WEEK1.has(i.id) ? "cert on file + onboarding form" : ""));
  const autoItem = (i) => !!autoWhy(i);
  const itemDone = (i) => (c[i.id] && (c[i.id] !== "na" || i.optional)) || autoItem(i);
  const done = CHECK_ITEMS.filter(itemDone).length + (certOn ? 1 : 0), total = CHECK_ITEMS.length + 1;
  const fromData = !tenured ? CHECK_ITEMS.filter((i) => !c[i.id] && data[i.id]).length : 0;
  return { done, total, pct: Math.round((done / total) * 100), complete: done === total, started: done > 0, certOn, auto, tenured, autoItem, itemDone, autoWhy, fromData };
}
function eff(t) {
  const r = TRACKER[t.id] || {};
  return {
    onboarded: r.onboarded ?? autoValue(t, "onboarded"),
    cert: r.cert ?? autoValue(t, "cert"),
    billing: r.billing ?? (t.adopt ? t.adopt.billing : null),
    notes: r.notes || "",
    certLink: r.certLink || "",
    certExpires: r.certExpires || "",
  };
}
// "expired" / "soon" (within CERT_SOON_DAYS) / "" for a YYYY-MM-DD expiry date.
const CERT_SOON_DAYS = 60;
function certExpiry(d) {
  if (!d) return "";
  const days = (new Date(`${d}T23:59:59`) - new Date()) / 864e5;
  return days < 0 ? "expired" : days <= CERT_SOON_DAYS ? "soon" : "";
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
  DB_HAS_CHECKLIST = !body.records.length || "checklist" in body.records[0];
  body.records.forEach((r) => {
    const x = {};
    if (r.onboarded != null) x.onboarded = r.onboarded;
    if (r.cert != null) x.cert = r.cert;
    if (r.billing != null) x.billing = r.billing;
    if (r.notes) x.notes = r.notes;
    if (r.certLink) x.certLink = r.certLink;
    if (r.certExpires) x.certExpires = r.certExpires;
    if (r.checklist && Object.keys(r.checklist).length) x.checklist = r.checklist;
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
    return { id, name: t.name, club: t.club, onboarded: r.onboarded ?? null, cert: r.cert ?? null, billing: r.billing ?? null, notes: r.notes || "",
      certLink: r.certLink || "", certExpires: r.certExpires || "", checklist: r.checklist || null };
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
    ["Onboarding", fmtPct(mean(ts.map((t) => checklistProgress(t.id).pct)), 0),
      `average of the checklist + cert · ${ts.filter((t) => checklistProgress(t.id).complete).length} at 100%`],
    ["Avg unlogged sessions", fmtNum(mean(ul.map((t) => t.unlogged)), 2),
      `per trainer per pay period · ${[...new Set(periods.map((p) => p.label))].join(", ") || "no payroll files"}`],
    ["Lost sheep by trainer", fmtNum(tls.reduce((s, t) => s + t.lostSheep, 0)),
      `last session with ${tls.filter((t) => t.lostSheep).length} of ${n} trainers · ${lsRanges || "no lost sheep report"}`],
    ["On the app", `${onApp} / ${n}`, `${MODEL.data.drive && MODEL.data.drive.appClients ? `active clients in ${MODEL.data.drive.appClients.source || "the billing export"} or marked on the adoption sheet` : "matched on the app adoption sheet"}${share(onApp)}`],
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
    if (show === "checklistStarted" && !(checklistProgress(t.id).started && !checklistProgress(t.id).complete)) return false;
    if (show === "noCert" && e.cert) return false;
    if (show === "certExpiring" && !certExpiry(e.certExpires)) return false;
    if (show === "unlogged" && !(t.unlogged > 0)) return false;
    if (show === "lostSheep" && !(t.lostSheep > 0)) return false;
    if (show === "newHires" && !(t.hired && Date.now() - new Date(`${t.hired}T12:00`) <= 90 * 864e5)) return false;
    return true;
  });
  const manual = (t, f) => (TRACKER[t.id] || {})[f] !== undefined;
  const byWho = (t) => { const m = TRACKER_META[t.id]; return m && m.by ? `set by ${esc(m.by)}` : "set by hand"; };
  const resetLink = (t, f) => (manual(t, f) ? ` <button type="button" class="link reset" data-reset="${f}" title="Go back to the automatic value">reset</button>` : "");
  const cols = [
    { key: "name", label: "Trainer", sort: (t) => t.name, html: (t) => `<button type="button" class="name-link" data-onboard title="Open ${esc(t.name)}'s onboarding checklist">${esc(t.name)}</button><span class="cell-sub">${esc(t.company)}</span>`
      + `<button type="button" class="graph-btn" data-graph title="Graph ${esc(t.name)}'s stats">Graph</button>` },
    { key: "hired", label: "Hired", sort: (t) => t.hired || null, html: (t) => (t.hired
      ? `<span class="nowrap">${esc(fmtHired(t.hired))}</span><span class="cell-sub">${esc(tenure(t.hired))}</span>` : `<span class="cell-sub">not on staff list</span>`) },
    { key: "club", label: "Club", sort: (t) => `${t.club}|${t.name}`, html: (t) => `${esc(t.club)}<span class="cell-sub">${esc(t.region)}</span>` },
    { key: "onboarded", label: "Onboarded", sort: (t) => +eff(t).onboarded, html: (t) =>
      `<label class="yn"><input type="checkbox" data-f="onboarded" ${eff(t).onboarded ? "checked" : ""}> ${eff(t).onboarded ? "Yes" : "No"}</label>
       <span class="cell-sub">${manual(t, "onboarded") ? byWho(t) : esc([...t.onbSources, checklistProgress(t.id).complete ? "onboarding checklist complete" : ""].filter(Boolean).join(", ") || "not on onboarding sheet")}${resetLink(t, "onboarded")}</span>
` },
    { key: "obpct", label: "Onboarding<br><small>checklist + cert</small>", num: true, sort: (t) => checklistProgress(t.id).pct, html: (t) => checklistChip(t) },
    { key: "cert", label: "Cert on file", sort: (t) => +eff(t).cert, html: (t) =>
      `<label class="yn"><input type="checkbox" data-f="cert" ${eff(t).cert ? "checked" : ""}> ${eff(t).cert ? "Yes" : "No"}</label>
       ${eff(t).certLink ? `<a class="cert-link" href="${esc(eff(t).certLink)}" target="_blank" rel="noopener">View cert ↗</a>` : ""}
       <span class="cell-sub">${manual(t, "cert") ? byWho(t) : esc(t.certText || t.certNote)}${resetLink(t, "cert")}</span>` },
    { key: "certExpires", label: "Cert expires<br><small>and link</small>", sort: (t) => eff(t).certExpires || null, html: (t) => {
      const e = eff(t), x = certExpiry(e.certExpires);
      return `<input type="date" class="cell-input${x ? " warn" : ""}" data-f="certExpires" value="${esc(e.certExpires)}" title="Certification expiration date">`
        + (x ? `<span class="tag ${x === "expired" ? "bad" : "warn"}">${x === "expired" ? "Expired" : "Expires soon"}</span>` : "")
        + `<span class="cell-sub"><button type="button" class="link" data-certlink>${e.certLink ? "change cert link" : "add cert link"}</button></span>`;
    } },
    { key: "lostSheep", label: "Lost sheep<br><small>last session with them</small>", num: true, sort: (t) => t.lostSheep, html: (t) =>
      `<span title="${esc(Object.entries(t.lostSheepClubs).map(([c, n]) => `${c}: ${n}`).join(", ") || "none on the lost sheep report")}">${fmtNum(t.lostSheep)}</span>` },
    { key: "billing", label: "Billing health %", num: true, sort: (t) => eff(t).billing, html: (t) => {
      const auto = t.adopt && t.adopt.billing != null ? t.adopt.billing : "";
      const v = (TRACKER[t.id] || {}).billing;
      const m = TRACKER_META[t.id];
      return `<input type="number" min="0" max="100" step="0.1" class="cell-input${eff(t).billing != null && eff(t).billing < 90 ? " warn" : ""}" data-f="billing" value="${v ?? ""}" placeholder="${auto === "" ? "—" : auto}"${auto === "" ? "" : ` title="From the app adoption sheet: ${auto}%"`}>`
        + (v != null && m && /billing report/i.test(m.by) ? `<span class="cell-sub">${esc(m.by.replace(/^.*?(billing report)/i, "$1"))}</span>` : "");
    } },
    { key: "app", label: "App<br><small>client adoption</small>", sort: (t) => (t.adopt ? t.adopt.adoption ?? (t.adopt.onApp ? 0 : -1) : null), html: (t) => {
      const a = t.adopt;
      if (!a) return `<span class="cell-sub">no clients on the app</span>`;
      const clients = a.fromExport ? `${fmtNum(a.clientsInApp)}${a.totalClients ? ` of ${fmtNum(a.totalClients)}` : ""} clients` : "";
      return `${a.adoption != null ? `<b>${fmtPct(a.adoption, 0)}</b>` : a.onApp ? "On app" : "Not on app"}`
        + `<span class="cell-sub">${[clients, a.totalClients == null && a.fromExport ? "no total on adoption sheet" : "",
          a.completion != null ? `${fmtPct(a.completion, 0)} complete` : ""].filter(Boolean).join(" · ")}</span>`;
    } },
    { key: "rating", label: "Rating<br><small>Lumin stars</small>", num: true, sort: (t) => (t.adopt && t.adopt.rating) || null, html: (t) => {
      const a = t.adopt;
      if (!a || !a.rating) return `<span class="cell-sub">no reviews</span>`;
      return `<span class="stars" title="${esc(`${a.rating.toFixed(2)} stars from ${a.reviews || 0} review${a.reviews === 1 ? "" : "s"}`)}"><span aria-hidden="true">★</span> ${a.rating.toFixed(1)}</span>`
        + `<span class="cell-sub">${fmtNum(a.reviews || 0)} review${a.reviews === 1 ? "" : "s"}</span>`;
    } },
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
  } else if (el.type === "date") {
    setTracker(t.id, f, el.value || undefined);
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
  if (e.target.closest("[data-graph]")) return openTrainerGraph(e.target.closest("tr").dataset.id);
  if (e.target.closest("[data-onboard]")) return openOnboarding(e.target.closest("tr").dataset.id);
  if (e.target.closest("[data-certlink]")) {
    const id = e.target.closest("tr").dataset.id;
    const v = prompt("Link to this trainer's certification (e.g. its Google Drive link). Leave blank to remove it.", (TRACKER[id] || {}).certLink || "");
    if (v === null) return;
    if (v.trim() && !/^https:\/\//.test(v.trim())) return alert("The link should start with https://");
    setTracker(id, "certLink", v.trim() || undefined);
    return renderTrainers();
  }
  const b = e.target.closest("[data-reset]");
  if (!b) return;
  setTracker(b.closest("tr").dataset.id, b.dataset.reset, undefined);
  renderTrainers();
  renderTiles();
});

// ---------- Export / import ----------
const CSV_COLS = ["User ID", "Trainer", "Hire date", "Company", "Region", "Club", "Onboarded", "Onboarded via", "Onboarding %", "Onboarding checklist", "Cert on file", "Cert",
  "Cert expires", "Cert link", "Lost sheep", "Billing health %", "On app", "Clients on app", "Total clients", "Client adoption %", "Star rating", "Reviews", "Avg unlogged sessions", "Notes"];
const csvCell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));

$("exportBtn").onclick = () => {
  const lines = [CSV_COLS.join(",")];
  MODEL.trainers.slice().sort((a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name)).forEach((t) => {
    const e = eff(t);
    lines.push([t.id, t.name, t.hired, t.company, t.region, t.club, e.onboarded ? "Yes" : "No",
      (TRACKER[t.id] || {}).onboarded !== undefined ? "set by hand" : t.onbSources.join("; "),
      checklistProgress(t.id).pct, `${checklistProgress(t.id).done}/${checklistProgress(t.id).total}`,
      e.cert ? "Yes" : "No", t.certText || t.certNote, e.certExpires, e.certLink, t.lostSheep ?? "", e.billing ?? "",
      t.adopt ? (t.adopt.onApp ? "Yes" : "No") : "", t.adopt ? t.adopt.clientsInApp ?? "" : "", t.adopt ? t.adopt.totalClients ?? "" : "",
      t.adopt && t.adopt.adoption != null ? Math.round(t.adopt.adoption * 10) / 10 : "",
      t.adopt && t.adopt.rating ? Math.round(t.adopt.rating * 100) / 100 : "", t.adopt && t.adopt.rating ? t.adopt.reviews || 0 : "",
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
    const ce = col("Cert expires"), cl = col("Cert link");
    if (ce >= 0 && /^\d{4}-\d{2}-\d{2}$/.test((r[ce] || "").trim())) setTracker(t.id, "certExpires", r[ce].trim());
    if (cl >= 0 && /^https:\/\//.test((r[cl] || "").trim())) setTracker(t.id, "certLink", r[cl].trim());
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
    line("Club KPI sheets", st.kpis && st.kpis.ok, data.kpis ? `${data.kpis.length} clubs from the ${esc(Object.keys(STATS_SHEETS).join(", ").replace(/, (?=[^,]*$)/, " and "))} stats sheets` : err("kpis")),
    line("Unlogged sessions", st.unlogged && st.unlogged.ok, ul ? ul.periods.map((p) =>
      `${esc(p.company)} ${esc(p.label)}: ${p.total} sessions across ${p.trainers} PTs`).join(" · ") || "no payroll comparison files" : err("unlogged")),
    line("Lost sheep reports", st.lostSheep && st.lostSheep.ok, data.lostSheep ? data.lostSheep.reports.map((r) =>
      `${esc(r.company)}${r.range ? ` ${esc(r.range)}` : ""}: ${fmtNum(r.total)} lost sheep · ${fmtNum(r.total - r.noBooking)} with a last session, across ${r.trainers} trainers · ${MODEL.trainers.filter((t) => t.company === r.company && t.lostSheep).length} matched to current PTs`).join(" · ") || "no lost sheep reports" : err("lostSheep")),
    line("App clients", !!(data.drive && data.drive.appClients), data.drive && data.drive.appClients
      ? `${esc(data.drive.appClients.file)}: ${fmtNum(data.drive.appClients.total)} clients across ${data.drive.appClients.rows.length} trainers · ${MODEL.trainers.filter((t) => t.adopt && t.adopt.clientsInApp > 0).length} matched to current PTs · adoption % = clients on the app ÷ total clients on the adoption sheet (max 100%)${data.drive.appClients.generated ? ` · pulled ${new Date(data.drive.appClients.generated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}`
      : "no billing health export (Billing Health folder in Drive, or app-clients.json)"),
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
    return `<li>${esc(t.name)} — ${yn(e.onboarded)} onboarded ${yn(e.cert)} ${e.certLink ? `<a href="${esc(e.certLink)}" target="_blank" rel="noopener">cert</a>` : "cert"}${t.unlogged ? ` · ${fmtNum(t.unlogged, t.unlogged % 1 ? 1 : 0)} unlogged` : ""}</li>`;
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

// ---------- KPI trends (Gym stats) ----------
// One small chart per KPI. With no filter, a line per brand; with a brand, region or club picked
// (the filters at the top), one line for that scope. Counts are summed over the scope's clubs;
// billing health is client-weighted; lost sheep % is total lost sheep ÷ total base, each club's base
// worked out as its lost sheep ÷ its lost sheep % (the sheets' base isn't always total clients). A
// report date is only plotted when at least 90% of the scope's clubs have it, so clubs added to a
// sheet later (or a late report) don't make jumps or dips.
let trendView = pref("trendView") === "table" ? "table" : "chart";
const fmtMetric = (m) => (v, axis) => (m.pct ? fmtPct(v, axis && Number.isInteger(v) ? 0 : 1)
  : axis && Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, v % 1000 ? 1 : 0)}k` : fmtNum(v, Number.isInteger(v) ? 0 : 1));

function scopeSeries(clubs, metric) {
  const byDate = new Map(); // date -> { n, sum, lost, clients, wsum, w }
  let clubsWith = 0;
  clubs.forEach((c) => {
    const s = c.kpi[metric];
    if (!s || !s.length) return;
    clubsWith++;
    const clients = new Map((c.kpi.clients || []).map((p) => [+p.date, p.v]));
    const lost = new Map((c.kpi.lost || []).map((p) => [+p.date, p.v]));
    s.forEach((p) => {
      const d = +p.date, x = byDate.get(d) || { n: 0, sum: 0, lost: 0, base: 0, wsum: 0, w: 0 };
      x.n++; x.sum += p.v;
      const cl = clients.get(d), ls = lost.get(d);
      if (cl != null) { x.wsum += p.v * cl; x.w += cl; }
      if (metric === "lostPct" && ls != null && p.v > 0) { x.lost += ls; x.base += ls / (p.v / 100); }
      byDate.set(d, x);
    });
  });
  if (!clubsWith) return [];
  return [...byDate.entries()].sort((a, b) => a[0] - b[0])
    .filter(([, x]) => x.n >= Math.ceil(clubsWith * 0.9))
    .map(([d, x]) => {
      let v = x.sum;
      if (metric === "lostPct") v = x.base ? (x.lost / x.base) * 100 : x.sum / x.n;
      else if (metric === "billing") v = x.w ? x.wsum / x.w : x.sum / x.n;
      return { date: new Date(d), v };
    });
}

function trendSeries(metric) {
  const f = F(), days = +$("trRange").value;
  const cut = days ? Date.now() - days * 864e5 : -Infinity;
  const within = (pts) => pts.filter((p) => +p.date >= cut);
  const clubs = MODEL.clubs.filter((c) => inFilter(c, f));
  let out;
  if (f.club) {
    const c = clubs[0];
    out = c ? [{ name: c.club, company: c.company, points: (c.kpi[metric] || []).slice() }] : [];
  } else if (f.region || f.company) {
    const co = f.company || (clubs[0] && clubs[0].company);
    out = [{ name: f.region || co, company: co, points: scopeSeries(clubs, metric) }];
  } else {
    out = [...new Set(MODEL.clubs.map((c) => c.company))].filter((co) => BRAND_STYLE[co]).sort()
      .map((co) => ({ name: co, company: co, points: scopeSeries(clubs.filter((c) => c.company === co), metric) }));
  }
  return out.map((s) => ({ ...s, points: within(s.points) })).filter((s) => s.points.length);
}

// When a combined line leaves out older reports that only some clubs have, say where to find them.
function olderNote(clubs, f) {
  if (f.club) return "";
  const first = (cs) => Math.min(...cs.flatMap((c) => (c.kpi.clients || []).map((p) => +p.date)));
  const notes = [...new Set(clubs.map((c) => c.company))].map((co) => {
    const cs = clubs.filter((c) => c.company === co);
    const plotted = scopeSeries(cs, "clients");
    if (!plotted.length || first(cs) >= +plotted[0].date) return "";
    const early = cs.filter((c) => (c.kpi.clients || []).some((p) => +p.date < +plotted[0].date));
    return ` ${co} reports before ${fmtDate(plotted[0].date)} cover only ${early.length} of ${cs.length} clubs, so the combined line starts there. Pick ${f.region ? "a club" : "a region or club"} to see the earlier reports.`;
  });
  return notes.join("");
}

function renderTrends() {
  const f = F();
  const clubs = MODEL.clubs.filter((c) => inFilter(c, f) && Object.keys(c.kpi).length);
  const club = f.club && MODEL.clubs.find((c) => c.key === f.club);
  $("trScope").textContent = club ? `${club.club} (${club.company}${club.region ? ` · ${club.region}` : ""}). Pick "All" in the Club filter above to see the whole region or brand.`
    : `${f.region || f.company || "Each brand"}: ${clubs.length} club${clubs.length === 1 ? "" : "s"} combined. Use the Company, Region and Club filters above to narrow it down.`
      + (!f.company && !f.region ? " Brands have different amounts of history." : "") + olderNote(clubs, f);
  document.querySelectorAll("#trView button").forEach((b) => b.classList.toggle("on", b.dataset.tv === trendView));
  const grid = $("trendGrid");
  grid.textContent = "";
  METRICS.forEach((m) => {
    const series = trendSeries(m.key), fmt = fmtMetric(m);
    const card = document.createElement("div");
    card.className = "trend";
    const head = document.createElement("div");
    head.className = "trend-head";
    const title = document.createElement("h3");
    title.textContent = m.label;
    const better = document.createElement("span");
    better.className = "cell-sub";
    better.textContent = m.better === "up" ? "higher is better" : "lower is better";
    head.append(title, better);
    const body = document.createElement("div");
    body.className = "trend-body";
    card.append(head, body);
    grid.appendChild(card);
    if (trendView === "table") return trendTable(body, series, fmt);
    lineChart(body, { series, fmt });
  });
}

function trendTable(host, series, fmt) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => +p.date)))].sort((a, b) => b - a);
  if (!dates.length) { host.innerHTML = `<p class="chart-empty">No data for these filters.</p>`; return; }
  const val = (s, d) => { const p = s.points.find((q) => +q.date === d); return p ? fmt(p.v) : "—"; };
  host.innerHTML = `<div class="table-scroll trend-table"><table class="grid"><thead><tr><th>Date</th>${series.map((s) => `<th class="num">${esc(s.name)}</th>`).join("")}</tr></thead>
    <tbody>${dates.map((d) => `<tr><td>${esc(fmtDate(new Date(d)))}</td>${series.map((s) => `<td class="num">${esc(val(s, d))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

$("trRange").onchange = renderTrends;
document.querySelectorAll("#trView button").forEach((b) => (b.onclick = () => { trendView = b.dataset.tv; pref("trendView", trendView); renderTrends(); }));
let trendResize = null;
window.addEventListener("resize", () => {
  clearTimeout(trendResize);
  trendResize = setTimeout(() => {
    if (MODEL && statsTab() === "gyms") renderTrends();
    if ($("trainerDialog").open) openTrainerGraph($("trainerDialog").dataset.id);
  }, 150);
});
document.addEventListener("viewchange", (e) => { if (e.detail === "gyms" && MODEL) renderTrends(); });

// ---------- Trainer graph (Trainer stats) ----------
// A trainer's numbers next to their club's and brand's trainer averages.
function openTrainerGraph(id) {
  const t = MODEL.trainers.find((x) => x.id === id);
  if (!t) return;
  const dlg = $("trainerDialog");
  dlg.dataset.id = id;
  $("tdName").textContent = t.name;
  const e = eff(t);
  $("tdSub").textContent = `${t.club} · ${t.company}${t.region ? ` · ${t.region}` : ""}${t.hired ? ` · hired ${fmtHired(t.hired)} (${tenure(t.hired)})` : ""} · ${e.onboarded ? "onboarded" : "not onboarded"} · ${e.cert ? "cert on file" : "no cert on file"}`
    + (e.certExpires ? ` (expires ${new Date(`${e.certExpires}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})` : "");
  $("tdSelfKey").style.background = styleFor(t.company).color;
  const club = MODEL.trainers.filter((x) => x.key === t.key), brand = MODEL.trainers.filter((x) => x.company === t.company);
  const avg = (ts, get) => mean(ts.map(get).filter((v) => v != null && !isNaN(v)));
  const metrics = [
    { label: "Lost sheep", sub: "last session with them · fewer is better", get: (x) => x.lostSheep, fmt: (v) => fmtNum(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1) },
    { label: "Billing health", sub: "% of their clients in good standing", get: (x) => eff(x).billing, fmt: (v) => fmtPct(v) },
    { label: "Unlogged sessions", sub: "average per pay period · fewer is better", get: (x) => x.unlogged, fmt: (v) => fmtNum(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1) },
    { label: "Client app adoption", sub: "clients on the app ÷ total clients (max 100%)", get: (x) => (x.adopt ? x.adopt.adoption : null), fmt: (v) => fmtPct(v, 0) },
    { label: "Workout completion", sub: "% of assigned workouts completed in the app", get: (x) => (x.adopt ? x.adopt.completion : null), fmt: (v) => fmtPct(v, 0) },
    { label: "Star rating", sub: "Lumin client reviews, out of 5", get: (x) => (x.adopt && x.adopt.rating) || null, fmt: (v) => `★ ${v.toFixed(2)}` },
  ];
  const body = $("tdBody");
  body.textContent = "";
  if (!dlg.open) dlg.showModal();
  metrics.forEach((m) => {
    const box = document.createElement("div");
    box.className = "trend";
    const head = document.createElement("div");
    head.className = "trend-head";
    const h = document.createElement("h3");
    h.textContent = m.label;
    const s = document.createElement("span");
    s.className = "cell-sub";
    s.textContent = m.sub;
    head.append(h, s);
    const chart = document.createElement("div");
    box.append(head, chart);
    body.appendChild(box);
    compareBars(chart, { company: t.company, fmt: m.fmt, rows: [
      { label: "This trainer", v: m.get(t), kind: "self" },
      { label: "Club avg", v: avg(club, m.get), kind: "club" },
      { label: `${t.company} avg`, v: avg(brand, m.get), kind: "brand" },
    ] });
    if (m.get(t) == null && chart.querySelector("svg")) {
      const note = document.createElement("p");
      note.className = "chart-empty";
      note.textContent = "No data for this trainer yet.";
      box.appendChild(note);
    }
  });
  // Unlogged sessions per pay period, when there's more than one period.
  const periods = Object.entries(t.unloggedPeriods || {});
  if (periods.length > 1) {
    const box = document.createElement("div");
    box.className = "trend";
    box.innerHTML = `<div class="trend-head"><h3>Unlogged sessions by pay period</h3><span class="cell-sub">this trainer</span></div><div></div>`;
    body.appendChild(box);
    compareBars(box.lastChild, { company: t.company, fmt: (v) => fmtNum(v), rows: periods.map(([p, n]) => ({ label: p, v: n, kind: "self" })) });
  }
}
$("tdClose").onclick = () => $("trainerDialog").close();
$("trainerDialog").addEventListener("click", (e) => { if (e.target === $("trainerDialog")) $("trainerDialog").close(); });

// Club-level app adoption from the trainers' numbers, for the map tab's gym pop-ups (app.js).
// Clients on the app are capped at each trainer's total so one trainer can't push a club past 100%.
function shareClubAdoption() {
  if (!(MODEL.data.drive && MODEL.data.drive.appClients)) return;
  const byGym = {};
  MODEL.clubs.forEach((c) => {
    if (!c.gym) return;
    const ts = MODEL.trainers.filter((t) => t.key === c.key);
    const withTotal = ts.filter((t) => t.adopt && t.adopt.totalClients);
    byGym[`${c.gym.brand}|${c.gym.name}`] = {
      trainers: ts.length, onApp: ts.filter((t) => t.adopt && t.adopt.onApp).length,
      inApp: withTotal.reduce((s, t) => s + Math.min(t.adopt.clientsInApp, t.adopt.totalClients), 0),
      total: withTotal.reduce((s, t) => s + t.adopt.totalClients, 0),
    };
  });
  document.dispatchEvent(new CustomEvent("clubadoption", { detail: byGym }));
}

// ---------- Onboarding page (click a trainer's name) ----------
function checklistChip(t) {
  const p = checklistProgress(t.id);
  return `<button type="button" class="ob-pct${p.complete ? " done" : ""}" data-onboard title="Open the onboarding checklist">
      <b>${p.pct}%</b><span class="ob-mini"><i style="width:${p.pct}%"></i></span></button>
    <span class="cell-sub">${p.complete ? "✓ complete" : `${p.done} of ${p.total}`}${p.tenured ? ` · ${ONBOARDED_AFTER_MONTHS}+ months${p.certOn ? "" : ", needs cert"}` : [p.auto ? "Week 1 auto" : "", p.fromData ? `${p.fromData} from data` : ""].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>`;
}
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDay = (d) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function openOnboarding(id) {
  const t = MODEL.trainers.find((x) => x.id === id);
  if (!t) return;
  const dlg = $("onboardDialog");
  dlg.dataset.id = id;
  $("obName").textContent = `${t.name}: onboarding`;
  $("obSub").textContent = [t.club, t.company, t.region, t.hired ? `hired ${fmtHired(t.hired)} (${tenure(t.hired)})` : ""].filter(Boolean).join(" · ");
  $("obBy").value = pref("trackerName");
  $("obStatus").textContent = SHARED && !DB_HAS_CHECKLIST
    ? "The tracker's Apps Script needs the latest Code.gs (see apps-script/README.md) before checklist ticks can be saved." : "";
  $("obStatus").classList.toggle("bad", SHARED && !DB_HAS_CHECKLIST);
  renderOnboarding();
  if (!dlg.open) dlg.showModal();
}

function renderOnboarding() {
  const id = $("onboardDialog").dataset.id, t = MODEL.trainers.find((x) => x.id === id);
  const c = (TRACKER[id] || {}).checklist || {}, p = checklistProgress(id), e = eff(t);
  $("obBar").style.width = `${p.pct}%`;
  $("obBar").classList.toggle("done", p.complete);
  $("obCount").textContent = `${p.pct}% · ${p.done} of ${p.total} done` + (p.complete ? " · onboarded" : "")
    + ((TRACKER[id] || {}).onboarded !== undefined ? ` · onboarded is set by hand to ${e.onboarded ? "Yes" : "No"} on the tracker` : "");
  const today = isoToday();
  const certHtml = `<section class="ob-sec"><div class="trend-head"><h3>Certification</h3><span class="cell-sub">${p.certOn ? "1/1" : "0/1"}</span></div>
    <ul class="ob-list"><li class="${p.certOn ? "on" : ""}"><label><input type="checkbox" disabled ${p.certOn ? "checked" : ""}> <span>Certification on file</span></label>
      <span class="cell-sub">${p.certOn ? esc(e.certExpires ? `expires ${fmtDay(e.certExpires)}` : t.certText || "on the tracker") : "Not yet: tick Cert on file on the tracker when it's in."}</span>
      ${e.certLink ? `<a class="ob-link" href="${esc(e.certLink)}" target="_blank" rel="noopener">View cert ↗</a>` : ""}
      <span class="cell-sub">${p.tenured ? `Hired over ${ONBOARDED_AFTER_MONTHS} months ago: every item is ticked automatically${p.certOn ? "." : ", so a cert on file is all that's left."}`
        : p.auto ? "Cert on file + onboarding form filled in: Week 1 is ticked automatically."
        : p.certOn ? "When they fill in the onboarding form, Week 1 is ticked automatically." : t.onbForm ? "Onboarding form filled in: with a cert on file, Week 1 is ticked automatically." : ""}</span></li></ul></section>`;
  $("obBody").innerHTML = certHtml + ONBOARDING_CHECKLIST.map((s) => {
    const left = s.items.filter((i) => !p.itemDone(i)).length;
    const due = s.due && t.hired ? new Date(new Date(`${t.hired}T12:00`).getTime() + s.due * 864e5) : null;
    const dueIso = due && `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    const late = due && left && dueIso < today;
    return `<section class="ob-sec">
      <div class="trend-head"><h3>${esc(s.section)}</h3><span class="cell-sub">${s.items.length - left}/${s.items.length}${dueIso
        ? ` · <span class="${late ? "ob-late" : ""}">${late ? "overdue, was due" : "due"} ${esc(fmtDay(dueIso))}</span>` : ""}</span></div>
      ${s.note ? `<p class="cell-sub ob-note">${esc(s.note)}</p>` : ""}
      <ul class="ob-list">${s.items.map((i) => {
        const v = c[i.id], na = v === "na", auto = !v && p.autoItem(i);
        return `<li class="${v || auto ? "on" : ""}">
          <label><input type="checkbox" data-item="${esc(i.id)}" ${(v && !na) || auto ? "checked" : ""}${na || auto ? " disabled" : ""}> <span>${esc(i.label)}</span></label>
          ${i.optional && !auto ? `<label class="ob-na"><input type="checkbox" data-na="${esc(i.id)}" ${na ? "checked" : ""}> ${esc(i.optional)}</label>` : ""}
          ${auto ? `<span class="cell-sub">automatic: ${esc(p.autoWhy(i))}</span>` : ""}
          ${v ? `<span class="cell-sub">${na ? "marked not needed" : `done ${esc(fmtDay(v.d))}${v.by ? ` by ${esc(v.by)}` : ""}`}</span>` : ""}
          ${i.hint ? `<span class="cell-sub">${esc(i.hint)}</span>` : ""}
          ${(i.links || []).map(([text, url]) => `<a class="ob-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`).join("")}
        </li>`;
      }).join("")}</ul></section>`;
  }).join("");
}

function setChecklistItem(id, item, value) {
  const was = checklistProgress(id).complete;
  const c = { ...((TRACKER[id] || {}).checklist || {}) };
  if (value) c[item] = value; else delete c[item];
  setTracker(id, "checklist", Object.keys(c).length ? c : undefined);
  const now = checklistProgress(id).complete;
  if (now !== was) {
    $("obStatus").textContent = now ? "Every item is done: marked onboarded on the tracker." : "Checklist no longer complete: no longer counted as onboarded.";
    $("obStatus").classList.remove("bad");
  }
  renderOnboarding();
  renderTrainers();
  renderTiles();
}
$("obBody").addEventListener("change", (e) => {
  const id = $("onboardDialog").dataset.id, el = e.target;
  const stamp = { d: isoToday(), by: ($("obBy").value || "").trim().slice(0, 60) };
  if (el.dataset.item) setChecklistItem(id, el.dataset.item, el.checked ? stamp : undefined);
  else if (el.dataset.na) setChecklistItem(id, el.dataset.na, el.checked ? "na" : undefined);
});
$("obBy").onchange = () => { pref("trackerName", $("obBy").value.trim()); $("dbName").value = pref("trackerName"); };
$("obClose").onclick = () => $("onboardDialog").close();
$("onboardDialog").addEventListener("click", (e) => { if (e.target === $("onboardDialog")) $("onboardDialog").close(); });

// ---------- Top & bottom 5 reports ----------
// For each stat, the 5 best and 5 worst trainers (Trainer stats) or clubs (Gym stats) among those
// in the filters. Nobody is in both lists: with fewer than 10 ranked, the list splits in half.
// Star ratings need REPORT_MIN_REVIEWS reviews to count.
const REPORT_MIN_REVIEWS = 3;
let REPORT = null;
const num1 = (v) => fmtNum(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);

function trainerReportStats() {
  const a = (t) => t.adopt || {};
  return [
    { label: "Onboarding", sub: "% of the checklist + cert on file", better: "up", get: (t) => checklistProgress(t.id).pct, fmt: (v) => `${v}%` },
    { label: "Lost sheep", sub: "last session with them", better: "down", get: (t) => t.lostSheep, fmt: num1 },
    { label: "Billing health", sub: "% of their clients in good standing", better: "up", get: (t) => eff(t).billing, fmt: (v) => fmtPct(v) },
    { label: "Unlogged sessions", sub: "average per pay period", better: "down", get: (t) => t.unlogged, fmt: num1 },
    { label: "Clients on the app", sub: "active clients in Lumin", better: "up", get: (t) => (a(t).fromExport ? a(t).clientsInApp : null), fmt: (v) => fmtNum(v) },
    { label: "Client app adoption", sub: "clients on the app ÷ total clients", better: "up", get: (t) => a(t).adoption, fmt: (v) => fmtPct(v, 0) },
    { label: "Workout completion", sub: "% of assigned workouts completed", better: "up", get: (t) => a(t).completion, fmt: (v) => fmtPct(v, 0) },
    { label: "Star rating", sub: `Lumin reviews (at least ${REPORT_MIN_REVIEWS})`, better: "up",
      get: (t) => (a(t).rating && (a(t).reviews || 0) >= REPORT_MIN_REVIEWS ? a(t).rating : null),
      fmt: (v) => `★ ${v.toFixed(2)}`, extra: (t) => `${fmtNum(a(t).reviews)} reviews` },
  ];
}

function clubReportStats() {
  const lv = (m) => (c) => (last(c.kpi[m]) || {}).v ?? null;
  const share = (c, f) => (c.pts ? (clubCounts(c)[f] / c.pts) * 100 : null);
  const app = (c) => {
    const ts = clubCounts(c).ts.filter((t) => t.adopt && t.adopt.totalClients);
    const total = ts.reduce((s, t) => s + t.adopt.totalClients, 0);
    return total ? (ts.reduce((s, t) => s + Math.min(t.adopt.clientsInApp || 0, t.adopt.totalClients), 0) / total) * 100 : null;
  };
  const stars = (c) => mean(clubCounts(c).ts.filter((t) => t.adopt && t.adopt.rating && (t.adopt.reviews || 0) >= REPORT_MIN_REVIEWS).map((t) => t.adopt.rating));
  return [
    // Clubs with no clients in the latest report (not open yet) aren't ranked on the KPIs.
    ...METRICS.map((m) => ({ label: m.label, sub: "latest report", better: m.better, get: (c) => (lv("clients")(c) > 0 ? lv(m.key)(c) : null),
      fmt: m.pct ? (v) => fmtPct(v) : (v) => fmtNum(v) })),
    { label: "Unlogged sessions", sub: "average per trainer per pay period", better: "down", get: (c) => c.unlogged, fmt: (v) => fmtNum(v, 2) },
    { label: "Onboarding", sub: "average % of the trainers' checklist + cert", better: "up",
      get: (c) => (c.pts ? mean(clubCounts(c).ts.map((t) => checklistProgress(t.id).pct)) : null), fmt: (v) => fmtPct(v, 0) },
    { label: "Trainers onboarded", sub: "% of the club's trainers", better: "up", get: (c) => share(c, "onboarded"), fmt: (v) => fmtPct(v, 0), extra: (c) => `${clubCounts(c).onboarded} of ${c.pts}` },
    { label: "Cert on file", sub: "% of the club's trainers", better: "up", get: (c) => share(c, "cert"), fmt: (v) => fmtPct(v, 0), extra: (c) => `${clubCounts(c).cert} of ${c.pts}` },
    { label: "Client app adoption", sub: "trainers' clients on the app ÷ total clients", better: "up", get: app, fmt: (v) => fmtPct(v, 0) },
    { label: "Star rating", sub: `average of trainers with ${REPORT_MIN_REVIEWS}+ reviews`, better: "up", get: stars, fmt: (v) => `★ ${v.toFixed(2)}` },
  ];
}

function rankSection(stat, items, who) {
  const rows = items.map((x) => ({ x, v: stat.get(x) })).filter((r) => r.v != null && !isNaN(r.v))
    .sort((p, q) => (stat.better === "up" ? q.v - p.v : p.v - q.v) || who(p.x).name.localeCompare(who(q.x).name));
  const nBest = Math.min(5, Math.ceil(rows.length / 2));
  const best = rows.slice(0, nBest);
  const worst = rows.slice(nBest).reverse().slice(0, 5);
  const fmt = (r, i) => ({ rank: i + 1, ...who(r.x), value: stat.fmt(r.v), extra: stat.extra ? stat.extra(r.x) : "" });
  // How many more share the value at the cut-off (e.g. lots of trainers with 0 lost sheep).
  const tied = (list) => (list.length ? rows.filter((r) => r.v === list[list.length - 1].v && !best.includes(r) && !worst.includes(r)).length : 0);
  return { ...stat, n: rows.length, best: best.map(fmt), worst: worst.map(fmt), tiedBest: tied(best), tiedWorst: tied(worst) };
}

// Builds a report for kind "trainers" or "clubs" over the filters f ({ company, region, club }).
function buildReport(kind, f) {
  const scope = [f.company, f.region, f.club && (MODEL.clubs.find((c) => c.key === f.club) || {}).club].filter(Boolean).join(" · ") || "All brands";
  const trainers = kind === "trainers";
  const items = trainers ? MODEL.trainers.filter((t) => inFilter(t, f)) : MODEL.clubs.filter((c) => inFilter(c, f) && (c.pts || Object.keys(c.kpi).length));
  const who = trainers
    ? (t) => ({ name: t.name, where: `${t.club} · ${t.company}` })
    : (c) => ({ name: c.club, where: [c.company, c.region].filter(Boolean).join(" · ") });
  const stats = trainers ? trainerReportStats() : clubReportStats();
  return {
    title: `Top & bottom 5 ${trainers ? "trainers" : "clubs"}`, scope, kind,
    date: new Date(), count: items.length,
    sections: stats.map((s) => rankSection(s, items, who)),
  };
}

function openReport(kind) {
  rpStatus("");
  REPORT = buildReport(kind, F());
  renderReport();
  if (!$("reportDialog").open) $("reportDialog").showModal();
}

const tieNote = (s, k, list) => (s[k] ? `<p class="cell-sub tie-note">+${fmtNum(s[k])} more tied at ${esc(list[list.length - 1].value)} (listed A–Z)</p>` : "");

function renderReport() {
  const R = REPORT;
  $("rpTitle").textContent = R.title;
  $("rpSub").textContent = `${R.scope} · ${R.count} ${R.kind} · ${R.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    + ` · change the Company, Region and Club filters to change who's ranked`;
  const list = (rows, cls) => rows.length
    ? `<ol class="rank-list ${cls}">${rows.map((r) => `<li><span class="rank-name"><b>${esc(r.name)}</b><span class="cell-sub">${esc(r.where)}</span></span>`
      + `<span class="rank-val"><b>${esc(r.value)}</b>${r.extra ? `<span class="cell-sub">${esc(r.extra)}</span>` : ""}</span></li>`).join("")}</ol>`
    : `<p class="chart-empty">—</p>`;
  $("rpBody").innerHTML = R.sections.map((s) => `<section class="report-sec">
      <div class="trend-head"><h3>${esc(s.label)}</h3><span class="cell-sub">${esc(s.sub)} · ${s.better === "up" ? "higher" : "lower"} is better</span></div>
      ${s.n ? `<div class="report-cols">
        <div><div class="rank-head good">Best ${s.best.length}</div>${list(s.best, "good")}${tieNote(s, "tiedBest", s.best)}</div>
        <div><div class="rank-head bad">Worst ${s.worst.length}</div>${list(s.worst, "bad")}${tieNote(s, "tiedWorst", s.worst)}</div>
      </div>${s.n < 10 ? `<p class="cell-sub">Only ${s.n} with data, split between the two lists.</p>` : ""}`
      : `<p class="chart-empty">No data for this stat in these filters.</p>`}
    </section>`).join("");
}

$("trainerReportBtn").onclick = () => openReport("trainers");
$("clubReportBtn").onclick = () => openReport("clubs");
$("rpClose").onclick = () => $("reportDialog").close();
$("reportDialog").addEventListener("click", (e) => { if (e.target === $("reportDialog")) $("reportDialog").close(); });
// Printing: an open modal dialog is laid out fixed over the page, so a long report would print
// from wherever it's scrolled to. Print a plain copy in the page instead.
function endPrintReport() {
  document.body.classList.remove("print-report");
  const el = $("printReport");
  if (el) el.remove();
}
$("reportDialog").addEventListener("close", endPrintReport);
$("rpPrint").onclick = () => {
  endPrintReport();
  const el = document.createElement("div");
  el.id = "printReport";
  el.innerHTML = `<h2>${esc($("rpTitle").textContent)}</h2><p class="sub">${esc($("rpSub").textContent)}</p>${$("rpBody").outerHTML.replace('id="rpBody"', "")}`;
  document.body.appendChild(el);
  document.body.classList.add("print-report");
  window.print();
};
window.addEventListener("afterprint", endPrintReport);
// One CSV for one or more reports (a "Report" column is added when there's more than one).
function reportCsv(reports = [REPORT]) {
  const many = reports.length > 1;
  const lines = [[...(many ? ["Report"] : []), "Stat", "Better", "List", "Rank", many ? "Name" : reports[0].kind === "trainers" ? "Trainer" : "Club",
    "Where", "Value", "Detail"].join(",")];
  reports.forEach((R) => R.sections.forEach((s) => [["Best", s.best], ["Worst", s.worst]].forEach(([side, rows]) => rows.forEach((r) =>
    lines.push([...(many ? [R.kind === "trainers" ? "Trainers" : "Clubs"] : []), s.label, s.better === "up" ? "higher" : "lower", side, r.rank, r.name, r.where, r.value,
      [r.extra, r.rank === rows.length && s[side === "Best" ? "tiedBest" : "tiedWorst"] ? `+${s[side === "Best" ? "tiedBest" : "tiedWorst"]} more tied` : ""].filter(Boolean).join("; ")].map(csvCell).join(","))))));
  return lines.join("\n");
}
const reportFilename = () => `top-bottom-5-${REPORT.kind}-${REPORT.scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${REPORT.date.toISOString().slice(0, 10)}.csv`;
$("rpCsv").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([reportCsv()], { type: "text/csv" }));
  a.download = reportFilename();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- Emailing a report ----------
// Sent by the tracker's Apps Script (apps-script/Code.gs) from the sheet owner's Google account,
// only to the addresses in its REPORT_EMAILS property; the page never chooses recipients.
// Email clients ignore stylesheets, so the email body uses inline styles.
function reportEmailHtml(R = REPORT) {
  const td = "padding:4px 8px;border-bottom:1px solid #e4e7ec;font-size:13px;vertical-align:top";
  const list = (rows, color, tied, label) => `<td style="width:50%;vertical-align:top;padding:0 8px 0 0">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;color:${color};margin:4px 0">${label} ${rows.length}</div>
      <table style="border-collapse:collapse;width:100%">${rows.map((r) => `<tr><td style="${td};color:#667085;width:20px">${r.rank}.</td>
        <td style="${td}"><b>${esc(r.name)}</b><br><span style="color:#667085;font-size:11px">${esc(r.where)}</span></td>
        <td style="${td};text-align:right;white-space:nowrap"><b>${esc(r.value)}</b>${r.extra ? `<br><span style="color:#667085;font-size:11px">${esc(r.extra)}</span>` : ""}</td></tr>`).join("")
      || `<tr><td style="${td};color:#667085">—</td></tr>`}</table>
      ${tied ? `<div style="color:#667085;font-size:11px;margin-top:4px">+${fmtNum(tied)} more tied at ${esc(rows[rows.length - 1].value)}</div>` : ""}</td>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2330;max-width:760px">
    <h2 style="margin:0 0 4px;font-size:18px">${esc(R.title)}</h2>
    <p style="margin:0 0 16px;color:#667085;font-size:13px">${esc(R.scope)} · ${R.count} ${R.kind} · ${esc(R.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }))}</p>
    ${R.sections.map((s) => `<div style="border:1px solid #e4e7ec;border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700">${esc(s.label)} <span style="font-weight:400;color:#667085;font-size:12px">${esc(s.sub)} · ${s.better === "up" ? "higher" : "lower"} is better</span></div>
      ${s.n ? `<table style="width:100%;border-collapse:collapse"><tr>${list(s.best, "#1f8a43", s.tiedBest, "▲ BEST")}${list(s.worst, "#c0392b", s.tiedWorst, "▼ WORST")}</tr></table>`
        : `<p style="color:#667085;font-size:12px">No data for this stat in these filters.</p>`}</div>`).join("")}
    <p style="color:#667085;font-size:12px">The full report is attached as a CSV.</p></div>`;
}
async function postReportEmail(email, key, by) {
  let res;
  try {
    res = await fetch(TRACKER_DB.url, {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request: no CORS preflight
      body: JSON.stringify({ key, by, email }),
    });
    return await res.json();
  } catch {
    // Apps Script answers errors (and sign-in pages) with HTML the browser can't read here.
    throw new Error("the tracker's Apps Script sent back an error page instead of an answer. Check that its deployment's "
      + "\"Who has access\" is Anyone, and that it's allowed to send email: in the Apps Script editor, pick doGet, click Run "
      + "and allow the permissions it asks for.");
  }
}

// The weekly email (.github/workflows/weekly-report.yml runs this in a headless browser on the live
// site every Monday): both reports for all brands in one email, one CSV. Refuses to send if a data
// source failed to load, so nobody gets a half-empty report.
window.sendWeeklyReport = async ({ key = "", by = "Weekly report", build = false } = {}) => {
  if (!MODEL) throw new Error("data hasn't loaded");
  const bad = Object.entries(MODEL.data.status || {}).filter(([k, s]) => !s.ok && ["staff", "kpis"].includes(k)).map(([k]) => k);
  if (bad.length) throw new Error(`not sending: ${bad.join(", ")} failed to load`);
  const all = { company: "", region: "", club: "" };
  const reports = [buildReport("trainers", all), buildReport("clubs", all)];
  const date = reports[0].date;
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2330;font-size:13px;margin-bottom:12px">Weekly top &amp; bottom 5 report for ${esc(day)}: trainers first, then clubs. The CSV has both.</div>`
    + reports.map((R) => reportEmailHtml(R)).join('<hr style="border:0;border-top:2px solid #e4e7ec;margin:20px 0">');
  const email = { subject: `Weekly top & bottom 5 · trainers and clubs · ${day}`, html, csv: reportCsv(reports),
    filename: `weekly-top-bottom-5-${date.toISOString().slice(0, 10)}.csv` };
  if (build) return { url: TRACKER_DB.url, email }; // the weekly job sends it itself (so it can log errors)
  return postReportEmail(email, key, by);
};

function rpStatus(text, bad) {
  $("rpStatus").textContent = text;
  $("rpStatus").classList.toggle("bad", !!bad);
}
$("rpEmail").onclick = async () => {
  if (!TRACKER_DB.url) return rpStatus("Emailing needs the shared tracker (TRACKER_DB.url in data.js).", true);
  const btn = $("rpEmail");
  btn.disabled = true;
  try {
    rpStatus("Checking who reports go to…");
    const info = await (await fetch(`${TRACKER_DB.url}?email=1`, { credentials: "omit" })).json();
    if (!("recipients" in info)) throw new Error("the tracker's Apps Script needs the latest Code.gs (see apps-script/README.md)");
    if (!info.recipients) throw new Error("no one is set up to get reports yet: add REPORT_EMAILS in the Apps Script's script properties");
    if (!confirm(`Email this report to the ${info.recipients} ${info.recipients === 1 ? "person" : "people"} set up for reports?`)) return rpStatus("");
    const send = () => postReportEmail({ subject: `${REPORT.title} · ${REPORT.scope} · ${REPORT.date.toLocaleDateString()}`,
      html: reportEmailHtml(), csv: reportCsv(), filename: reportFilename() }, pref("trackerEditKey"), pref("trackerName"));
    rpStatus("Sending…");
    let res = await send();
    if (!res.ok && res.error === "bad key") {
      const key = prompt("Enter the edit key to send reports:", "");
      if (key == null) return rpStatus("Not sent.", true);
      pref("trackerEditKey", key.trim());
      res = await send();
    }
    if (!res.ok) throw new Error(res.error === "bad key" ? "that edit key didn't work" : res.error);
    rpStatus(`Sent to ${res.sent} ${res.sent === 1 ? "person" : "people"} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
  } catch (err) {
    console.error(err);
    rpStatus(`Couldn't send the report: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
};

// ---------- Render ----------
function renderAll() {
  if (!MODEL) return;
  renderTiles();
  if (statsTab() === "gyms") renderTrends();
  renderClubs();
  renderTrainers();
  if (statsView === "map") setStatsView("map");
}

document.addEventListener("dataloaded", async (e) => {
  const data = e.detail;
  MODEL = buildModel(data);
  shareClubAdoption();
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
