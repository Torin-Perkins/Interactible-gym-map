# Grip PT @ LA Fitness — Atlanta map

Interactive map of the 24 Atlanta-area Grip PT / LA Fitness gyms and the home regions of trainer candidates.

## Loading candidates
Click **Choose spreadsheet…** (or drag the file onto the page) and pick the trainer-candidates `.xlsx`.
The `GA` tab is used if present, otherwise the first tab. Columns are found by header text
("Full Name", "Grade", "Status", "What part of your selected metro area…", etc.).

The file is read entirely in your browser — it is never uploaded, and no candidate data is stored in this repo.
The parsed areas are remembered in that browser until you click **Forget**; re-pick the file to refresh.

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
