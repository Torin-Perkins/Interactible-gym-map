// ---------- Charts ----------
// Small SVG charts for the stats tabs: KPI trend lines (Gym stats) and a trainer-vs-averages
// bar chart (Trainer stats). Plain SVG, no library. Colors come from CSS tokens (style.css,
// "Charts") so light and dark mode each get their own validated steps. Brands are told apart by
// dash pattern, marker shape and a direct label as well as color (red/green alone isn't
// colorblind-safe).

const SVGNS = "http://www.w3.org/2000/svg";
const BRAND_STYLE = {
  GRIP: { color: "var(--series-grip)", dash: "", marker: "circle" },
  Elevate: { color: "var(--series-elevate)", dash: "6 4", marker: "square" },
  Lighthouse: { color: "var(--series-lighthouse)", dash: "2 3", marker: "triangle" },
};
const styleFor = (company) => BRAND_STYLE[company] || { color: "var(--muted)", dash: "", marker: "circle" };

function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => v != null && el.setAttribute(k, v));
  if (parent) parent.appendChild(el);
  return el;
}

// Rounded "nice" ticks covering [lo, hi].
function niceTicks(lo, hi, count = 4) {
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step, ticks = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function marker(g, shape, x, y, color) {
  const ring = { style: `fill:${color};stroke:var(--bg);stroke-width:2` };
  if (shape === "square") return svgEl("rect", { x: x - 4.5, y: y - 4.5, width: 9, height: 9, rx: 1.5, ...ring }, g);
  if (shape === "triangle") return svgEl("path", { d: `M${x},${y - 5.5}L${x + 5.5},${y + 4.5}L${x - 5.5},${y + 4.5}Z`, ...ring }, g);
  return svgEl("circle", { cx: x, cy: y, r: 4.5, ...ring }, g);
}

// One line chart. series: [{ name, company, points: [{date, v}] }]. fmt formats a value.
function lineChart(host, { series, fmt, height = 170 }) {
  host.textContent = "";
  const W = Math.max(260, host.clientWidth || 320), H = height;
  const m = { t: 10, r: series.length > 1 ? 78 : 16, b: 22, l: 46 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) {
    const p = document.createElement("p");
    p.className = "chart-empty";
    p.textContent = "No data for these filters.";
    host.appendChild(p);
    return;
  }
  const t0 = Math.min(...all.map((p) => +p.date)), t1 = Math.max(...all.map((p) => +p.date));
  const ticks = niceTicks(Math.min(...all.map((p) => p.v)), Math.max(...all.map((p) => p.v)));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (d) => (t1 === t0 ? (m.l + W - m.r) / 2 : m.l + ((+d - t0) / (t1 - t0)) * (W - m.l - m.r));
  const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img" });
  ticks.forEach((v) => {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "grid-line" }, svg);
    svgEl("text", { x: m.l - 6, y: Y(v) + 3.5, class: "axis-label", "text-anchor": "end" }, svg).textContent = fmt(v, true);
  });
  // Date labels: first, last, and one in the middle when there's room.
  const dates = [...new Set(all.map((p) => +p.date))].sort((a, b) => a - b);
  const xticks = dates.length > 2 && W > 360 ? [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]] : [...new Set([dates[0], dates[dates.length - 1]])];
  xticks.forEach((d, i) => {
    const anchor = xticks.length === 1 ? "middle" : i === 0 ? "start" : i === xticks.length - 1 ? "end" : "middle";
    svgEl("text", { x: X(d), y: H - 6, class: "axis-label", "text-anchor": anchor }, svg).textContent = fmtDate(new Date(d));
  });

  const ends = [];
  series.forEach((s) => {
    const st = styleFor(s.company), pts = s.points;
    const g = svgEl("g", {}, svg);
    if (pts.length > 1) {
      svgEl("path", {
        d: pts.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)},${Y(p.v).toFixed(1)}`).join(""),
        style: `fill:none;stroke:${st.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round${st.dash ? `;stroke-dasharray:${st.dash}` : ""}`,
      }, g);
    }
    // Markers on every point when sparse, otherwise only the latest.
    (pts.length <= 12 ? pts : pts.slice(-1)).forEach((p) => marker(g, st.marker, X(p.date), Y(p.v), st.color));
    const lp = pts[pts.length - 1];
    ends.push({ y: Y(lp.v), x: X(lp.date), name: s.name });
  });
  // Direct labels at the right edge, nudged apart so they don't overlap.
  if (series.length > 1) {
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 12);
    ends.forEach((e) => {
      svgEl("text", { x: W - m.r + 8, y: Math.min(H - m.b, e.y) + 3.5, class: "series-label" }, svg).textContent = e.name;
    });
  }

  // Crosshair + one tooltip listing every series at the nearest report date.
  const hair = svgEl("line", { y1: m.t, y2: H - m.b, class: "crosshair", visibility: "hidden" }, svg);
  const hit = svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent", tabindex: 0 }, svg);
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  const show = (clientX) => {
    const r = svg.getBoundingClientRect(), x = ((clientX - r.left) / r.width) * W;
    const d = dates.reduce((best, t) => (Math.abs(X(t) - x) < Math.abs(X(best) - x) ? t : best), dates[0]);
    hair.setAttribute("x1", X(d)); hair.setAttribute("x2", X(d)); hair.setAttribute("visibility", "visible");
    tip.textContent = "";
    const head = document.createElement("div");
    head.className = "chart-tip-date";
    head.textContent = new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    tip.appendChild(head);
    series.forEach((s) => {
      const p = s.points.find((q) => Math.abs(+q.date - d) < 3 * 864e5);
      if (!p) return;
      const row = document.createElement("div");
      row.className = "chart-tip-row";
      const key = document.createElement("i");
      key.className = "chart-key";
      key.style.cssText = `border-top-color:${styleFor(s.company).color};border-top-style:${styleFor(s.company).dash ? "dashed" : "solid"}`;
      const val = document.createElement("b");
      val.textContent = fmt(p.v);
      const name = document.createElement("span");
      name.textContent = s.name;
      row.append(key, val, name);
      tip.appendChild(row);
    });
    tip.hidden = false;
    const px = (X(d) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(0, px - tip.offsetWidth / 2), r.width - tip.offsetWidth)}px`;
  };
  const hide = () => { hair.setAttribute("visibility", "hidden"); tip.hidden = true; };
  hit.addEventListener("pointermove", (e) => show(e.clientX));
  hit.addEventListener("pointerdown", (e) => show(e.clientX));
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("focus", () => { const r = svg.getBoundingClientRect(); show(r.right - 1); });
  hit.addEventListener("blur", hide);
  svg.setAttribute("aria-label", series.map((s) => {
    const lp = s.points[s.points.length - 1];
    return `${s.name}: ${fmt(lp.v)} on ${fmtDate(lp.date)}`;
  }).join("; "));
  host.append(svg, tip);
}

// Horizontal bars comparing one trainer with averages. rows: [{ label, v, kind: "self"|"club"|"brand" }].
function compareBars(host, { rows, fmt, company }) {
  host.textContent = "";
  const shown = rows.filter((r) => r.v != null && !isNaN(r.v));
  if (!shown.length) {
    const p = document.createElement("p");
    p.className = "chart-empty";
    p.textContent = "No data yet.";
    host.appendChild(p);
    return;
  }
  const W = Math.max(240, host.clientWidth || 300), rowH = 22, labelW = 86, valueW = 52;
  const H = shown.length * rowH + 4;
  const max = Math.max(...shown.map((r) => r.v), 0) || 1;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img" });
  const fill = { self: styleFor(company).color, club: "var(--series-neutral)", brand: "var(--series-neutral-2)" };
  shown.forEach((r, i) => {
    const y = i * rowH + 2, w = Math.max(2, (r.v / max) * (W - labelW - valueW - 8));
    svgEl("text", { x: labelW - 8, y: y + 13, class: "axis-label", "text-anchor": "end" }, svg).textContent = r.label;
    const bar = svgEl("rect", { x: labelW, y: y + 3, width: w, height: rowH - 8, rx: 4, style: `fill:${fill[r.kind]}` }, svg);
    svgEl("title", {}, bar).textContent = `${r.label}: ${fmt(r.v)}`;
    svgEl("text", { x: labelW + w + 6, y: y + 13, class: r.kind === "self" ? "bar-value strong" : "bar-value" }, svg).textContent = fmt(r.v);
  });
  svg.setAttribute("aria-label", shown.map((r) => `${r.label}: ${fmt(r.v)}`).join("; "));
  host.appendChild(svg);
}
