const GRADE_COLORS = { A: "#2a9d4b", B: "#2b6cb0", C: "#e07a1f", N: "#8a8f98" };
const NEARBY_MILES = 12;
const REGION_REACH_MILES = 60; // candidate areas this close to a region's gyms belong to it
const MIN_LABEL_ZOOM = 10;

const map = L.map("map", { zoomControl: true }).setView([36.5, -92], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const gymLayer = L.layerGroup().addTo(map);
const areaLayer = L.layerGroup().addTo(map);
const searchLayer = L.layerGroup().addTo(map);

const state = { brand: "all", region: "", colorBy: "brand", sort: { key: "clients", dir: -1 } };
let AREAS = [];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gymLabel = (g) => g.label || g.name;
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.,]+$/, "");

// Great-circle distance in miles.
function miles(a, b) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

// Read-only: downloads one tab as CSV through Google's public export URL.
// No sign-in or credentials are sent, so this cannot change the sheet.
async function fetchTab(sheetId, tab, headerRows) {
  const params = new URLSearchParams({ tqx: "out:csv", sheet: tab, _: Date.now() });
  if (headerRows != null) params.set("headers", headerRows);
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`"${tab.trim()}" request failed (${res.status})`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error(`Sheet with "${tab.trim()}" is not shared with "Anyone with the link"`);
  return parseCSV(text);
}

// ---------- Formatting ----------
const fmtVal = (m, v) => (v == null ? "—" : m.pct ? `${(v * 100).toFixed(1)}%` : Math.round(v).toLocaleString());
function fmtDelta(m, cur, prev) {
  if (cur == null || prev == null) return "";
  const d = cur - prev;
  if (Math.abs(d) < (m.pct ? 0.0005 : 0.5)) return `<span class="delta flat">±0</span>`;
  const good = (d > 0) === (m.better === "up");
  const txt = m.pct ? `${(Math.abs(d) * 100).toFixed(1)} pts` : Math.round(Math.abs(d)).toLocaleString();
  return `<span class="delta ${good ? "good" : "bad"}">${d > 0 ? "▲" : "▼"} ${txt}</span>`;
}
const fmtDate = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });

function sparkline(series, color) {
  const pts = series.filter((p) => p.value != null);
  if (pts.length < 2) return "";
  const W = 90, H = 22, vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const xy = pts.map((p, i) => `${((i / (pts.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 2 - ((p.value - min) / span) * (H - 4)).toFixed(1)}`);
  const last = xy[xy.length - 1].split(",");
  return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${xy.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="${color}"/></svg>`;
}

// ---------- Stats ----------
function parseNum(s) {
  s = (s || "").trim();
  if (!s) return null;
  const pct = s.endsWith("%");
  const n = parseFloat(s.replace(/[,%$]/g, ""));
  return isNaN(n) ? null : pct ? n / 100 : n;
}

async function loadStats() {
  GYMS.forEach((g) => (g.stats = {}));
  const jobs = [];
  for (const [brand, sheetId] of Object.entries(STATS_SHEETS)) {
    const gyms = GYMS.filter((g) => g.brand === brand);
    for (const m of METRICS) {
      jobs.push(fetchTab(sheetId, m.tab, 2).then((rows) => {
        const [header, ...data] = rows;
        header.forEach((h, col) => {
          if (col === 0) return;
          h = h.trim();
          const g = gyms.find((x) => x.name === h) || gyms.find((x) => h.endsWith(" " + x.name));
          if (!g) return;
          const byDate = new Map();
          data.forEach((r) => {
            const d = new Date(r[0]);
            const v = parseNum(r[col]);
            if (!isNaN(d) && v != null) byDate.set(d.getTime(), v);
          });
          g.stats[m.key] = [...byDate].sort((a, b) => a[0] - b[0]).map(([t, value]) => ({ date: new Date(t), value }));
        });
      }));
    }
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error(r.reason));
  return failed.length ? failed[0].reason.message : "";
}

function latest(g, key) {
  const s = g.stats?.[key];
  if (!s || !s.length) return { value: null, prev: null, date: null };
  return { value: s[s.length - 1].value, prev: s.length > 1 ? s[s.length - 2].value : null, date: s[s.length - 1].date };
}

const staffOf = (g) => STAFF[g.brand]?.[g.name] || {};
function staffLine(g) {
  const st = staffOf(g), pt = st.pt || 0, fm = st.fm || 0, afm = st.afm || 0;
  return `${pt} PT${pt === 1 ? "" : "s"} · ${fm} FM${fm === 1 ? "" : "s"} · ${afm} AFM${afm === 1 ? "" : "s"}`;
}
const staffTotal = (g) => { const st = staffOf(g); return (st.pt || 0) + (st.fm || 0) + (st.afm || 0); };

// ---------- Gym markers ----------
const visibleGym = (g) =>
  (state.brand === "all" || g.brand === state.brand) &&
  (!state.region || `${g.brand}|${g.region}` === state.region);
const brandGym = (g) => state.brand === "all" || g.brand === state.brand;

function gymPopup(g) {
  const b = BRANDS[g.brand];
  const statRows = METRICS.map((m) => {
    const l = latest(g, m.key);
    if (l.value == null) return "";
    return `<tr><td>${esc(m.label)}</td><td class="num">${fmtVal(m, l.value)}</td><td>${fmtDelta(m, l.value, l.prev)}</td><td>${sparkline(g.stats[m.key], b.color)}</td></tr>`;
  }).join("");
  const asOf = latest(g, "clients").date;
  const statsHtml = statRows
    ? `<table class="stats">${statRows}</table><div class="muted">Latest: ${asOf ? fmtDate(asOf) : "—"} · change vs previous report</div>`
    : `<div class="muted">No stats in the ${esc(g.brand)} sheet for this gym.</div>`;

  const near = AREAS.map((a) => ({ a, d: miles(g, a) })).filter((x) => x.d <= NEARBY_MILES).sort((x, y) => x.d - y.d);
  const n = near.reduce((s, x) => s + x.a.candidates.length, 0);
  const nearHtml = near.length
    ? `<details><summary>${n} candidate${n === 1 ? "" : "s"} within ${NEARBY_MILES} mi</summary><ul>${near
        .map((x) => `<li>${esc(x.a.area)} (${x.d.toFixed(1)} mi): ${x.a.candidates.map((c) => esc(c.name)).join(", ")}</li>`)
        .join("")}</ul></details>`
    : `<div class="muted">No candidates within ${NEARBY_MILES} mi</div>`;

  return `<div class="popup">
    <div class="chip" style="background:${b.color}">${esc(g.brand)} · ${esc(g.region)}</div>
    <b>${esc(gymLabel(g))}</b><br>${esc(g.address)}${g.approx ? " <i>(approx. location)</i>" : ""}<br>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.address)}" target="_blank" rel="noopener">Directions</a>
    <div class="staff">${staffLine(g)}</div>
    ${statsHtml}
    ${nearHtml}
  </div>`;
}

GYMS.forEach((g) => {
  g.marker = L.circleMarker([g.lat, g.lng], { color: "#fff", weight: 2, fillOpacity: 1, bubblingMouseEvents: false })
    .bindPopup(() => gymPopup(g), { maxWidth: 380, minWidth: 300 })
    .bindTooltip(() => `<b>${esc(gymLabel(g))}</b> <small>(${esc(g.brand)})</small><br><small>${staffLine(g)}</small>`, { direction: "top", offset: [0, -6] });
});

// Red (bad) -> amber -> green (good)
function scaleColor(t) {
  const stops = [[214, 40, 40], [240, 170, 30], [42, 157, 75]];
  const x = Math.max(0, Math.min(1, t)) * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c.join(",")})`;
}

const COLOR_MODES = {
  brand: { label: "Brand" },
  clients: { label: "Total clients (size)", metric: "clients", size: true },
  lostPct: { label: "Lost sheep %", metric: "lostPct" },
  billing: { label: "Billing health", metric: "billing" },
  late: { label: "Members with late amounts", metric: "late" },
  staff: { label: "Staff on roster (size)", size: true },
};

function styleGyms() {
  const mode = COLOR_MODES[state.colorBy];
  const metric = METRICS.find((m) => m.key === mode.metric);
  // Scales are per brand: the brands report on different bases.
  const range = {};
  GYMS.forEach((g) => {
    const v = mode.metric ? latest(g, mode.metric).value : state.colorBy === "staff" ? staffTotal(g) : null;
    if (v == null) return;
    const r = (range[g.brand] ||= { min: Infinity, max: -Infinity });
    r.min = Math.min(r.min, v); r.max = Math.max(r.max, v);
  });
  GYMS.forEach((g) => {
    const brandColor = BRANDS[g.brand].color;
    let radius = 7, fill = brandColor;
    if (state.colorBy !== "brand") {
      const v = mode.metric ? latest(g, mode.metric).value : staffTotal(g);
      const r = range[g.brand];
      if (v == null || !r) { radius = 4; fill = "#9aa0a6"; }
      else if (mode.size) radius = 4 + Math.sqrt(r.max ? v / r.max : 0) * 12;
      else {
        let t = r.max > r.min ? (v - r.min) / (r.max - r.min) : 0.5;
        if (metric.better === "down") t = 1 - t;
        fill = scaleColor(t); radius = 8;
      }
    }
    g.marker.setStyle({ radius, fillColor: fill, color: state.colorBy === "brand" || !mode.size ? "#fff" : brandColor });
  });
  const legend = $("colorLegend");
  if (state.colorBy === "brand" || mode.size) {
    legend.innerHTML = Object.entries(BRANDS).map(([k, b]) => `<span><i class="dot" style="background:${b.color}"></i>${esc(k)}</span>`).join("") +
      (mode.size ? `<span class="muted">bigger = more</span>` : "");
  } else {
    legend.innerHTML = `<span class="ramp"></span><span class="muted">worse → better (relative within each brand)</span>`;
  }
}

function renderGyms() {
  gymLayer.clearLayers();
  GYMS.filter(visibleGym).forEach((g) => g.marker.addTo(gymLayer));
  $("gymCount").textContent = GYMS.filter(visibleGym).length;
}

// ---------- Gym table ----------
const TABLE_COLS = [
  { key: "name", label: "Gym", get: (g) => gymLabel(g) },
  { key: "clients", label: "Clients", get: (g) => latest(g, "clients").value },
  { key: "lostPct", label: "Lost %", get: (g) => latest(g, "lostPct").value },
  { key: "billing", label: "Billing", get: (g) => latest(g, "billing").value },
  { key: "staff", label: "PT/FM/AFM", get: (g) => staffTotal(g) },
];

function renderTable() {
  const gyms = GYMS.filter(visibleGym);
  const col = TABLE_COLS.find((c) => c.key === state.sort.key);
  gyms.sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sort.dir;
  });
  const m = (k) => METRICS.find((x) => x.key === k);
  $("gymTable").innerHTML = `<thead><tr>${TABLE_COLS.map((c) =>
    `<th data-k="${c.key}" class="${c.key === state.sort.key ? "sorted" : ""}">${c.label}${c.key === state.sort.key ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
    <tbody>${gyms.map((g) => {
      const st = staffOf(g);
      return `<tr data-i="${GYMS.indexOf(g)}">
        <td><i class="dot" style="background:${BRANDS[g.brand].color}"></i>${esc(gymLabel(g))}${state.region ? "" : `<div class="muted">${esc(g.region)}</div>`}</td>
        <td class="num">${fmtVal(m("clients"), latest(g, "clients").value)}</td>
        <td class="num">${fmtVal(m("lostPct"), latest(g, "lostPct").value)}</td>
        <td class="num">${fmtVal(m("billing"), latest(g, "billing").value)}</td>
        <td class="num">${st.pt || 0}/${st.fm || 0}/${st.afm || 0}</td></tr>`;
    }).join("")}</tbody>`;
  $("gymTable").querySelectorAll("th").forEach((th) => (th.onclick = () => {
    const k = th.dataset.k;
    state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : k === "name" ? 1 : -1 };
    renderTable();
  }));
  $("gymTable").querySelectorAll("tbody tr").forEach((tr) => (tr.onclick = () => {
    const g = GYMS[+tr.dataset.i];
    map.setView([g.lat, g.lng], Math.max(map.getZoom(), 12));
    g.marker.openPopup();
  }));
  $("tableTitle").textContent = state.region ? state.region.split("|")[1] + " gyms" : (state.brand === "all" ? "All gyms" : `All ${state.brand} gyms`);
}

// ---------- Candidates ----------
function bestGrade(area) {
  const letters = area.candidates.map((c) => (c.grade || "").charAt(0)).filter((g) => "ABC".includes(g) && g);
  return letters.sort()[0] || "N";
}
const isInterview = (c) => /interview/i.test(c.status);
const hasInterview = (area) => area.candidates.some(isInterview);

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function shortName(full) {
  const parts = full.trim().split(/\s+/).filter((p, i) => p && !(i > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(p)));
  if (!parts.length) return "";
  const first = parts[0] === parts[0].toLowerCase() || parts[0] === parts[0].toUpperCase() ? titleCase(parts[0]) : parts[0];
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

const GEO_CACHE_KEY = "areaGeocodeCache.v2";
function loadGeoCache() { try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY)) || {}; } catch { return {}; } }
function saveGeoCache(c) { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch {} }

// Locates an answer not in CANDIDATE_GEO, near its metro; falls back to the metro center.
async function locateNew(answer, metro, cache) {
  const key = `${norm(answer)}|${metro}`;
  if (key in cache) return cache[key];
  const [lat, lng] = METROS[metro];
  let res = [lat, lng, 12, metro.split(",")[0]];
  try {
    const params = new URLSearchParams({
      q: `${answer}, ${metro.split(", ")[1]}`, format: "json", limit: "1", countrycodes: "us",
      viewbox: `${lng - 0.9},${lat + 0.9},${lng + 0.9},${lat - 0.9}`, bounded: "1",
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const hit = r.ok ? (await r.json())[0] : null;
    if (hit) res = [+(+hit.lat).toFixed(4), +(+hit.lon).toFixed(4), /city|town|municipality/.test(hit.addresstype) ? 6 : 3.5, hit.name || titleCase(answer)];
    await new Promise((ok) => setTimeout(ok, 1100)); // Nominatim: max 1 request/sec
  } catch {}
  cache[key] = res;
  saveGeoCache(cache);
  return res;
}

async function loadCandidates(onProgress) {
  const tabs = await Promise.all(CANDIDATE_SHEET.tabs.map((t) => fetchTab(CANDIDATE_SHEET.id, t).catch((e) => { console.error(e); return null; })));
  const seen = new Set(), rows = [];
  let failedTabs = 0;
  tabs.forEach((table) => {
    if (!table) { failedTabs++; return; }
    const [header, ...data] = table;
    const col = (re) => header.findIndex((h) => re.test(h));
    const C = {
      name: col(/full name/i), grade: col(/^grade/i), status: col(/^status/i),
      metro: col(/metro area would you prefer/i), area: col(/what part of your/i),
      spanish: col(/speak spanish/i), sales: col(/sales manager/i), transport: col(/transportation/i),
    };
    const get = (r, i) => (i >= 0 && r[i] ? r[i].trim() : "");
    data.forEach((r) => {
      const full = get(r, C.name), metro = get(r, C.metro);
      if (!full || !METROS[metro]) return;
      const id = `${norm(full)}|${metro}`;
      if (seen.has(id)) return; // same person listed on two tabs
      seen.add(id);
      const notes = [];
      if (/^yes/i.test(get(r, C.spanish))) notes.push("Spanish speaker");
      if (/^yes/i.test(get(r, C.sales))) notes.push("Interested in PT sales");
      if (/transit/i.test(get(r, C.transport))) notes.push("Public transit");
      rows.push({
        where: get(r, C.area), metro,
        cand: {
          name: shortName(full), metro,
          grade: get(r, C.grade).split(/\s+/)[0].toUpperCase().replace(/[^ABC+\-]/g, ""),
          status: get(r, C.status),
          note: [get(r, C.area) && `Lives: ${get(r, C.area)}`, ...notes].filter(Boolean).join(" · "),
        },
      });
    });
  });

  const cache = loadGeoCache();
  const unknown = rows.filter((x) => !CANDIDATE_GEO[`${norm(x.where)}|${x.metro}`]);
  let done = 0;
  const byArea = new Map();
  for (const x of rows) {
    const key = `${norm(x.where)}|${x.metro}`;
    let loc = CANDIDATE_GEO[key];
    if (!loc) { onProgress?.(`Locating new areas… ${++done}/${unknown.length}`); loc = await locateNew(x.where || x.metro, x.metro, cache); }
    const [lat, lng, radiusKm, label] = loc;
    const areaKey = `${label}|${x.metro}`;
    if (!byArea.has(areaKey)) byArea.set(areaKey, { area: label, metro: x.metro, lat, lng, radiusKm, candidates: [] });
    byArea.get(areaKey).candidates.push(x.cand);
  }
  AREAS = [...byArea.values()];
  return failedTabs ? `${failedTabs} candidate tab(s) failed to load` : "";
}

// Candidate areas near the gyms currently shown.
function areaInScope(a) {
  if (!state.region && state.brand === "all") return true;
  return GYMS.some((g) => visibleGym(g) && miles(g, a) <= REGION_REACH_MILES);
}

function renderAreas() {
  areaLayer.clearLayers();
  const onlyIv = $("onlyInterview").checked;
  const shown = AREAS.filter((a) => areaInScope(a) && (!onlyIv || hasInterview(a)));
  shown.forEach((a) => {
    const color = GRADE_COLORS[bestGrade(a)];
    const detail = a.candidates.map((c) =>
      `<li><b>${esc(c.name)}</b>${c.grade ? ` · Grade ${esc(c.grade)}` : ""}${c.status ? ` · ${esc(c.status)}` : ""}${c.note ? `<br><i>${esc(c.note)}</i>` : ""}</li>`).join("");
    a.circle = L.circle([a.lat, a.lng], {
      radius: a.radiusKm * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.2, bubblingMouseEvents: false,
      dashArray: hasInterview(a) ? null : "5 4",
    })
      .bindTooltip(`${esc(a.area)} · ${a.candidates.length}`, { permanent: true, direction: "center", className: "area-label" })
      .bindPopup(`<b>${esc(a.area)}</b> <span class="muted">${esc(a.metro)}</span><ul>${detail}</ul><a href="#" class="nearest-link">Show nearest gyms</a>`, { maxWidth: 320 })
      .on("popupopen", (e) => {
        e.popup.getElement().querySelector(".nearest-link").onclick = (ev) => {
          ev.preventDefault();
          map.closePopup();
          findNearest({ lat: a.lat, lng: a.lng }, a.area);
        };
      })
      .addTo(areaLayer);
  });

  const list = $("areaList");
  $("candCount").textContent = shown.reduce((n, a) => n + a.candidates.length, 0);
  if (!state.region) {
    list.innerHTML = `<li class="muted">Pick a region above to list its candidates.</li>`;
    return;
  }
  list.innerHTML = "";
  shown.sort((a, b) => b.candidates.length - a.candidates.length || a.area.localeCompare(b.area)).forEach((a) => {
    const people = a.candidates
      .filter((c) => !onlyIv || isInterview(c))
      .map((c) => `${esc(c.name)}${c.grade ? ` (${esc(c.grade)})` : ""}${isInterview(c) ? '<span class="badge iv">Interview</span>' : ""}`);
    const li = document.createElement("li");
    li.innerHTML = `<span class="sw" style="background:${GRADE_COLORS[bestGrade(a)]}"></span> <span class="aname">${esc(a.area)}</span> <span class="muted">${esc(a.metro.split(",")[0])}</span><div class="people">${people.join(", ")}</div>`;
    li.onclick = () => {
      document.querySelectorAll("#areaList li.active").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
      findNearest({ lat: a.lat, lng: a.lng }, a.area);
    };
    list.appendChild(li);
  });
}

// Area labels only once zoomed in, so the national view stays readable.
const syncLabels = () => map.getContainer().classList.toggle("hide-labels", map.getZoom() < MIN_LABEL_ZOOM);
map.on("zoomend", syncLabels);
syncLabels();

// ---------- Nearest-gym search ----------
function resetGymStyles() {
  GYMS.forEach((g) => g.marker.setStyle({ fillOpacity: 1, opacity: 1 }));
}

function findNearest(point, label) {
  const n = parseInt($("nearestN").value, 10);
  const ranked = GYMS.filter(brandGym).map((g) => ({ g, d: miles(point, g) })).sort((a, b) => a.d - b.d).slice(0, n);

  searchLayer.clearLayers();
  GYMS.forEach((g) => g.marker.setStyle({ fillOpacity: 0.35, opacity: 0.35 }));
  searchLayer.point = point;

  L.marker([point.lat, point.lng]).bindPopup(`<b>${esc(label)}</b>`).addTo(searchLayer);
  ranked.forEach(({ g }, i) => {
    L.polyline([[point.lat, point.lng], [g.lat, g.lng]], { color: BRANDS[g.brand].color, weight: 2, dashArray: "4 6", opacity: 0.8 }).addTo(searchLayer);
    L.marker([g.lat, g.lng], {
      icon: L.divIcon({ className: "", html: `<div class="rank-icon" style="background:${BRANDS[g.brand].color}">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      zIndexOffset: 1000 - i,
    }).bindPopup(() => gymPopup(g), { maxWidth: 380, minWidth: 300 }).addTo(searchLayer);
  });

  $("searchStatus").textContent = `Closest to ${label}`;
  $("results").innerHTML = ranked
    .map(({ g, d }, i) => `<li data-i="${i}"><span class="gname">${esc(gymLabel(g))}</span> <span class="muted">${esc(g.brand)}</span><span class="dist">${d.toFixed(1)} mi</span><span class="addr">${esc(g.address)}</span><span class="addr staff">${staffLine(g)}</span></li>`)
    .join("");
  $("results").querySelectorAll("li").forEach((li) => {
    const { g } = ranked[+li.dataset.i];
    li.onclick = () => { map.setView([g.lat, g.lng], 14); g.marker.openPopup(); };
  });

  const bounds = L.latLngBounds([[point.lat, point.lng], ...ranked.map(({ g }) => [g.lat, g.lng])]);
  map.fitBounds(bounds.pad(0.25), { maxZoom: 13 });
}

function clearSearch() {
  searchLayer.clearLayers();
  searchLayer.point = null;
  resetGymStyles();
  $("results").innerHTML = "";
  $("searchStatus").textContent = "";
  $("searchInput").value = "";
  document.querySelectorAll("#areaList li.active").forEach((x) => x.classList.remove("active"));
}

// Geocode with OpenStreetMap Nominatim, biased to the current view.
async function geocode(q) {
  const b = map.getBounds();
  const params = new URLSearchParams({
    q, format: "json", limit: "1", countrycodes: "us",
    viewbox: `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`, bounded: "0",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`);
  const data = await res.json();
  return data[0] ? { lat: +data[0].lat, lng: +data[0].lon, label: data[0].display_name.split(",").slice(0, 2).join(",") } : null;
}

$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("searchInput").value.trim();
  if (!q) return;
  $("searchStatus").textContent = "Searching…";
  $("results").innerHTML = "";
  try {
    const hit = await geocode(q);
    if (!hit) { $("searchStatus").textContent = `No match for "${q}"`; return; }
    findNearest(hit, hit.label);
  } catch (err) {
    $("searchStatus").textContent = "Search failed — try again in a moment.";
    console.error(err);
  }
});

// ---------- Filters ----------
function fitVisible() {
  const pts = GYMS.filter(visibleGym).map((g) => [g.lat, g.lng]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 12 });
}

function buildRegionSelect() {
  const sel = $("regionSelect");
  const groups = Object.keys(BRANDS).filter((b) => state.brand === "all" || b === state.brand);
  sel.innerHTML = `<option value="">All regions</option>` + groups.map((b) =>
    `<optgroup label="${esc(BRANDS[b].label)}">${[...new Set(GYMS.filter((g) => g.brand === b).map((g) => g.region))]
      .map((r) => `<option value="${esc(`${b}|${r}`)}">${esc(r)} (${GYMS.filter((g) => g.brand === b && g.region === r).length})</option>`).join("")}</optgroup>`).join("");
  sel.value = state.region;
}

function renderAll() {
  renderGyms();
  styleGyms();
  renderTable();
  renderAreas();
}

document.querySelectorAll("#brandButtons button").forEach((btn) => (btn.onclick = () => {
  state.brand = btn.dataset.brand;
  if (state.brand !== "all" && state.region && !state.region.startsWith(state.brand + "|")) state.region = "";
  document.querySelectorAll("#brandButtons button").forEach((b) => b.classList.toggle("on", b === btn));
  buildRegionSelect();
  clearSearch();
  renderAll();
  fitVisible();
}));
$("regionSelect").onchange = (e) => { state.region = e.target.value; clearSearch(); renderAll(); fitVisible(); };
$("colorBy").innerHTML = Object.entries(COLOR_MODES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
$("colorBy").onchange = (e) => { state.colorBy = e.target.value; styleGyms(); };

map.on("click", (e) => findNearest({ lat: e.latlng.lat, lng: e.latlng.lng }, "selected point"));
$("clearBtn").onclick = clearSearch;
$("nearestN").onchange = () => { if (searchLayer.point) findNearest(searchLayer.point, $("searchStatus").textContent.replace(/^Closest to /, "")); };
$("showGyms").onchange = (e) => (e.target.checked ? gymLayer.addTo(map) : map.removeLayer(gymLayer));
$("showAreas").onchange = (e) => (e.target.checked ? areaLayer.addTo(map) : map.removeLayer(areaLayer));
$("onlyInterview").onchange = renderAreas;

// ---------- Load ----------
async function refresh() {
  $("refreshBtn").disabled = true;
  $("dataStatus").textContent = "Loading stats and candidates from Google Sheets…";
  const [statsErr, candErr] = await Promise.all([
    loadStats().catch((e) => e.message),
    loadCandidates((msg) => ($("dataStatus").textContent = msg)).catch((e) => e.message),
  ]);
  const errs = [statsErr && `Stats: ${statsErr}`, candErr && `Candidates: ${candErr}`].filter(Boolean);
  $("dataStatus").textContent = errs.length
    ? `⚠ ${errs.join(" · ")}`
    : `Live from Google Sheets · updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  $("refreshBtn").disabled = false;
  renderAll();
}

$("refreshBtn").onclick = refresh;
$("staffDate").textContent = STAFF_AS_OF;
buildRegionSelect();
renderAll();
fitVisible();
refresh();
