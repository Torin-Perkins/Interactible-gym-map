# USA PT Gym Map

Internal map of every **GRIP (LA Fitness)** and **Elevate (Fitness Connection)** gym, with live per-gym stats,
staff counts, and the home areas of trainer candidates, plus a **Trainer stats** tab that tracks every trainer.

## Candidates & trainer needs tab
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
| Staff counts | Staff lists in the Drive folder | Live from `drive-data.json` (see below); `STAFF` in `data.js` is the fallback snapshot. |
| App adoption | `ADOPTION_SHEET` in `data.js` | One row per trainer; hand-typed club names mapped via `ADOPTION_ALIASES`. |
| Payroll | `PAYROLL` in `data.js` | Session payroll snapshot, per-club counts only (no names or pay). |
| Gyms | `GYMS` in `data.js` | Addresses from lafitness.com / fitnessconnection.com; `approx: true` = estimated location. |

Candidate "where do you live" answers are pre-located in `CANDIDATE_GEO` (place names only). New answers are
looked up on OpenStreetMap in the browser and cached. Street-address answers are only placed to ~1 km and
labeled by neighborhood.

## Hiring-need model
For each club with payroll data (`HIRING` in `data.js` holds the tunable numbers):
- **Capacity used** = sessions per week ÷ (trainers × `trainerCapacity`, default 80 sessions/week = 40 hrs of 30-min sessions).
- **Net new clients/week** = change in the stats sheet's total clients over the last `lookbackWeeks` (default 4).
- **Weeks until full** = spare capacity ÷ (new clients/week × `sessionsPerNewClient`, default 1.5).
- **High**: capacity used ≥ 90%, full within 4 weeks, or no active trainers. **Medium**: ≥ 70% or full within 10 weeks. Otherwise **Low**.
- **Suggested extra trainers**: trainers needed to cover the projected load 8 weeks out.

## Trainer stats tab
Every active trainer on the staff lists (any "Employee Type" with "Trainer" in it except the Trainer Compliance
login — `PT_TYPE` in `data.js`), with club KPIs from the stats sheets. Two views:
- **Table** — club KPI table plus the trainer tracker: onboarded, cert on file, lost sheep (blank until the
  lost sheep report is added), billing health, app adoption, average unlogged sessions, notes.
- **Map** — each club at its gym's location, sized by trainers and colored by onboarded %, cert on file %,
  trainers on the app, unlogged sessions, billing health, or lost sheep %. Click a club for its trainers.

Sources:
- **Shared "USAPT Data" Drive folder** (`DRIVE_FOLDER`): `Staff List/` (one staff-list `.xls` per brand) and
  `Unlogged Sessions/` (payroll "Different Rows" comparisons, one per brand per pay period). A trainer's unlogged
  sessions for a period = the difference in Total Sessions between the two payroll runs; the average is the
  total ÷ pay periods on file for that brand.
- **Onboarding form responses** (`ONBOARDING_SHEET`) — everyone who submitted counts as onboarded; a cert
  uploaded there counts as cert on file ("Yes" / "Working on it" without an upload is flagged).
- **Certifications** (`CERT_SHEET`, optional) and the adoption sheet's Cert column also count as cert on file,
  and anyone with a cert on file counts as onboarded.

Browsers can't download Drive files or list a folder without an API key, so the deploy workflow runs
`scripts/build_drive_data.py` to read the folder into `drive-data.json`. That file keeps only names, clubs, job
titles and session differences (no emails, phones or addresses) and is published with the site, never committed.

### Shared tracker database
Onboarded / cert overrides, billing health and notes typed into the tracker save to a Google Sheet through a
small Apps Script web app (`apps-script/`, URL in `TRACKER_DB.url`), so everyone sees the same data. Set an
`EDIT_KEY` script property to limit who can save. **Export CSV** / **Import CSV** work for backups and bulk updates.

## Publish on GitHub Pages
1. Repo **Settings → Pages → Source: GitHub Actions**.
2. `.github/workflows/deploy.yml` deploys on every push to `main`, every 3 hours (to pick up new Drive files),
   and on demand from the Actions tab. Site: `https://torin-perkins.github.io/Interactible-gym-map/`.

Note: the site is public, and the stats tab shows trainer names alongside their stats.

## Run locally
```bash
pip install xlrd openpyxl
python scripts/build_drive_data.py drive-data.json
python -m http.server 8765
```
