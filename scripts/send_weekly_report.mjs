// Sends the weekly top & bottom 5 email: opens the live site in a headless browser, waits for the
// data to load, and calls the page's sendWeeklyReport(), which emails both reports through the
// tracker's Apps Script to the REPORT_EMAILS addresses. Run by .github/workflows/weekly-report.yml.
//
// GitHub's schedule runs in UTC and can start late, so the workflow starts it at 10:45 Pacific
// (two cron lines cover standard and daylight time) and this waits until 11:00 Pacific to send.
// A run that lands outside 10:30–11:40 Pacific (the other cron line) does nothing.
//
// Env: SITE_URL, TRACKER_EDIT_KEY (the Apps Script's EDIT_KEY, if set), FORCE=true to send now.
import { chromium } from "playwright";

const SITE = process.env.SITE_URL || "https://torin-perkins.github.io/Interactible-gym-map/";
const force = process.env.FORCE === "true";

function pacificNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: parts.weekday, minutes: +parts.hour * 60 + +parts.minute };
}

const now = pacificNow();
if (!force) {
  if (now.day !== "Mon" || now.minutes < 10 * 60 + 30 || now.minutes > 11 * 60 + 40) {
    console.log(`Not the Monday 11:00 Pacific run (it's ${now.day} ${Math.floor(now.minutes / 60)}:${String(now.minutes % 60).padStart(2, "0")} Pacific); nothing to do.`);
    process.exit(0);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.warn("page error:", e.message));
  await page.goto(`${SITE}?weekly=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof MODEL !== "undefined" && MODEL && MODEL.trainers.length, null, { timeout: 180000 });
  const wait = force ? 0 : Math.max(0, (11 * 60 - pacificNow().minutes) * 60000);
  if (wait) {
    console.log(`Data loaded; waiting ${Math.round(wait / 60000)} min until 11:00 Pacific.`);
    await new Promise((r) => setTimeout(r, wait));
  }
  const res = await page.evaluate((key) => window.sendWeeklyReport({ key, by: "Weekly report (automatic)" }), process.env.TRACKER_EDIT_KEY || "");
  if (!res || !res.ok) throw new Error(`Apps Script refused: ${res && res.error}`);
  console.log(`Weekly report sent to ${res.sent} recipient(s).`);
} finally {
  await browser.close();
}
