// ---------- Shepherd: win back lost sheep ----------
// A trainer picks their club and enters its code to open that club's lost sheep (shepherd.json,
// built from the lost sheep reports by scripts/build_drive_data.py, each club encrypted with its own
// code). Members are ranked by how likely they are to come back, and each gets a text message
// written for their situation, sent from the trainer's own phone (an sms: link). Who texted whom
// is kept in the tracker's Apps Script ("Shepherd" tab) so the team doesn't double-text.

const SH = { data: null, club: null, members: [], log: {}, filter: "hot", search: "", shown: 40, variant: {} };
const SH_STATUSES = ["Texted", "Replied", "Booked", "Not interested", "Wrong number"];
const SH_GYM = { GRIP: "LA Fitness", Elevate: "Fitness Connection", Lighthouse: "10GYM" };
const shToday = () => new Date(new Date().toDateString());
const daysSince = (iso) => (iso ? Math.floor((shToday() - new Date(`${iso}T00:00`)) / 864e5) : null);
const firstName = (name) => {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  return f ? f[0].toUpperCase() + f.slice(1).toLowerCase() : "there";
};
const shStatus = (text, bad) => { $("shStatus").textContent = text; $("shStatus").classList.toggle("bad", !!bad); };

// ---------- Ranking ----------
// Most likely to come back first: paid sessions they haven't used, still paying by autopay, paid
// before, trained recently. Recent contact, no-shows and cancellations push them down; frozen
// memberships and members sent to collections are parked.
function scoreMember(m) {
  const why = [];
  let score = 0, parked = "";
  if (m.frozen && (!m.freezeEnds || m.freezeEnds >= shToday().toISOString().slice(0, 10))) parked = `Frozen${m.freezeEnds ? ` until ${fmtDay(m.freezeEnds)}` : ""}`;
  if (/collection/i.test(m.cancelReason)) parked = "Sent to collections";
  if (m.sessions > 0) { score += 30 + Math.min(m.sessions, 10) * 2; why.push(`${m.sessions} paid session${m.sessions === 1 ? "" : "s"} unused`); }
  if (m.status === "Active" && m.eft) { score += 50; why.push("still paying (autopay)"); }
  else if (m.status === "Active") { score += 25; why.push("active membership"); }
  else if (/inactive|expired/i.test(m.status) && (m.lastBooking || m.sessions > 0)) { score += 20; why.push("paid before"); }
  else if (m.status === "Prospect" && m.lastBooking) { score += 5; why.push("tried a session"); }
  const d = daysSince(m.lastBooking);
  if (d != null) {
    score += d <= 30 ? 15 : d <= 60 ? 10 : d <= 120 ? 5 : 0;
    why.push(`last session ${d} days ago${m.lastWith ? ` with ${m.lastWith}` : ""}`);
  } else why.push("no sessions yet");
  const exp = daysSince(m.expires);
  if (m.status === "Active" && exp != null && exp <= 0 && exp >= -30) { score += 5; why.push(`membership term ends ${fmtDay(m.expires)}`); }
  if (m.noShows) { score -= 5 * m.noShows; why.push(`${m.noShows} no-show${m.noShows === 1 ? "" : "s"}`); }
  if (m.cancelReason && !parked) { score -= 15; why.push(`cancelled: ${m.cancelReason}`); }
  const log = SH.log[m.id];
  const contacted = [log && log.at ? daysSince(log.at.slice(0, 10)) : null, daysSince(m.lastContact)].filter((x) => x != null);
  const recent = contacted.length ? Math.min(...contacted) : null;
  if (recent != null && recent <= 7) score -= 30; else if (recent != null && recent <= 14) score -= 15;
  const tier = parked ? "parked" : score >= 70 ? "hot" : score >= 40 ? "warm" : "cool";
  return { score, why, tier, parked, recent };
}

// ---------- Messages ----------
// A few versions per situation; "Shuffle" moves to the next. The trainer can edit before sending.
function messageFor(m, variant) {
  const me = (pref("shepherdName") || "your trainer").trim(), myFirst = firstName(me) === "there" ? me : firstName(me);
  const first = firstName(m.name), club = SH.club ? SH.club.club : "the club", gym = SH_GYM[SH.club && SH.club.company] || "the gym";
  const place = `${gym} ${club}`;
  const lastWith = m.lastWith && firstName(m.lastWith) !== myFirst ? firstName(m.lastWith) : "";
  const n = m.sessions;
  let opts;
  if (n > 0) {
    opts = [
      `Hi ${first}, it's ${myFirst}, a trainer at ${place}. You still have ${n} training session${n === 1 ? "" : "s"} waiting for you! Want me to save you a spot this week?`,
      `Hey ${first}! ${myFirst} here from personal training at ${place}. I noticed you've got ${n} session${n === 1 ? "" : "s"} left on your account. Let's get you back in. What day works best this week?`,
      `Hi ${first}, this is ${myFirst} at ${place}. ${lastWith ? `I know you were training with ${lastWith}, and ` : ""}I'd love to help you use the ${n} session${n === 1 ? "" : "s"} you have left. Are mornings or evenings better for you?`,
    ];
  } else if (m.status === "Active") {
    opts = [
      `Hi ${first}, it's ${myFirst}, a trainer at ${place}. We haven't seen you in a while and I'd love to help you get back on track. Want to come in for a session this week?`,
      `Hey ${first}! ${myFirst} from personal training at ${place} here. Just checking in. How are your goals going? I've got some openings this week if you'd like to get back at it.`,
    ];
  } else if (m.lastBooking || /inactive|expired/i.test(m.status)) {
    opts = [
      `Hi ${first}, it's ${myFirst} at ${place}. It's been a little while${lastWith ? ` since your sessions with ${lastWith}` : " since your last session"}. I'd love to help you pick back up where you left off. Free to come in this week?`,
      `Hey ${first}! ${myFirst} here, a trainer at ${place}. We miss seeing you! If you're ready to get back into a routine, I'd be happy to set something up that fits your schedule.`,
    ];
  } else {
    opts = [
      `Hi ${first}, this is ${myFirst}, a trainer at ${place}. I'd love to set up a time to talk about your fitness goals. Does any day this week work for you?`,
      `Hey ${first}! ${myFirst} from personal training at ${place}. If you're looking for help reaching a goal, I've got some time this week. Want to set up a quick session?`,
    ];
  }
  const text = opts[variant % opts.length];
  return pref("shepherdOptOut") === "1" ? `${text} Reply STOP to opt out.` : text;
}

// ---------- Sign in ----------
async function shLoad() {
  if (SH.data) return SH.data;
  const res = await fetch(`shepherd.json?_=${Date.now()}`);
  if (!res.ok) throw new Error("Shepherd isn't set up yet: the deploy needs the RATES_PASSWORD repo secret");
  SH.data = await res.json();
  return SH.data;
}
async function shInit() {
  $("shName").value = pref("shepherdName");
  $("shOptOut").checked = pref("shepherdOptOut") === "1";
  try {
    const d = await shLoad();
    const groups = {};
    d.clubs.forEach((c) => (groups[c.company] ||= []).push(c));
    $("shClub").innerHTML = `<option value="">Choose your club</option>` + Object.entries(groups).map(([co, cs]) =>
      `<optgroup label="${esc(BRANDS[co] ? BRANDS[co].label : co)}">${cs.map((c) => `<option value="${esc(c.key)}">${esc(c.club)} (${fmtNum(c.count)})</option>`).join("")}</optgroup>`).join("");
    $("shClub").value = pref("shepherdClub") || "";
    $("shSub").textContent = `Lost sheep reports as of ${new Date(d.generated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    // Reopen this browser tab's club without the code again.
    const saved = sessionStorage.getItem("shepherdCode");
    if (saved && $("shClub").value && !SH.club) shOpen(saved);
  } catch (err) {
    console.error(err);
    shStatus(err.message, true);
  }
}
async function shOpen(codeIn) {
  const key = $("shClub").value, name = $("shName").value.trim();
  const code = (codeIn || $("shCode").value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!name) return shStatus("Enter your name: it goes in your texts and the team's log.", true);
  if (!key) return shStatus("Choose your club.", true);
  if (!code) return shStatus("Enter your club's code.", true);
  pref("shepherdName", name);
  pref("shepherdClub", key);
  const club = SH.data.clubs.find((c) => c.key === key);
  $("shOpenBtn").disabled = true;
  shStatus("Opening…");
  try {
    let opened;
    try { opened = await decryptRates(JSON.stringify(club.blob), code); }
    catch { try { sessionStorage.removeItem("shepherdCode"); } catch {} return shStatus("That code isn't right for this club. Ask your manager for your club's code.", true); }
    try { sessionStorage.setItem("shepherdCode", code); } catch {}
    SH.club = club;
    SH.range = opened.data.range;
    SH.members = opened.data.members.filter((m) => m.name);
    SH.shown = 40;
    shStatus("");
    await shLoadLog();
    $("shSignIn").hidden = true;
    $("shApp").hidden = false;
    shRender();
  } finally {
    $("shOpenBtn").disabled = false;
  }
}
async function shLoadLog() {
  SH.log = {};
  if (!TRACKER_DB.url) return;
  try {
    const body = await (await fetch(`${TRACKER_DB.url}?shepherd=${encodeURIComponent(SH.club.key)}`, { credentials: "omit" })).json();
    (body.log || []).forEach((x) => (SH.log[x.id] = x));
    SH.logOk = "log" in body;
  } catch (err) {
    console.error(err);
    SH.logOk = false;
  }
}
async function shLogStatus(m, status, channel = "") {
  const entry = { id: m.id, status, by: pref("shepherdName"), channel, at: new Date().toISOString() };
  if (status === "Clear") delete SH.log[m.id]; else SH.log[m.id] = entry;
  shRender();
  if (!TRACKER_DB.url) return;
  try {
    const res = await (await fetch(TRACKER_DB.url, {
      method: "POST", credentials: "omit", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ shepherd: { club: SH.club.key, id: m.id, status, by: entry.by, channel } }),
    })).json();
    if (!res.ok) throw new Error(res.error);
  } catch (err) {
    console.error(err);
    shStatus(`Couldn't save to the team log${SH.logOk === false ? " (the tracker's Apps Script needs the latest Code.gs)" : ""}: it's only on this device for now.`, true);
  }
}

// ---------- List ----------
function shRender() {
  const ranked = SH.members.map((m) => ({ m, s: scoreMember(m) })).sort((a, b) => b.s.score - a.s.score || a.m.name.localeCompare(b.m.name));
  const inProgress = (x) => SH.log[x.m.id] && SH.log[x.m.id].status !== "Clear";
  const counts = { hot: 0, warm: 0, cool: 0, parked: 0, contacted: 0 };
  ranked.forEach((x) => { if (inProgress(x)) counts.contacted++; else counts[x.s.tier]++; });
  const q = SH.search.trim().toLowerCase();
  const list = ranked.filter((x) => (SH.filter === "contacted" ? inProgress(x) : !inProgress(x) && (SH.filter === "all" || x.s.tier === SH.filter))
    && (!q || x.m.name.toLowerCase().includes(q)));
  $("shWho").textContent = `${pref("shepherdName")} · ${SH.club.club} (${SH.club.company}) · ${fmtNum(SH.members.length)} lost sheep${SH.range ? ` · no completed booking ${SH.range}` : ""}`;
  const tabs = [["hot", "Hot"], ["warm", "Warm"], ["cool", "Cool"], ["contacted", "In progress"], ["parked", "Parked"], ["all", "All not contacted"]];
  $("shFilters").innerHTML = tabs.map(([k, l]) => `<button type="button" class="ta-cat${SH.filter === k ? " on" : ""}" data-shf="${k}">${l}${k !== "all" ? ` <b>${fmtNum(counts[k])}</b>` : ""}</button>`).join("");
  $("shList").innerHTML = list.slice(0, SH.shown).map(({ m, s }) => {
    const log = SH.log[m.id], v = SH.variant[m.id] || 0, msg = messageFor(m, v);
    const phone = m.phone ? `(${m.phone.slice(0, 3)}) ${m.phone.slice(3, 6)}-${m.phone.slice(6)}` : "";
    return `<article class="sh-card" data-id="${esc(m.id)}">
      <div class="sh-top">
        <div><b class="sh-name">${esc(m.name)}</b> <span class="sh-tier ${s.tier}">${s.parked ? esc(s.parked) : { hot: "Hot", warm: "Warm", cool: "Cool" }[s.tier]}</span>
          <div class="cell-sub">${esc(m.status)}${m.eft ? " · autopay" : ""}${m.type ? ` · ${esc(m.type)}` : ""}${phone ? ` · ${esc(phone)}` : " · no cell number"}</div></div>
        <div class="sh-score" title="How likely they are to come back (higher = more likely)">${s.score}</div>
      </div>
      <div class="sh-why">${s.why.map((w) => `<span>${esc(w)}</span>`).join("")}</div>
      ${s.recent != null && s.recent <= 30 ? `<div class="cell-sub sh-contacted">Last contacted ${s.recent === 0 ? "today" : `${s.recent} day${s.recent === 1 ? "" : "s"} ago`}${m.contactedBy && (!log || daysSince(m.lastContact) === s.recent) ? ` by ${esc(m.contactedBy)}${m.contactType ? ` (${esc(m.contactType)})` : ""}` : ""}</div>` : ""}
      ${log ? `<div class="sh-log"><b>${esc(log.status)}</b> by ${esc(log.by || "someone")} · ${esc(new Date(log.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</div>` : ""}
      <textarea class="sh-msg" rows="3" aria-label="Text message to ${esc(m.name)}">${esc(msg)}</textarea>
      <div class="sh-actions">
        ${m.phone ? `<a class="sh-text" href="sms:+1${esc(m.phone)}" data-act="text">Text</a>` : `<span class="cell-sub">No cell number on file</span>`}
        <button type="button" class="btn-secondary" data-act="copy">Copy message</button>
        <button type="button" class="btn-secondary" data-act="shuffle" title="Try another version">Shuffle</button>
        <select data-act="status" aria-label="Outreach status"><option value="">Mark as…</option>${SH_STATUSES.map((x) => `<option${log && log.status === x ? " selected" : ""}>${x}</option>`).join("")}${log ? "<option value=\"Clear\">Clear</option>" : ""}</select>
      </div>
    </article>`;
  }).join("") + (list.length > SH.shown ? `<button type="button" class="btn-secondary sh-more" data-act="more">Show ${fmtNum(Math.min(40, list.length - SH.shown))} more of ${fmtNum(list.length - SH.shown)}</button>`
    : list.length ? "" : `<p class="chart-empty">No one here.</p>`);
}

// sms: links: iOS reads "&body=", Android "?body=", so "?&body=" works on both.
const smsHref = (phone, msg) => `sms:+1${phone}?&body=${encodeURIComponent(msg)}`;
$("shList").addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  if (el.dataset.act === "more") { SH.shown += 40; return shRender(); }
  const card = el.closest(".sh-card"), m = SH.members.find((x) => x.id === card.dataset.id), msg = card.querySelector(".sh-msg").value;
  if (el.dataset.act === "text") {
    el.href = smsHref(m.phone, msg); // the link opens the phone's Messages app with this text
    shLogStatus(m, "Texted", "phone");
  } else if (el.dataset.act === "copy") {
    try { await navigator.clipboard.writeText(msg); shStatus(`Copied the message for ${m.name}.`); } catch { shStatus("Couldn't copy: select the message and copy it.", true); }
  } else if (el.dataset.act === "shuffle") {
    SH.variant[m.id] = (SH.variant[m.id] || 0) + 1;
    card.querySelector(".sh-msg").value = messageFor(m, SH.variant[m.id]);
  }
});
$("shList").addEventListener("change", (e) => {
  const el = e.target.closest("[data-act=status]");
  if (!el || !el.value) return;
  const m = SH.members.find((x) => x.id === el.closest(".sh-card").dataset.id);
  shLogStatus(m, el.value, "manual");
});
$("shFilters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-shf]");
  if (!b) return;
  SH.filter = b.dataset.shf;
  SH.shown = 40;
  shRender();
});
$("shSearch").oninput = () => { SH.search = $("shSearch").value; SH.shown = 40; shRender(); };
$("shOptOut").onchange = () => { pref("shepherdOptOut", $("shOptOut").checked ? "1" : "0"); if (SH.club) shRender(); };
$("shSignInForm").onsubmit = (e) => { e.preventDefault(); shOpen(); };
$("shSwitch").onclick = () => {
  try { sessionStorage.removeItem("shepherdCode"); } catch {}
  SH.club = null; SH.members = []; SH.log = {};
  $("shCode").value = "";
  $("shApp").hidden = true;
  $("shSignIn").hidden = false;
};
document.addEventListener("viewchange", (e) => { if (e.detail === "shepherd" && !SH.data) shInit(); });
if (!$("view-shepherd").hidden) shInit();
