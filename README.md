# Grip PT / USAPT — gym map and trainer stats

Two tabs:

- **Candidates & trainer needs** — interactive map of the 24 Atlanta-area Grip PT / LA Fitness gyms, the home
  regions of trainer candidates, and a list of gyms below the PT target (`PT_TARGET` in `data.js`) with how many
  candidates live within 12 miles.
- **Trainer stats** — club KPIs for every GRIP and Elevate club, plus a trainer tracker for every active personal
  trainer: onboarded, certification on file, lost sheep, billing health, app adoption, and average unlogged sessions.

## Data sources
- **Candidates** load live from the `GA` tab of the trainer-candidates Google Sheet (ID in `data.js`).
- **Shared "USAPT Data" Drive folder** (`DRIVE_FOLDER` in `data.js`):
  - `Staff List/` — one staff-list `.xls` per company. Active staff whose type matches `PT_TYPE` are the personal
    trainers. Also gives the live PT / FM / AFM counts on the map.
  - `Unlogged Sessions/` — payroll "Different Rows" comparisons, one per company per pay period. A trainer's
    unlogged sessions for a period = the difference in Total Sessions between the two payroll runs. The average is
    total unlogged ÷ number of pay periods on file for that company (a trainer missing from a comparison had 0).
    Only personal trainers are counted.
  - KPI sheets in the folder root (`GRIP Trainer KPIs`, `Elevate Trainer KPIs`) — read live. Tabs listed in
    `KPI_TABS`. The table shows the latest report and the change since the one before.
- **App adoption sheet** (`ADOPTION_SHEET`) — one tab per region; matched to trainers by name. Its Cert and
  Billing health columns pre-fill the tracker.
- **Onboarding form responses** (`ONBOARDING_SHEET`) — everyone who submitted counts as onboarded. A cert uploaded on
  the form counts as cert on file; "Yes" / "Working on it" without an upload is flagged instead.
- **Certifications** (`CERT_SHEET`) — optional separate cert list. Anyone with a cert on file (form upload, cert list,
  or the adoption sheet's Cert column) also counts as onboarded.
- **Lost sheep per trainer** — blank for now; will come from the lost sheep report.

Google Sheets are read live through their public CSV export. Browsers can't download Drive files or list a
folder without an API key, so the deploy workflow runs `scripts/build_drive_data.py` to read the folder into
`drive-data.json`. That file keeps only names, clubs, job titles and session differences (no emails, phones or
addresses) and is published with the site, never committed.

## Trainer tracker (shared database)
Billing health, notes and any onboarded / cert overrides are typed into the table. They're saved to a Google Sheet
through a small Apps Script web app, so everyone sees the same data. Set it up once with
[apps-script/README.md](apps-script/README.md), then put the web app URL in `TRACKER_DB.url` in `data.js`.
An optional edit key limits who can save. Until the URL is set, edits stay in each person's browser.
**Export CSV** / **Import CSV** still work for backups and bulk updates.

## Publish on GitHub Pages
1. Repo **Settings → Pages → Source: GitHub Actions**.
2. `.github/workflows/deploy.yml` deploys on every push to `main`, every 3 hours (to pick up new Drive files),
   and on demand from the Actions tab.

Note: the site is public, and the stats tab shows trainer names alongside their stats.

## Run locally
```bash
pip install xlrd openpyxl
python scripts/build_drive_data.py drive-data.json
python -m http.server 8765
```
