/**
 * Shared trainer tracker database for the gym map site.
 *
 * Stores the values people type into the Trainer stats tab (onboarded / cert overrides,
 * billing health, notes) in a "Tracker" tab of the Google Sheet this script is attached to.
 * The sheet itself can stay private: the web app runs as you and only exposes these two calls.
 *
 *   GET  <web app url>                -> { ok, records: [{ id, onboarded, cert, billing, notes, updated, by }] }
 *   POST <web app url>  body (JSON as text/plain):
 *        { key, by, records: [{ id, name, club, onboarded, cert, billing, notes }] }
 *        Each record replaces that trainer's row; a blank / null value means "use the automatic value".
 *
 * Rates page (trainer pay rates): the page encrypts the rates with the rates password before
 * sending them, so the sheet and this script only ever see ciphertext.
 *   GET  <web app url>?rates=1        -> { ok, rates: { blob, saved, by, version } | null }
 *   POST <web app url>  body: { key, by, rates: { blob, base } }
 *        Appends a new version to the "Rates" tab (older versions stay as history). base is the
 *        version the edit started from; if someone saved since, the save is refused ("conflict").
 *
 * Setup: see apps-script/README.md.
 */

const TAB = "Tracker";
const HEADERS = ["User ID", "Trainer", "Club", "Onboarded", "Cert on file", "Billing health %", "Notes", "Updated", "Updated by"];

const RATES_TAB = "Rates";
const RATES_HEADERS = ["Saved", "Saved by", "Encrypted rates"];

function doGet(e) {
  if (e && e.parameter && e.parameter.rates) return json_({ ok: true, rates: latestRates_() });
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues().slice(1);
  const records = rows.filter((r) => r[0] !== "").map((r) => ({
    id: String(r[0]),
    onboarded: yesNo_(r[3]),
    cert: yesNo_(r[4]),
    billing: r[5] === "" ? null : Number(r[5]),
    notes: String(r[6] || ""),
    updated: r[7] instanceof Date ? r[7].toISOString() : String(r[7] || ""),
    by: String(r[8] || ""),
  }));
  return json_({ ok: true, records });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "Bad request" });
  }
  const key = PropertiesService.getScriptProperties().getProperty("EDIT_KEY");
  if (key && body.key !== key) return json_({ ok: false, error: "bad key" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.rates) return json_(saveRates_(body.rates, String(body.by || "").slice(0, 80)));
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const rowOf = new Map(values.slice(1).map((r, i) => [String(r[0]), i + 2]));
    const now = new Date();
    const by = String(body.by || "").slice(0, 80);
    let saved = 0;
    (body.records || []).forEach((rec) => {
      const id = String(rec.id || "").trim();
      if (!/^\d+$/.test(id)) return;
      const row = [
        id, String(rec.name || "").slice(0, 120), String(rec.club || "").slice(0, 120),
        rec.onboarded == null ? "" : rec.onboarded ? "Yes" : "No",
        rec.cert == null ? "" : rec.cert ? "Yes" : "No",
        rec.billing == null || rec.billing === "" || isNaN(rec.billing) ? "" : Number(rec.billing),
        String(rec.notes || "").slice(0, 2000),
        now, by,
      ];
      const empty = row[3] === "" && row[4] === "" && row[5] === "" && row[6] === "";
      if (rowOf.has(id)) {
        sheet.getRange(rowOf.get(id), 1, 1, row.length).setValues([row]);
      } else if (!empty) {
        sheet.appendRow(row);
        rowOf.set(id, sheet.getLastRow());
      }
      saved++;
    });
    return json_({ ok: true, saved });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TAB);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("@"); // keep User IDs as text
  }
  return sheet;
}

function ratesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RATES_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(RATES_TAB);
    sheet.appendRow(RATES_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// The newest row is the current version; its row number is the version.
function latestRates_() {
  const sheet = ratesSheet_();
  const n = sheet.getLastRow();
  if (n < 2) return null;
  const r = sheet.getRange(n, 1, 1, 3).getValues()[0];
  return { blob: String(r[2]), saved: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), by: String(r[1] || ""), version: n };
}

function saveRates_(rates, by) {
  const blob = String(rates.blob || "");
  if (!blob || blob.length > 45000) return { ok: false, error: "Bad request" }; // one sheet cell holds 50,000 characters
  const cur = latestRates_();
  if ((cur ? cur.version : 0) !== Number(rates.base || 0)) return { ok: false, error: "conflict" };
  const sheet = ratesSheet_();
  sheet.appendRow([new Date(), by, blob]);
  return { ok: true, version: sheet.getLastRow() };
}

function yesNo_(v) {
  if (v === true || /^y/i.test(String(v))) return true;
  if (v === false || /^n/i.test(String(v))) return false;
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
