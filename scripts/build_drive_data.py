"""Builds drive-data.json from the shared "USAPT Data" Drive folder.

Google blocks browsers from downloading Drive files cross-site and from listing folders
without an API key, so the deploy workflow runs this every few hours instead and ships the
result with the site. It uses only the public "Anyone with the link" views (no credentials)
and keeps just what the page needs: names, clubs and job titles from the staff lists (no
emails, phones, addresses or birthdays) and the per-trainer session differences from the
payroll comparisons. Google Sheets in the folder are only listed; the page reads them live.

Usage: python scripts/build_drive_data.py [output path]
Needs: pip install xlrd openpyxl
"""
import html
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone

import openpyxl
import xlrd

ROOT_FOLDER = "1mLoeOAb2twG-9sC97JyXfaTElyjwoPm9"
# Sheets outside the folder whose tab names the page needs (app adoption).
EXTRA_SHEETS = ["1sG9Md9EJtQjKARumiLW-Mwi3pBC_ikzG9UbxF95a6gA"]
# Staff-list rows worth shipping: trainers and fitness managers (the page narrows this
# further with PT_TYPE in data.js). Everyone else, and terminated staff, is left out.
KEEP_STAFF = re.compile(r"trainer|fitness manager", re.I)

UA = {"User-Agent": "Mozilla/5.0 (drive-data)"}


def get(url, binary=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def list_folder(folder_id, path):
    page = get(f"https://drive.google.com/embeddedfolderview?id={folder_id}")
    entries = re.findall(r'id="entry-([\w-]+)".*?href="([^"]+)".*?flip-entry-title">([^<]*)<', page, re.S)
    files = []
    for fid, href, title in entries:
        title, href = html.unescape(title).strip(), html.unescape(href)
        if "/drive/folders/" in href:
            files += list_folder(fid, path + [title])
            continue
        kind = "sheet" if "docs.google.com/spreadsheets" in href else "file"
        files.append({"id": fid, "name": title, "folder": "/".join(path), "kind": kind})
    return files


def sheet_info(sheet_id):
    page = get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit")
    m = re.search(r"<title>(.*?) - Google Sheets", page)
    return {
        "name": html.unescape(m.group(1)) if m else sheet_id,
        "tabs": [html.unescape(t) for t in re.findall(r'docs-sheet-tab-caption">([^<]*)<', page)],
    }


def read_workbook(file_id, name):
    """Returns {sheet name: rows} for a shared .xls or .xlsx file."""
    data = get(f"https://drive.usercontent.google.com/download?id={file_id}&export=download", binary=True)
    if data[:2] == b"PK":  # .xlsx
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheets = {ws.title: [list(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}
    elif data[:4] == bytes.fromhex("d0cf11e0"):  # legacy .xls
        wb = xlrd.open_workbook(file_contents=data)
        sheets = {s.name: [s.row_values(i) for i in range(s.nrows)] for s in wb.sheets()}
    else:
        raise ValueError(f"{name}: not an Excel file")
    # Pad ragged rows so every column index is safe to read.
    for rows in sheets.values():
        width = max((len(r) for r in rows), default=0)
        for r in rows:
            r.extend([None] * (width - len(r)))
    return sheets
    if data[:4] == b"\xd0\xcf\x11\xe0":  # legacy .xls
        wb = xlrd.open_workbook(file_contents=data)
        return {s.name: [s.row_values(i) for i in range(s.nrows)] for s in wb.sheets()}
    raise ValueError(f"{name}: not an Excel file")


def text(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return "" if v is None else str(v).strip()


def number(v):
    try:
        return float(str(v).replace(",", "")) if text(v) else 0.0
    except ValueError:
        return 0.0


def header_index(rows, first_col):
    for i, r in enumerate(rows):
        if any(text(v).lower() == first_col for v in r):
            return i, [text(v).lower() for v in r]
    return None, None


def read_staff(f):
    sheets = read_workbook(f["id"], f["name"])
    rows = next(iter(sheets.values()))
    hi, h = header_index(rows, "userid")
    if hi is None:
        return []
    c = {k: h.index(k) for k in ("userid", "firstname", "lastname", "location", "employee type")}
    out = []
    for r in rows[hi + 1:]:
        typ = text(r[c["employee type"]])
        if not text(r[c["userid"]]) or "terminated" in typ.lower() or not KEEP_STAFF.search(typ):
            continue
        out.append({
            "id": text(r[c["userid"]]), "first": text(r[c["firstname"]]), "last": text(r[c["lastname"]]),
            "location": text(r[c["location"]]), "type": typ, "file": f["name"],
        })
    return out


def read_unlogged(f):
    """Payroll "Different Rows" file: two payroll runs for one period, compared row by row.
    Unlogged sessions for a person = the difference in Total Sessions between the runs."""
    sheets = read_workbook(f["id"], f["name"])
    rows = next((v for k, v in sheets.items() if "different" in k.lower()), next(iter(sheets.values())))
    hi, h = header_index(rows, "source file")
    if hi is None:
        return None
    col = lambda p: next(i for i, x in enumerate(h) if x.startswith(p))
    c = {k: col(p) for k, p in [("src", "source"), ("loc", "location"), ("id", "user id"), ("first", "first"),
                                 ("last", "last"), ("type", "admin type"), ("sessions", "total sessions")]}
    people = {}
    for r in rows[hi + 1:]:
        uid = text(r[c["id"]])
        if not uid:
            continue
        key = (text(r[c["loc"]]), uid)
        p = people.setdefault(key, {"id": uid, "location": key[0], "name": f"{text(r[c['first']])} {text(r[c['last']])}".strip(),
                                    "types": set(), "sources": {}})
        p["types"].add(text(r[c["type"]]))
        src = text(r[c["src"]]) or "?"
        p["sources"][src] = p["sources"].get(src, 0) + number(r[c["sessions"]])
    sources = sorted({s for p in people.values() for s in p["sources"]})
    out = []
    for p in people.values():
        a, b = (p["sources"].get(s, 0) for s in (sources + ["", ""])[:2])
        n = abs(a - b)
        if n:
            out.append({"id": p["id"], "name": p["name"], "location": p["location"],
                        "types": sorted(t for t in p["types"] if t), "unlogged": int(n) if n.is_integer() else n})
    m = re.search(r"payroll_\d+_(.+?)_different", f["name"], re.I)
    return {"file": f["name"], "period": m.group(1) if m else re.sub(r"\.\w+$", "", f["name"]), "rows": out}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "drive-data.json"
    files = list_folder(ROOT_FOLDER, [])
    sheets = [{**f, **sheet_info(f["id"])} for f in files if f["kind"] == "sheet"]
    staff, unlogged, errors = [], [], []
    for f in files:
        if f["kind"] != "file":
            continue
        try:
            if re.search(r"staff list", f["folder"], re.I):
                staff += read_staff(f)
            elif re.search(r"unlogged", f["folder"], re.I):
                u = read_unlogged(f)
                if u:
                    unlogged.append(u)
        except Exception as e:  # keep going; the page shows what failed
            errors.append(f"{f['name']}: {e}")
            print("ERROR", f["name"], e, file=sys.stderr)
    data = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "folder": ROOT_FOLDER,
        "sheets": sheets,
        "extraSheets": {sid: sheet_info(sid) for sid in EXTRA_SHEETS},
        "staffFiles": sorted({s["file"] for s in staff}),
        "staff": staff,
        "unlogged": unlogged,
        "errors": errors,
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print(f"Wrote {out}: {len(staff)} staff, {len(unlogged)} payroll comparisons, {len(sheets)} sheets, {len(errors)} errors")


if __name__ == "__main__":
    main()
