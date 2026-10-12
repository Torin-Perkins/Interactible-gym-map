const ATL = [33.85, -84.35];
const GRADE_COLORS = { A: "#2a9d4b", B: "#2b6cb0", C: "#e07a1f", N: "#8a8f98" };
const NEARBY_MILES = 12;

const map = L.map("map", { zoomControl: true }).setView(ATL, 10);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const gymLayer = L.layerGroup().addTo(map);
const areaLayer = L.layerGroup().addTo(map);
const searchLayer = L.layerGroup().addTo(map);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Great-circle distance in miles.
function miles(a, b) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Best grade letter among an area's candidates (A beats B beats C).
function bestGrade(area) {
  const letters = area.candidates.map((c) => (c.grade || "").trim().charAt(0).toUpperCase()).filter((g) => "ABC".includes(g) && g);
  return letters.sort()[0] || "N";
}
const hasInterview = (area) => area.candidates.some((c) => /interview/i.test(c.status));

// ---------- Live candidate data from Google Sheets ----------
let AREAS = [];

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

// Read-only: downloads the tab as CSV through Google's public export URL.
// No sign-in or credentials are sent, so this cannot change the sheet.
async function fetchSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET.tab)}&_=${Date.now()}`;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error("Sheet is not shared with \"Anyone with the link\"");
  return parseCSV(text);
}

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
// "Roxanne  McDonald" -> "Roxanne M."
function shortName(full) {
  const parts = full.trim().split(/\s+/).filter((p, i) => p && !(i > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(p)));
  if (!parts.length) return "";
  const first = parts[0] === parts[0].toLowerCase() || parts[0] === parts[0].toUpperCase() ? titleCase(parts[0]) : parts[0];
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

// Pick the known area whose keyword appears earliest in the answer
// ("Loganville (close to Lawrenceville)" -> Loganville).
function matchKnownArea(text) {
  const t = text.toLowerCase();
  let best = null;
  KNOWN_AREAS.forEach((a) => a.keys.forEach((k) => {
    const i = t.indexOf(k);
    if (i >= 0 && (!best || i < best.i || (i === best.i && k.length > best.k.length))) best = { a, i, k };
  }));
  return best && best.a;
}

const GEO_CACHE_KEY = "areaGeocodeCache.v1";
function loadGeoCache() { try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY)) || {}; } catch { return {}; } }
function saveGeoCache(c) { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch {} }

async function resolveArea(text, cache) {
  const known = matchKnownArea(text);
  if (known) return known;
  const key = text.toLowerCase().trim();
  if (!(key in cache)) {
    try {
      const hit = await geocode(text);
      cache[key] = hit ? { area: titleCase(text.replace(/,?\s*(ga|georgia)\b.*$/i, "").trim()) || text, lat: hit.lat, lng: hit.lng, radiusKm: 4 } : null;
      saveGeoCache(cache);
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim: max 1 request/sec
    } catch { return null; }
  }
  return cache[key];
}

// Builds AREAS from spreadsheet rows (first row = headers).
async function loadCandidates(table) {
  const [header, ...rows] = table.map((r) => r.map((v) => String(v ?? "")));
  const col = (re) => header.findIndex((h) => re.test(h));
  const C = {
    name: col(/full name/i), grade: col(/^grade/i), status: col(/^status/i),
    metro: col(/metro area would you prefer/i), area: col(/what part of your/i),
    spanish: col(/speak spanish/i), sales: col(/sales manager/i), transport: col(/transportation/i),
  };
  if (C.name < 0 || C.area < 0) throw new Error("Couldn't find the name / area columns in the sheet");
  const get = (r, i) => (i >= 0 && r[i] ? r[i].trim() : "");

  const cache = loadGeoCache();
  const byArea = new Map();
  const unplaced = [];
  for (const r of rows) {
    const full = get(r, C.name), where = get(r, C.area);
    if (!full) continue;
    if (C.metro >= 0 && !new RegExp(SHEET.metro, "i").test(get(r, C.metro))) continue;
    const notes = [];
    if (/^yes/i.test(get(r, C.spanish))) notes.push("Spanish speaker");
    if (/^yes/i.test(get(r, C.sales))) notes.push("Interested in PT sales");
    if (/transit/i.test(get(r, C.transport))) notes.push("Public transit");
    const cand = {
      name: shortName(full),
      grade: get(r, C.grade).split(/\s+/)[0].toUpperCase().replace(/[^ABC+\-]/g, ""),
      status: get(r, C.status),
      note: [where && `Lives: ${where}`, ...notes].filter(Boolean).join(" · "),
    };
    const a = where && (await resolveArea(where, cache));
    if (!a) { unplaced.push(cand.name); continue; }
    if (!byArea.has(a.area)) byArea.set(a.area, { area: a.area, lat: a.lat, lng: a.lng, radiusKm: a.radiusKm, candidates: [] });
    byArea.get(a.area).candidates.push(cand);
  }
  AREAS = [...byArea.values()];
  return unplaced;
}

// ---------- Gyms ----------
const staffOf = (g) => STAFF[g.name] || {};
function staffLine(g) {
  const st = staffOf(g), fm = st.fm || 0, afm = st.afm || 0, pt = st.pt || 0;
  return `${pt} PT${pt === 1 ? "" : "s"} · ${fm} FM${fm === 1 ? "" : "s"} · ${afm} AFM${afm === 1 ? "" : "s"}`;
}

function gymPopup(g) {
  const nearbyAreas = AREAS
    .map((a) => ({ a, d: miles(g, a) }))
    .filter((x) => x.d <= NEARBY_MILES)
    .sort((x, y) => x.d - y.d);
  const nearbyHtml = nearbyAreas.length
    ? `<div style="margin-top:6px">Candidates within ${NEARBY_MILES} mi:<ul>${nearbyAreas
        .map((x) => `<li>${esc(x.a.area)} (${x.d.toFixed(1)} mi): ${x.a.candidates.map((c) => esc(c.name)).join(", ")}</li>`)
        .join("")}</ul></div>`
    : `<div style="margin-top:6px;color:#888">No candidates within ${NEARBY_MILES} mi</div>`;
  return `<b>${esc(g.name)}</b><br>${esc(g.address)}<br>
    <div class="staff">${staffLine(g)}</div>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.address)}" target="_blank" rel="noopener">Directions</a>
    ${nearbyHtml}`;
}
GYMS.forEach((g) => {
  g.marker = L.circleMarker([g.lat, g.lng], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#d62828", fillOpacity: 1,
  }).bindPopup(() => gymPopup(g)).bindTooltip(`${esc(g.name)}<br><small>${staffLine(g)}</small>`, { direction: "top", offset: [0, -6] });
  g.marker.addTo(gymLayer);
});

// ---------- Candidate regions ----------
function renderAreas() {
  areaLayer.clearLayers();
  const onlyIv = $("onlyInterview").checked;
  const list = $("areaList");
  list.innerHTML = "";
  AREAS.slice().sort((a, b) => a.area.localeCompare(b.area)).forEach((a) => {
    if (onlyIv && !hasInterview(a)) return;
    const color = GRADE_COLORS[bestGrade(a)];
    const people = a.candidates
      .filter((c) => !onlyIv || /interview/i.test(c.status))
      .map((c) => `${esc(c.name)}${c.grade ? ` (${esc(c.grade)})` : ""}${/interview/i.test(c.status) ? '<span class="badge iv">Interview</span>' : ""}`);
    const detail = a.candidates.map((c) =>
      `<li><b style="font-size:13px">${esc(c.name)}</b>${c.grade ? ` · Grade ${esc(c.grade)}` : ""}${c.status ? ` · ${esc(c.status)}` : ""}${c.note ? `<br><i>${esc(c.note)}</i>` : ""}</li>`
    ).join("");

    a.circle = L.circle([a.lat, a.lng], {
      radius: a.radiusKm * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.22,
      dashArray: hasInterview(a) ? null : "5 4",
    })
      .bindTooltip(`${a.area} · ${a.candidates.length}`, { permanent: true, direction: "center", className: "area-label" })
      .bindPopup(`<b>${esc(a.area)}</b><ul>${detail}</ul><a href="#" class="nearest-link">Show nearest gyms</a>`)
      .on("popupopen", (e) => {
        e.popup.getElement().querySelector(".nearest-link").onclick = (ev) => {
          ev.preventDefault();
          map.closePopup();
          findNearest({ lat: a.lat, lng: a.lng }, a.area);
        };
      })
      .addTo(areaLayer);

    const li = document.createElement("li");
    li.innerHTML = `<span class="sw" style="background:${color}"></span> <span class="aname">${esc(a.area)}</span><div class="people">${people.join(", ")}</div>`;
    li.onclick = () => {
      document.querySelectorAll("#areaList li.active").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
      findNearest({ lat: a.lat, lng: a.lng }, a.area);
    };
    list.appendChild(li);
  });
  if (!$("showAreas").checked) map.removeLayer(areaLayer);
}

// ---------- Nearest-gym search ----------
function resetGymStyles() {
  GYMS.forEach((g) => g.marker.setStyle({ radius: 7, fillOpacity: 1, opacity: 1 }));
}

function findNearest(point, label) {
  const n = parseInt($("nearestN").value, 10);
  const ranked = GYMS.map((g) => ({ g, d: miles(point, g) })).sort((a, b) => a.d - b.d).slice(0, n);

  searchLayer.clearLayers();
  resetGymStyles();
  GYMS.forEach((g) => g.marker.setStyle({ fillOpacity: 0.35, opacity: 0.35 }));

  L.marker([point.lat, point.lng]).bindPopup(`<b>${esc(label)}</b>`).addTo(searchLayer);
  ranked.forEach(({ g }, i) => {
    L.polyline([[point.lat, point.lng], [g.lat, g.lng]], { color: "#d62828", weight: 2, dashArray: "4 6", opacity: 0.8 }).addTo(searchLayer);
    L.marker([g.lat, g.lng], {
      icon: L.divIcon({ className: "", html: `<div class="rank-icon">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      zIndexOffset: 1000 - i,
    }).bindPopup(() => gymPopup(g)).addTo(searchLayer);
  });

  $("searchStatus").textContent = `Closest to ${label}`;
  $("results").innerHTML = ranked
    .map(({ g, d }, i) => `<li data-i="${i}"><span class="gname">${esc(g.name)}</span><span class="dist">${d.toFixed(1)} mi</span><span class="addr">${esc(g.address)}</span><span class="addr staff">${staffLine(g)}</span></li>`)
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
  resetGymStyles();
  $("results").innerHTML = "";
  $("searchStatus").textContent = "";
  $("searchInput").value = "";
  document.querySelectorAll("#areaList li.active").forEach((x) => x.classList.remove("active"));
}

// Geocode with OpenStreetMap Nominatim, biased to metro Atlanta.
async function geocode(q) {
  const params = new URLSearchParams({
    q: /\b(ga|georgia)\b/i.test(q) ? q : `${q}, Georgia`,
    format: "json", limit: "1", countrycodes: "us",
    viewbox: "-85.4,34.6,-83.3,33.2", bounded: "0",
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

map.on("click", (e) => findNearest({ lat: e.latlng.lat, lng: e.latlng.lng }, "selected point"));
$("clearBtn").onclick = clearSearch;
$("nearestN").onchange = () => {
  const m = searchLayer.getLayers().find((l) => l instanceof L.Marker && !l.options.icon?.options?.html);
  if (m) findNearest(m.getLatLng(), $("searchStatus").textContent.replace(/^Closest to /, ""));
};
$("showGyms").onchange = (e) => (e.target.checked ? gymLayer.addTo(map) : map.removeLayer(gymLayer));
$("showAreas").onchange = (e) => (e.target.checked ? areaLayer.addTo(map) : map.removeLayer(areaLayer));
$("onlyInterview").onchange = renderAreas;

// ---------- Load candidates ----------
async function refresh() {
  $("candCount").textContent = "…";
  $("dataStatus").textContent = "Loading candidates from Google Sheet…";
  $("refreshBtn").disabled = true;
  try {
    const unplaced = await loadCandidates(await fetchSheet());
    $("candCount").textContent = AREAS.reduce((n, a) => n + a.candidates.length, 0);
    $("dataStatus").textContent = `Live from Google Sheet · updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` +
      (unplaced.length ? ` · couldn't place: ${unplaced.join(", ")}` : "");
  } catch (err) {
    console.error(err);
    $("candCount").textContent = "0";
    $("dataStatus").textContent = `Couldn't load candidates: ${err.message}`;
  }
  $("refreshBtn").disabled = false;
  renderAreas();
}

$("refreshBtn").onclick = refresh;
$("gymCount").textContent = GYMS.length;
$("staffDate").textContent = STAFF_AS_OF;
refresh();
