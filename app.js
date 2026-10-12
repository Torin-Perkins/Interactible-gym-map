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
    if (C.metro >= 0 && !new RegExp(METRO, "i").test(get(r, C.metro))) continue;
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
    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.address)}" target="_blank" rel="noopener">Directions</a>
    ${nearbyHtml}`;
}
GYMS.forEach((g) => {
  g.marker = L.circleMarker([g.lat, g.lng], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#d62828", fillOpacity: 1,
  }).bindPopup(() => gymPopup(g)).bindTooltip(g.name, { direction: "top", offset: [0, -6] });
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
    .map(({ g, d }, i) => `<li data-i="${i}"><span class="gname">${esc(g.name)}</span><span class="dist">${d.toFixed(1)} mi</span><span class="addr">${esc(g.address)}</span></li>`)
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

// ---------- Local spreadsheet loading (file never leaves the browser) ----------
const SAVED_KEY = "candidateAreas.v1";

function showLoaded(label, unplaced = []) {
  $("candCount").textContent = AREAS.reduce((n, a) => n + a.candidates.length, 0);
  $("dataStatus").textContent = label + (unplaced.length ? ` · couldn't place: ${unplaced.join(", ")}` : "");
  $("forgetBtn").hidden = !AREAS.length;
  renderAreas();
}

async function loadFile(file) {
  $("dataStatus").textContent = `Reading ${file.name}…`;
  try {
    const wb = XLSX.read(await file.arrayBuffer());
    const name = wb.SheetNames.find((n) => n.trim().toUpperCase() === SHEET_TAB.toUpperCase()) || wb.SheetNames[0];
    const table = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    const unplaced = await loadCandidates(table);
    const label = `${file.name} › ${name} · loaded ${new Date().toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`;
    try { localStorage.setItem(SAVED_KEY, JSON.stringify({ label, unplaced, areas: AREAS })); } catch {}
    showLoaded(label, unplaced);
  } catch (err) {
    console.error(err);
    $("dataStatus").textContent = `Couldn't read ${file.name}: ${err.message}`;
  }
}

$("fileInput").onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ""; };
document.addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("dragging"); });
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});
$("forgetBtn").onclick = () => {
  try { localStorage.removeItem(SAVED_KEY); } catch {}
  AREAS = [];
  showLoaded("No spreadsheet loaded — choose one above or drop it on the page.");
};

$("gymCount").textContent = GYMS.length;
let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVED_KEY)); } catch {}
if (saved && saved.areas) { AREAS = saved.areas; showLoaded(saved.label, saved.unplaced); }
else showLoaded("No spreadsheet loaded — choose one above or drop it on the page.");
