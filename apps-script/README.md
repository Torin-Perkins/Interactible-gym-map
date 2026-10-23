# Shared trainer tracker (Google Sheet database)

The Trainer stats tab saves onboarded / cert overrides, billing health and notes here so
everyone sees the same data. One-time setup (about 5 minutes):

1. Create a new Google Sheet, e.g. **Trainer Tracker**. It can stay private.
2. In the sheet: **Extensions → Apps Script**. Delete the sample code, paste in `Code.gs`
   from this folder, and save.
3. (Recommended) Set an edit key so only your team can change data:
   **Project Settings (gear) → Script properties → Add property**, name `EDIT_KEY`, value any
   passphrase. Share it with the people who should be able to edit.
4. **Deploy → New deployment → type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click Deploy, approve the permissions prompt, and copy the **Web app URL** (ends in `/exec`).
5. Paste that URL into `TRACKER_DB.url` in `data.js` and push.

The page reads the tracker for everyone. Edits need the edit key (if you set one): the first time
someone edits, the page asks for it and remembers it in that browser.

The "Tracker" tab is created automatically on the first save. Blank cells mean "use the
automatic value" (onboarding sheet, cert upload, app adoption sheet). You can edit the sheet
directly too; the page picks up changes on refresh.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the
URL stays the same.
