// ---------- Rates tab ----------
// Trainer pay rates behind a password. The rates are encrypted in the browser (AES-GCM, key
// derived from the password with PBKDF2) and only the ciphertext is stored: in the "Rates" tab of
// the shared tracker sheet when TRACKER_DB.url is set (apps-script/Code.gs), otherwise in this
// browser. Nothing readable is in the site files, so the page source gives nothing away.

const RATES_LOCAL = "rates.v1";
const RATE_TYPES = ["Per session", "Hourly", "Salary", "Commission %", "Bonus"];
const RATE_COLS = ["Trainer", "Club", "Company", "Role", "Pay type", "Rate", "Effective", "Notes"];
const RATE_FIELDS = ["trainer", "club", "company", "role", "type", "rate", "effective", "notes"];
const PBKDF2_ITER = 600000;

let RATES = null; // { rows: [...] } once unlocked
let ratesKey = null, ratesSalt = null, ratesPw = ""; // kept in memory only, cleared on Lock
let ratesVersion = 0; // version the edits are based on (row number in the Rates tab)
let ratesSetup = false; // no rates saved yet: the first password typed becomes the password
const ratesSort = { key: "trainer", dir: 1 };
const ratesDirty = new Set(), ratesDeleted = new Set(); // row ids changed since the last save
let ratesTimer = null;

// ---------- Encryption ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pw, salt, iter = PBKDF2_ITER) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptRates(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ratesKey, new TextEncoder().encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, iter: PBKDF2_ITER, salt: b64(ratesSalt), iv: b64(iv), ct: b64(ct) });
}
// Throws on a wrong password (AES-GCM checks the data hasn't been tampered with, too).
async function decryptRates(blob, pw) {
  const b = JSON.parse(blob);
  const salt = unb64(b.salt);
  const key = await deriveKey(pw, salt, b.iter);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(b.iv) }, key, unb64(b.ct));
  return { data: JSON.parse(new TextDecoder().decode(pt)), key, salt };
}

// ---------- Storage ----------
async function ratesFetch() {
  if (!SHARED) {
    try { return JSON.parse(localStorage.getItem(RATES_LOCAL)); } catch { return null; }
  }
  const res = await fetch(`${TRACKER_DB.url}?rates=1`, { credentials: "omit" });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "couldn't read the rates");
  if (!("rates" in body)) throw new Error("the tracker's Apps Script needs the latest Code.gs (see apps-script/README.md)");
  return body.rates;
}
async function ratesPost(blob) {
  if (!SHARED) {
    try { localStorage.setItem(RATES_LOCAL, JSON.stringify({ blob, version: ratesVersion + 1, saved: new Date().toISOString() })); }
    catch { return { ok: false, error: "this browser won't store data" }; }
    return { ok: true, version: ratesVersion + 1 };
  }
  const res = await fetch(TRACKER_DB.url, {
    method: "POST", credentials: "omit",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request: no CORS preflight
    body: JSON.stringify({ key: pref("trackerEditKey"), by: pref("trackerName"), rates: { blob, base: ratesVersion } }),
  });
  const body = await res.json();
  if (body.ok && body.version == null) return { ok: false, error: "the tracker's Apps Script needs the latest Code.gs (see apps-script/README.md)" };
  return body;
}

// ---------- Lock screen ----------
function ratesLockMsg(text) { $("ratesLockMsg").textContent = text; }
async function ratesShowLock() {
  $("ratesLock").hidden = false;
  $("ratesCard").hidden = true;
  ratesLockMsg("");
  $("ratesStatus").textContent = "Checking for saved rates…";
  $("ratesUnlock").disabled = true;
  try {
    const cur = await ratesFetch();
    ratesSetup = !cur;
    $("ratesStatus").textContent = cur
      ? `Last saved ${new Date(cur.saved).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${cur.by ? ` by ${cur.by}` : ""}`
      : "No rates saved yet";
  } catch (err) {
    console.error(err);
    ratesSetup = false;
    $("ratesStatus").textContent = "";
    ratesLockMsg(`Couldn't load the rates: ${err.message}`);
    return;
  } finally {
    $("ratesUnlock").disabled = false;
  }
  $("ratesLockTitle").textContent = ratesSetup ? "Set a rates password" : "Rates are password protected";
  $("ratesLockHint").textContent = ratesSetup
    ? "Nothing's been saved here yet. Choose the password your team will use to open this page. It can't be recovered, so keep it somewhere safe."
    : "Enter the rates password to view and edit trainer pay rates.";
  $("ratesPw2Row").hidden = !ratesSetup;
  $("ratesPw").autocomplete = ratesSetup ? "new-password" : "current-password";
  $("ratesUnlock").textContent = ratesSetup ? "Set password" : "Unlock";
  $("ratesPw").focus();
}

$("ratesLockForm").onsubmit = async (e) => {
  e.preventDefault();
  const pw = $("ratesPw").value;
  ratesLockMsg("");
  $("ratesUnlock").disabled = true;
  try {
    if (ratesSetup) {
      if (pw.length < 8) return ratesLockMsg("Use at least 8 characters.");
      if (pw !== $("ratesPw2").value) return ratesLockMsg("The passwords don't match.");
      ratesSalt = crypto.getRandomValues(new Uint8Array(16));
      ratesKey = await deriveKey(pw, ratesSalt);
      ratesPw = pw;
      ratesVersion = 0;
      RATES = { rows: [] };
      ratesDirty.add("*"); // save the empty table so the password is set for everyone
      ratesQueueSave(0);
    } else {
      $("ratesUnlock").textContent = "Unlocking…";
      const cur = await ratesFetch();
      if (!cur) return ratesShowLock(); // the rates were cleared since the page loaded
      let opened;
      try { opened = await decryptRates(cur.blob, pw); }
      catch { return ratesLockMsg("That password isn't right."); }
      ({ key: ratesKey, salt: ratesSalt } = opened);
      ratesPw = pw;
      RATES = { rows: opened.data.rows || [] };
      ratesVersion = cur.version;
    }
    $("ratesPw").value = $("ratesPw2").value = "";
    $("ratesLock").hidden = true;
    $("ratesCard").hidden = false;
    renderRates();
  } catch (err) {
    console.error(err);
    ratesLockMsg(`Couldn't open the rates: ${err.message}`);
  } finally {
    $("ratesUnlock").disabled = false;
    $("ratesUnlock").textContent = ratesSetup ? "Set password" : "Unlock";
  }
};

function ratesLock() {
  if (ratesDirty.size && !confirm("Some changes haven't saved yet. Lock anyway and lose them?")) return;
  clearTimeout(ratesTimer);
  ratesDirty.clear(); ratesDeleted.clear();
  RATES = ratesKey = ratesSalt = null;
  ratesPw = "";
  $("ratesTable").innerHTML = "";
  ratesShowLock();
}
$("rLock").onclick = ratesLock;

// ---------- Saving ----------
// Edits are batched like the trainer tracker. If someone else saved in the meantime, their
// version is loaded and the rows changed here are put back on top of it, then saved again.
function ratesSaveStatus(text, bad) {
  $("rSaveStatus").textContent = text;
  $("rSaveStatus").classList.toggle("bad", !!bad);
}
function ratesQueueSave(delay = 800) {
  ratesSaveStatus("Unsaved changes…");
  clearTimeout(ratesTimer);
  ratesTimer = setTimeout(ratesSave, delay);
}
async function ratesSave() {
  if (!ratesDirty.size || !ratesKey) return;
  const changed = new Set(ratesDirty), deleted = new Set(ratesDeleted);
  ratesDirty.clear(); ratesDeleted.clear();
  const retry = () => { changed.forEach((id) => ratesDirty.add(id)); deleted.forEach((id) => ratesDeleted.add(id)); };
  ratesSaveStatus("Saving…");
  try {
    const body = await ratesPost(await encryptRates(RATES));
    if (!body.ok) {
      retry();
      if (body.error === "conflict") return ratesMerge();
      if (body.error === "bad key") {
        $("rKeyRow").hidden = false;
        ratesSaveStatus(pref("trackerEditKey") ? "That edit key didn't work — check it and save again" : "Enter the edit key to save your changes", true);
        $("rKey").focus();
      } else ratesSaveStatus(`Couldn't save: ${body.error}`, true);
      return;
    }
    ratesVersion = body.version;
    $("rKeyRow").hidden = true;
    ratesSaveStatus(`Saved${SHARED ? " to the shared tracker" : " in this browser"} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  } catch (err) {
    console.error(err);
    retry();
    ratesSaveStatus("Couldn't reach the shared tracker — your changes will retry", true);
    ratesQueueSave(15000);
  }
}
async function ratesMerge() {
  ratesSaveStatus("Someone else saved rates — merging…");
  try {
    const cur = await ratesFetch();
    let theirs;
    try { theirs = await decryptRates(cur.blob, ratesPw); }
    catch { return ratesSaveStatus("The rates password was changed by someone else. Lock and unlock with the new password; your latest changes weren't saved.", true); }
    const mine = new Map(RATES.rows.map((r) => [r.id, r]));
    const rows = theirs.data.rows.filter((r) => !ratesDeleted.has(r.id))
      .map((r) => (ratesDirty.has(r.id) && mine.has(r.id) ? mine.get(r.id) : r));
    const have = new Set(rows.map((r) => r.id));
    ratesDirty.forEach((id) => { if (mine.has(id) && !have.has(id)) rows.push(mine.get(id)); });
    RATES = { rows };
    ({ key: ratesKey, salt: ratesSalt } = theirs);
    ratesVersion = cur.version;
    renderRates();
    ratesSave();
  } catch (err) {
    console.error(err);
    ratesSaveStatus(`Couldn't merge with the saved rates: ${err.message}`, true);
  }
}
$("rKeySave").onclick = () => { pref("trackerEditKey", $("rKey").value.trim()); ratesSave(); };
$("rKey").onkeydown = (e) => { if (e.key === "Enter") $("rKeySave").click(); };
window.addEventListener("beforeunload", (e) => { if (ratesDirty.size) { e.preventDefault(); e.returnValue = ""; } });

$("rChangePw").onclick = async () => {
  const pw = prompt("New rates password (at least 8 characters). Everyone will need the new one to open this page.");
  if (pw == null) return;
  if (pw.length < 8) return alert("Use at least 8 characters.");
  if (prompt("Type the new password again to confirm.") !== pw) return alert("The passwords don't match. Nothing was changed.");
  ratesSalt = crypto.getRandomValues(new Uint8Array(16));
  ratesKey = await deriveKey(pw, ratesSalt);
  ratesPw = pw;
  ratesDirty.add("*");
  ratesQueueSave(0);
};

// ---------- Table ----------
const newRateId = () => Math.random().toString(36).slice(2, 10);
const rateSortVal = (r, k) => (k === "rate" ? Number(r.rate) || 0 : String(r[k] || "").toLowerCase());
const fmtRate = (r) => (r.rate === "" || r.rate == null ? "" : r.type === "Commission %" ? `${r.rate}%` : `$${Number(r.rate).toFixed(2)}`);

// Trainers from the staff lists, to fill in club and company when a name is picked.
function rateTrainers() { return (typeof MODEL !== "undefined" && MODEL ? MODEL.trainers : []); }
function fillTrainerList() {
  $("rTrainerList").innerHTML = rateTrainers().map((t) => `<option value="${esc(t.name)}">${esc(t.club)} · ${esc(t.company)}</option>`).join("");
}

function renderRates() {
  if (!RATES) return;
  fillTrainerList();
  const q = $("rSearch").value.trim().toLowerCase();
  const rows = RATES.rows
    .filter((r) => !q || RATE_FIELDS.some((k) => String(r[k] ?? "").toLowerCase().includes(q)))
    .sort((a, b) => {
      const k = ratesSort.key;
      if (!k) return 0;
      const x = rateSortVal(a, k), y = rateSortVal(b, k);
      return (x < y ? -1 : x > y ? 1 : 0) * ratesSort.dir
        || String(a.company || "").localeCompare(b.company || "") || String(a.club || "").localeCompare(b.club || "");
    });
  const cols = [["trainer", "Trainer"], ["club", "Club"], ["company", "Company"], ["role", "Role"], ["type", "Pay type"],
    ["rate", "Rate"], ["effective", "Effective"], ["notes", "Notes"]];
  const head = cols.map(([k, l]) => `<th data-k="${k}" class="${k === "rate" ? "num " : ""}${ratesSort.key === k ? (ratesSort.dir > 0 ? "asc" : "desc") : ""}">${l}</th>`).join("");
  const input = (r, k, attrs = "") => `<input data-id="${esc(r.id)}" data-f="${k}" value="${esc(r[k] ?? "")}" ${attrs}>`;
  const body = rows.map((r) => `<tr>
    <td>${input(r, "trainer", `list="rTrainerList" placeholder="All in role"`)}</td>
    <td>${input(r, "club")}</td>
    <td>${input(r, "company")}</td>
    <td>${input(r, "role", `placeholder="e.g. PT, Head trainer"`)}</td>
    <td><select data-id="${esc(r.id)}" data-f="type">${RATE_TYPES.map((t) => `<option${t === r.type ? " selected" : ""}>${t}</option>`).join("")}</select></td>
    <td class="num">${input(r, "rate", `type="number" step="0.01" min="0" inputmode="decimal" title="${esc(fmtRate(r))}"`)}</td>
    <td>${input(r, "effective", `type="date"`)}</td>
    <td>${input(r, "notes")}</td>
    <td><button type="button" class="link" data-del="${esc(r.id)}" title="Delete this rate">Delete</button></td>
  </tr>`).join("");
  const empty = RATES.rows.length ? "No rates match your search." : "No rates yet. Click Add rate, or import a CSV.";
  $("ratesTable").innerHTML = `<thead><tr>${head}<th></th></tr></thead><tbody>${body || `<tr><td class="empty" colspan="9">${empty}</td></tr>`}</tbody>`;
  $("ratesStatus").textContent = `${RATES.rows.length} rate${RATES.rows.length === 1 ? "" : "s"} · unlocked`;
}

function setRate(id, field, value) {
  const r = RATES.rows.find((x) => x.id === id);
  if (!r || r[field] === value) return;
  r[field] = value;
  if (field === "trainer") {
    // A trainer picked from the staff lists fills in their club and company.
    const t = rateTrainers().find((x) => x.name.toLowerCase() === value.trim().toLowerCase());
    r.trainerId = t ? t.id : "";
    if (t) { r.club = t.club; r.company = t.company; }
  }
  ratesDirty.add(id);
  ratesQueueSave();
  if (field === "trainer") renderRates();
}
$("ratesTable").addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.f) setRate(el.dataset.id, el.dataset.f, el.dataset.f === "rate" && el.value !== "" ? Number(el.value) : el.value);
});
$("ratesTable").addEventListener("click", (e) => {
  const th = e.target.closest("th[data-k]");
  if (th) {
    ratesSort.dir = ratesSort.key === th.dataset.k ? -ratesSort.dir : 1;
    ratesSort.key = th.dataset.k;
    return renderRates();
  }
  const id = e.target.dataset.del;
  if (id && confirm("Delete this rate?")) {
    RATES.rows = RATES.rows.filter((r) => r.id !== id);
    ratesDeleted.add(id); ratesDirty.add(id);
    ratesQueueSave();
    renderRates();
  }
});
$("rSearch").oninput = renderRates;
$("rAdd").onclick = () => {
  const r = { id: newRateId(), trainer: "", trainerId: "", club: "", company: "", role: "", type: RATE_TYPES[0], rate: "", effective: "", notes: "" };
  RATES.rows.push(r);
  ratesDirty.add(r.id);
  $("rSearch").value = "";
  ratesSort.key = ""; // keep the new row at the bottom until the table is sorted again
  renderRates();
  ratesQueueSave();
  const el = $("ratesTable").querySelector(`input[data-id="${r.id}"]`);
  if (el) el.focus();
};

// ---------- CSV ----------
$("rExport").onclick = () => {
  const lines = [RATE_COLS.join(",")].concat(RATES.rows.map((r) =>
    RATE_FIELDS.map((k) => r[k]).map(csvCell).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `rates-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
// Adds the CSV's rows (same columns as Export; header names matched loosely, any order).
$("rImport").onchange = async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const [h = [], ...rows] = parseCSV(await file.text()).filter((r) => r.some((c) => c.trim()));
  const hn = h.map((x) => x.trim().toLowerCase());
  // An exact header name wins over one that only starts with it ("Pay type" isn't the "Pay" column).
  const col = (...names) => {
    const i = hn.findIndex((x) => names.includes(x));
    return i >= 0 ? i : hn.findIndex((x) => names.some((n) => x.startsWith(n)) && !/type/.test(x) === !names.some((n) => /type/.test(n)));
  };
  const c = { trainer: col("trainer", "name"), club: col("club", "location"), company: col("company", "brand"), role: col("role", "position", "title"),
    type: col("pay type", "type"), rate: col("rate", "pay rate", "pay", "amount"), effective: col("effective", "date"), notes: col("note") };
  if (c.rate < 0) return alert(`Couldn't find a Rate column in ${file.name}. Use the same columns as Export CSV.`);
  const get = (r, k) => (c[k] >= 0 ? String(r[c[k]] ?? "").trim() : "");
  const added = rows.map((r) => {
    const type = RATE_TYPES.find((t) => t.toLowerCase() === get(r, "type").toLowerCase()) || RATE_TYPES[0];
    const rate = get(r, "rate").replace(/[$,%\s]/g, "");
    const row = { id: newRateId(), trainer: get(r, "trainer"), trainerId: "", club: get(r, "club"), company: get(r, "company"),
      role: get(r, "role"), type, rate: rate === "" || isNaN(rate) ? "" : Number(rate), effective: get(r, "effective"), notes: get(r, "notes") };
    const t = row.trainer && rateTrainers().find((x) => x.name.toLowerCase() === row.trainer.toLowerCase());
    if (t) { row.trainerId = t.id; row.club ||= t.club; row.company ||= t.company; }
    return row;
  });
  if (!added.length || !confirm(`Add ${added.length} rate${added.length === 1 ? "" : "s"} from ${file.name}?`)) return;
  RATES.rows.push(...added);
  added.forEach((r) => ratesDirty.add(r.id));
  renderRates();
  ratesQueueSave(0);
};

// ---------- Tab ----------
document.addEventListener("viewchange", (e) => { if (e.detail === "rates" && !RATES) ratesShowLock(); });
document.addEventListener("dataloaded", () => { if (RATES) renderRates(); });
if (!$("view-rates").hidden) ratesShowLock();
