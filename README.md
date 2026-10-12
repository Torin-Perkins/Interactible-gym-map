# USA PT Gym Map

Internal map of every **GRIP (LA Fitness)** and **Elevate (Fitness Connection)** gym, with live per-gym stats,
staff counts, and the home areas of trainer candidates.

## Features
- **Brand + region filters** — All / GRIP / Elevate, and a region dropdown that zooms to that region.
- **Per-gym stats** (popup): total clients, lost sheep (incl. prospects / non-prospect), lost sheep %,
  members with late amounts, billing health — latest value, change vs. previous report, and a trend sparkline.
- **Color gyms by** a stat (red → green, scaled within each brand) or size them by clients / staff.
- **Gym table** for the selected region, sortable by clients, lost %, billing, or staff.
- **Candidate regions** colored by best grade (A green, B blue, C orange, gray ungraded); solid outline = interview set.
- **Nearest-gym search** — search a place, click the map, or click a candidate area.

## Data sources
All Google Sheets are read live through Google's public CSV export (no sign-in, read-only — the page cannot
modify them). Each must be shared as "Anyone with the link can view".

| Data | Where | Notes |
| --- | --- | --- |
| Stats | `STATS_SHEETS` in `data.js` | One sheet per brand, one tab per metric (`METRICS`), a column per gym, a row per date. Gym columns are matched to `GYMS[].name`. |
| Candidates | `CANDIDATE_SHEET` in `data.js` | Region tabs listed in `tabs`; only metros in `METROS` are shown. |
| Staff counts | `STAFF` in `data.js` | Snapshot from the brands' staff lists (terminated excluded). |
| Gyms | `GYMS` in `data.js` | Addresses from lafitness.com / fitnessconnection.com; `approx: true` = estimated location. |

Candidate "where do you live" answers are pre-located in `CANDIDATE_GEO` (place names only). New answers are
looked up on OpenStreetMap in the browser and cached. Street-address answers are only placed to ~1 km and
labeled by neighborhood.

## Publish on GitHub Pages
Repo **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**. Site: `https://torin-perkins.github.io/Interactible-gym-map/`.
