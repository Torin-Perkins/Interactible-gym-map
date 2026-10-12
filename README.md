# Grip PT @ LA Fitness — Atlanta map

Interactive map of the 24 Atlanta-area Grip PT / LA Fitness gyms and the home regions of trainer candidates.

## Data sources
- **Candidates** load live from the `GA` tab of the trainer-candidates Google Sheet (ID in `data.js`) each time
  the page opens or **Refresh** is clicked. The page only downloads a read-only CSV export without signing in,
  so it cannot modify the sheet. The sheet must be shared as "Anyone with the link can view".
- **Staff counts** (PTs, FMs, AFMs per gym) are a snapshot from the Grip PT staff list, stored in `STAFF` in `data.js`.

Area answers are matched against `KNOWN_AREAS` in `data.js`; unknown ones are looked up on OpenStreetMap
(only the area text is sent). Add entries to `KNOWN_AREAS` for better placement.

## Features
- **Search** any area, ZIP, or address to highlight the closest gyms (straight-line miles).
- **Click the map** or a candidate area to do the same.
- Regions are colored by best grade (A green, B blue, C orange, gray ungraded); solid outline = interview set.
- Gym popups list candidates within 12 miles.

## Publish on GitHub Pages
1. Push this repo to GitHub.
2. Repo **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.
3. Site appears at `https://<user>.github.io/<repo>/`.
