// Shared data loading for both tabs. Everything here is read-only: Google Sheets are read
// through their public CSV export with no sign-in or credentials sent. Drive files (staff
// lists, payroll comparisons) can't be downloaded by a browser, so the deploy workflow
// reads them into drive-data.json (see scripts/build_drive_data.py).

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Minimal RFC 4180 CSV parser (handles quoted fields with commas/newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Downloads one tab as CSV rows. opts: { tab, gid, range, headers }.
async function fetchSheet(id, opts = {}) {
  const p = new URLSearchParams({ tqx: "out:csv", _: Date.now() });
  if (opts.tab) p.set("sheet", opts.tab);
  if (opts.gid) p.set("gid", opts.gid);
  if (opts.range) p.set("range", opts.range);
  if (opts.headers != null) p.set("headers", opts.headers);
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${p}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error("Sheet is not shared with \"Anyone with the link\"");
  return parseCSV(text).map((r) => r.map((v) => String(v ?? "").trim()));
}

async function fetchDriveData() {
  const res = await fetch(`drive-data.json?_=${Date.now()}`);
  if (!res.ok) throw new Error(`drive-data.json missing (${res.status}) — run scripts/build_drive_data.py`);
  return res.json();
}

// ---------- Matching helpers ----------
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const companyOf = (s) => (/elevate|fitness connection/i.test(s) ? "Elevate" : /grip|la fitness/i.test(s) ? "GRIP" : "Other");
// "GRIP PT at LA Fitness - Roswell - Hwy 92 / Hardscrabble Road" -> "Roswell - Hwy 92 / Hardscrabble Road"
const clubFromLocation = (loc) => String(loc).replace(/^.*?(fitness|connection)\s*-\s*/i, "").trim();
const num = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[,%$\s]/g, "");
  return s === "" || isNaN(+s) ? null : +s;
};

// Name lookup keys: full name and "first last-word" (drops middle names / suffix spacing).
function nameKeys(name) {
  // Drop quoted nicknames ("Q") and suffixes (Jr., III) so reports and staff lists line up.
  const parts = norm(String(name ?? "").replace(/["“”][^"“”]*["“”]/g, " ")).split(" ")
    .filter((p, i, all) => p && !(i > 1 && i === all.length - 1 && /^(jr|sr|ii|iii|iv)$/.test(p)));
  if (!parts.length) return [];
  const keys = [parts.join(" ")];
  if (parts.length > 2) keys.push(`${parts[0]} ${parts[parts.length - 1]}`);
  return keys;
}
function nameIndex(items, getName = (x) => x.name) {
  const m = new Map();
  items.forEach((x) => nameKeys(getName(x)).forEach((k) => { if (!m.has(k)) m.set(k, x); }));
  return m;
}
const lookupName = (index, name) => nameKeys(name).map((k) => index.get(k)).find(Boolean);

// Finds the club in `clubs` that a KPI-sheet column name refers to.
function matchClub(name, clubs) {
  const k = norm(CLUB_ALIASES[norm(name)] || name);
  if (!k) return null;
  return clubs.find((c) => norm(c) === k)
    || clubs.find((c) => norm(c).includes(k))
    || clubs.find((c) => k.includes(norm(c)))
    || null;
}

// ---------- Staff lists ----------
function staffRole(type) {
  if (PT_TYPE.test(type)) return "pt";
  if (/fitness manager/i.test(type)) return /asst|assistant/i.test(type) ? "afm" : "fm";
  return "other";
}

function loadStaff(drive) {
  // The "Demo" club holds test logins, not real staff.
  const staff = drive.staff.filter((r) => !/ - demo$/i.test(r.location)).map((r) => ({
    id: r.id, type: r.type, location: r.location, first: r.first, last: r.last,
    name: `${r.first} ${r.last}`.trim(),
    club: clubFromLocation(r.location), company: companyOf(r.location || r.file),
    role: staffRole(r.type), terminated: /terminated/i.test(r.type), file: r.file,
  }));
  if (!staff.length) throw new Error("No staff list files found in the Drive folder");
  return { staff, files: drive.staffFiles };
}

// ---------- Unlogged sessions (payroll comparisons) ----------
// Each file compares two payroll runs for one pay period. A trainer's unlogged sessions are
// the sessions that differ between the runs (added after the first run was pulled).
// Only personal trainers count: by their staff-list title, else the payroll admin type.
function loadUnlogged(drive, staffById) {
  const periods = [];
  const byTrainer = new Map(); // userId -> { name, club, company, periods: {label: n} }
  for (const file of drive.unlogged) {
    let company = "Other", trainers = 0, total = 0;
    for (const row of file.rows) {
      company = companyOf(row.location);
      const st = staffById.get(row.id);
      const isPT = st ? st.role === "pt" : row.types.some((t) => PT_TYPE.test(t));
      if (!isPT) continue;
      if (!byTrainer.has(row.id)) {
        byTrainer.set(row.id, { id: row.id, name: st ? st.name : row.name, club: clubFromLocation(row.location), company, periods: {} });
      }
      const t = byTrainer.get(row.id);
      t.periods[file.period] = (t.periods[file.period] || 0) + row.unlogged;
      trainers++; total += row.unlogged;
    }
    periods.push({ label: file.period, company, file: file.file, trainers, total });
  }
  // Average per pay period: trainers missing from a comparison had nothing unlogged that period.
  const periodCount = (company) => periods.filter((p) => p.company === company).length || 1;
  byTrainer.forEach((t) => {
    t.total = Object.values(t.periods).reduce((s, n) => s + n, 0);
    t.avg = t.total / periodCount(t.company);
  });
  return { periods, byTrainer, periodCount };
}

// ---------- Lost sheep reports ----------
// One report per brand: members without a completed booking in the report window. A lost sheep
// counts against the trainer of their last session; ones with no last session aren't anyone's.
function loadLostSheep(drive) {
  const reports = [];
  const byCompany = {}; // company -> Map(trainer name -> { name, count, clubs: {club: n} })
  for (const file of drive.lostSheep || []) {
    const company = companyOf(file.title + " " + ((file.rows[0] || {}).location || ""));
    const range = (file.title.match(/from\s+(\S+\s*-\s*\S+)/i) || [])[1] || "";
    const per = (byCompany[company] ||= new Map());
    file.rows.forEach((r) => {
      const t = per.get(r.trainer) || { name: r.trainer, count: 0, clubs: {} };
      t.count += r.count;
      const club = clubFromLocation(r.location);
      t.clubs[club] = (t.clubs[club] || 0) + r.count;
      per.set(r.trainer, t);
    });
    reports.push({ company, file: file.file, range, total: file.total, noBooking: file.noBooking,
      trainers: new Set(file.rows.map((r) => r.trainer)).size });
  }
  const index = Object.fromEntries(Object.entries(byCompany).map(([c, m]) => [c, nameIndex([...m.values()])]));
  return { reports, byCompany, index };
}

// ---------- Club KPIs ----------
// The stats sheets (STATS_SHEETS / METRICS in data.js): row 1 = region (only on the first club of
// each region), row 2 = club names, then one row per date. Read as two requests so the header
// text isn't dropped by type guessing. Percentages are kept on a 0-100 scale.
async function loadKPIs() {
  const clubs = new Map(); // company|club -> { company, region, club, kpi: {metric: [{date, v}]} }
  await Promise.all(Object.entries(STATS_SHEETS).flatMap(([company, id]) => METRICS.map(async ({ tab, key: metric }) => {
    const [head, body] = await Promise.all([
      fetchSheet(id, { tab, range: "A1:ZZ2", headers: 0 }),
      fetchSheet(id, { tab, range: "A3:ZZ", headers: 0 }),
    ]);
    const [regions = [], names = []] = head;
    let region = "";
    names.forEach((club, i) => {
      if (regions[i]) region = regions[i];
      if (!i || !club) return;
      const key = `${company}|${club}`;
      if (!clubs.has(key)) clubs.set(key, { company, region, club, kpi: {} });
      const series = body
        .filter((r) => r[0] && !isNaN(Date.parse(r[0])) && num(r[i]) != null)
        .map((r) => ({ date: new Date(r[0]), v: num(r[i]) }))
        .sort((a, b) => a.date - b.date);
      clubs.get(key).kpi[metric] = series;
    });
  })));
  return [...clubs.values()];
}

// ---------- App adoption ----------
async function loadAdoption() {
  const out = [];
  await Promise.all(ADOPTION_SHEET.tabs.map(async ({ tab }) => {
    const rows = await fetchSheet(ADOPTION_SHEET.id, { tab });
    const h = (rows[0] || []).map((v) => v.toLowerCase());
    if (!/^trainer/.test(h[0] || "")) return; // tabs without a header row aren't trainer lists
    const col = (re) => h.findIndex((x) => re.test(x));
    const C = {
      club: col(/^club/), cert: col(/^cert/), billing: col(/billing/), onApp: col(/trainer on app/),
      profile: col(/profile completed/), inApp: col(/clients in app #/), total: col(/total clients #/),
      adoption: col(/client adoption/), completion: col(/weighted completion/), stars: col(/star rating/),
    };
    const splitName = h[1] === ""; // "Trainer" header spanning first + last name columns
    for (const r of rows.slice(1)) {
      const name = (splitName ? `${r[0]} ${r[1]}` : r[0]).trim();
      if (!name) continue;
      const g = (i) => (i >= 0 ? r[i] || "" : "");
      out.push({
        name, tab, club: g(C.club), cert: g(C.cert), billing: num(g(C.billing)),
        onApp: /^y/i.test(g(C.onApp)), profile: /^y/i.test(g(C.profile)),
        clientsInApp: num(g(C.inApp)), totalClients: num(g(C.total)),
        adoption: num(g(C.adoption)), completion: num(g(C.completion)), stars: num(g(C.stars)),
      });
    }
  }));
  return out;
}

// ---------- Simple name lists (onboarding, certifications) ----------
async function loadNameList(sheet) {
  if (!sheet.id) return null;
  const rows = await fetchSheet(sheet.id, { gid: sheet.gid });
  const hi = rows.findIndex((r) => r.some((v) => /name|trainer/i.test(v)));
  if (hi < 0) throw new Error("Couldn't find a name column");
  const h = rows[hi].map((v) => v.toLowerCase().trim());
  const full = h.findIndex((x) => /^(full name|name|trainer name|trainer|employee name)$/.test(x));
  const first = h.findIndex((x) => /^first( name)?$/.test(x)), last = h.findIndex((x) => /^last( name)?$/.test(x));
  // Cert list: a "cert..." column. Onboarding form: "I am a Certified Personal Trainer" + the upload question.
  const certCol = h.findIndex((x) => /^cert/.test(x));
  const certified = h.findIndex((x) => /certified personal trainer/.test(x));
  const upload = h.findIndex((x) => /please upload/.test(x));
  return rows.slice(hi + 1).map((r) => ({
    name: (full >= 0 ? r[full] : `${r[first] || ""} ${r[last] || ""}`).trim(),
    detail: certCol >= 0 ? r[certCol] : "",
    certified: certified >= 0 ? r[certified] : "",
    certUploaded: upload >= 0 && !!r[upload],
  })).filter((x) => x.name);
}

// ---------- Everything, once ----------
// Each source loads independently; one failing doesn't block the others.
// Fires a "dataloaded" event on document when done, which both tabs listen for.
let DATA_PROMISE = null;
function loadAllData(force) {
  if (DATA_PROMISE && !force) return DATA_PROMISE;
  DATA_PROMISE = (async () => {
    const status = {};
    const settle = async (name, fn) => {
      try { const v = await fn(); status[name] = { ok: true }; return v; }
      catch (err) { console.error(name, err); status[name] = { ok: false, error: err.message }; return null; }
    };
    const drive = await settle("drive", fetchDriveData);
    if (!drive) return { status, staff: [], loaded: new Date() };
    if (drive.errors && drive.errors.length) status.drive = { ok: false, error: drive.errors.join("; ") };
    const staffRes = await settle("staff", () => loadStaff(drive));
    const staff = staffRes ? staffRes.staff : [];
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const [kpis, adoption, onboarding, certs, unlogged, lostSheep] = await Promise.all([
      settle("kpis", loadKPIs),
      settle("adoption", loadAdoption),
      settle("onboarding", () => loadNameList(ONBOARDING_SHEET)),
      settle("certs", () => loadNameList(CERT_SHEET)),
      settle("unlogged", () => loadUnlogged(drive, staffById)),
      settle("lostSheep", () => loadLostSheep(drive)),
    ]);
    return { status, drive, staff, staffFiles: staffRes && staffRes.files, staffById, kpis, adoption, onboarding, certs, unlogged, lostSheep, loaded: new Date() };
  })();
  DATA_PROMISE.then((data) => {
    if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("dataloaded", { detail: data }));
  });
  return DATA_PROMISE;
}
