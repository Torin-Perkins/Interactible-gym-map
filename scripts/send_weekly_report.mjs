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

// When sending fails, show what the Apps Script actually answers (read-only GETs; nothing is sent).
async function diagnose(url) {
  console.log(`Apps Script URL: ${url}`);
  for (const q of ["?email=1", ""]) {
    try {
      const r = await fetch(url + q, { redirect: "follow" });
      const text = await r.text();
      const plain = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      console.log(`GET ${q || "(tracker)"} -> ${r.status} ${r.headers.get("content-type")} at ${r.url.split("?")[0]}`);
      console.log(`  ${plain.slice(0, 400)}`);
    } catch (e) {
      console.log(`GET ${q || "(tracker)"} -> failed: ${e.message}`);
    }
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
  // The page builds the email; it's sent from here rather than from the page, because a browser
  // can't read an Apps Script error page (it reports "Failed to fetch"), while this can log it.
  // (Catching postReportEmail too works with a live page from before the build option existed.)
  const { url, email } = await page.evaluate(async () => {
    let caught = null;
    const post = window.postReportEmail;
    window.postReportEmail = async (email) => { caught = email; return { ok: true }; };
    try {
      const built = await window.sendWeeklyReport({ build: true });
      return built && built.email ? built : { url: TRACKER_DB.url, email: caught };
    } finally {
      window.postReportEmail = post;
    }
  });
  if (!email) throw new Error("the page didn't build the report email");
  const r = await fetch(url, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ key: process.env.TRACKER_EDIT_KEY || "", by: "Weekly report (automatic)", email }),
  });
  const text = await r.text();
  let res = null;
  try { res = JSON.parse(text); } catch {}
  if (!res) {
    const plain = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await diagnose(url);
    throw new Error(`Apps Script answered ${r.status} with a page instead of JSON: ${plain.slice(0, 600)}`);
  }
  if (!res.ok) throw new Error(`Apps Script refused: ${res.error}`);
  console.log(`Weekly report sent to ${res.sent} recipient(s).`);
} finally {
  await browser.close();
}
