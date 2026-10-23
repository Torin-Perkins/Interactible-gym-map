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
- **Onboarding sheet** (`ONBOARDING_SHEET`) — everyone listed counts as onboarded. It must be shared as
  "Anyone with the link can view" before the page can read it.
- **Certifications** (`CERT_SHEET`) — empty until the cert list exists. Anyone with a cert on file (cert list or
  the adoption sheet's Cert column) also counts as onboarded.

Google Sheets are read live through their public CSV export. Browsers can't download Drive files or list a
folder without an API key, so the deploy workflow runs `scripts/build_drive_data.py` to read the folder into
`drive-data.json`. That file keeps only names, clubs, job titles and session differences (no emails, phones or
addresses) and is published with the site, never committed.

## Trainer tracker
Lost sheep, billing health, notes and any onboarded / cert overrides are typed into the table and saved in that
browser (localStorage). They aren't shared between people or devices: use **Export CSV** to back them up or pass
them on, and **Import CSV** to load them back in.

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
