// Sends the weekly top & bottom 5 email: opens the live site in a headless browser, waits for the
// data to load, and calls the page's sendWeeklyReport(), which emails both reports through the
// tracker's Apps Script to the REPORT_EMAILS addresses. Run by .github/workflows/weekly-report.yml.
//
// GitHub's schedule runs in UTC and often starts late (hours, sometimes), so the workflow has two
// cron lines, 10:45 Pacific in standard time (18:45 UTC) and in daylight time (17:45 UTC). SCHEDULE
// is the line that started this run: only the one matching today's Pacific offset sends, however
// late it starts (any time Monday Pacific); it waits until 11:00 if it's early. The other does nothing.
//
// Env: SITE_URL, TRACKER_EDIT_KEY (the Apps Script's EDIT_KEY, if set), FORCE=true to send now,
// SCHEDULE (github.event.schedule).
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
  // Pacific offset today: -7 (daylight) uses the 17:45 UTC line, -8 (standard) the 18:45 one.
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" })
    .formatToParts(new Date()).find((p) => p.type === "timeZoneName").value;
  const myLine = /PDT/.test(tzName) ? "45 17 * * 1" : "45 18 * * 1";
  const schedule = (process.env.SCHEDULE || "").trim();
  const when = `${now.day} ${Math.floor(now.minutes / 60)}:${String(now.minutes % 60).padStart(2, "0")} ${tzName}`;
  if (schedule && schedule !== myLine) {
    console.log(`Started by "${schedule}"; today's send is the "${myLine}" run. Nothing to do (${when}).`);
    process.exit(0);
  }
  if (now.day !== "Mon") {
    console.log(`Not Monday in Pacific time (${when}); nothing to do.`);
    process.exit(0);
  }
  if (now.minutes > 11 * 60) console.log(`Started late (${when}); sending now.`);
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
  // The map's data (bookings, availability) feeds "clubs that need trainers"; send without it if it's slow.
  await page.waitForFunction(() => window.mapDataReady, null, { timeout: 120000 })
    .catch(() => console.warn("Map data didn't load in time; the email won't list clubs that need trainers."));
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
