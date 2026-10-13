# USA PT Gym Map

Internal map of every **GRIP (LA Fitness)** and **Elevate (Fitness Connection)** gym, with live per-gym stats,
staff counts, and the home areas of trainer candidates.

## Features
- **Brand + region filters** — All / GRIP / Elevate, and a region dropdown that zooms to that region.
- **Per-gym stats** (popup): total clients, lost sheep (incl. prospects / non-prospect), lost sheep %,
  members with late amounts, billing health — latest value, change vs. previous report, and a trend sparkline.
- **Color gyms by** a stat (red → green, scaled within each brand) or size them by clients / staff.
- **Gym table** for the selected region, sortable by clients, lost %, billing, or staff.
- **App adoption** (popup + color mode): trainers on the app, clients on the app, avg. profile completion.
- **Need for a new trainer** (High / Medium / Low): compares each club's weekly session load (payroll) with
  trainer capacity, and projects how fast weekly client growth (stats sheet) will fill the remaining capacity.
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
| App adoption | `ADOPTION_SHEET` in `data.js` | One row per trainer; hand-typed club names mapped via `ADOPTION_ALIASES`. |
| Payroll | `PAYROLL` in `data.js` | Session payroll snapshot, per-club counts only (no names or pay). |
| Gyms | `GYMS` in `data.js` | Addresses from lafitness.com / fitnessconnection.com; `approx: true` = estimated location. |

Candidate "where do you live" answers are pre-located in `CANDIDATE_GEO` (place names only). New answers are
looked up on OpenStreetMap in the browser and cached. Street-address answers are only placed to ~1 km and
labeled by neighborhood.

## Hiring-need model
For each club with payroll data (`HIRING` in `data.js` holds the tunable numbers):
- **Capacity used** = sessions per week ÷ (trainers × `trainerCapacity`, default 30 sessions/week).
- **Net new clients/week** = change in the stats sheet's total clients over the last `lookbackWeeks` (default 4).
- **Weeks until full** = spare capacity ÷ (new clients/week × `sessionsPerNewClient`, default 1.5).
- **High**: capacity used ≥ 90%, full within 4 weeks, or no active trainers. **Medium**: ≥ 70% or full within 10 weeks. Otherwise **Low**.
- **Suggested extra trainers**: trainers needed to cover the projected load 8 weeks out.

## Publish on GitHub Pages
Repo **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**. Site: `https://torin-perkins.github.io/Interactible-gym-map/`.
