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
 * Setup: see apps-script/README.md.
 */

const TAB = "Tracker";
const HEADERS = ["User ID", "Trainer", "Club", "Onboarded", "Cert on file", "Billing health %", "Notes", "Updated", "Updated by"];

function doGet() {
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

function yesNo_(v) {
  if (v === true || /^y/i.test(String(v))) return true;
  if (v === false || /^n/i.test(String(v))) return false;
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
