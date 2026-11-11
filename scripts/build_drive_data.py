"""Builds drive-data.json from the shared "USAPT Data" Drive folder.

Google blocks browsers from downloading Drive files cross-site and from listing folders
without an API key, so the deploy workflow runs this every few hours instead and ships the
result with the site. It uses only the public "Anyone with the link" views (no credentials)
and keeps just what the page needs: names, clubs, job titles and hire dates from the staff lists (no
emails, phones, addresses or birthdays; emails and phone numbers go only into contacts.enc.json,
encrypted with the rates password), the per-trainer session differences from the
payroll comparisons, and per-trainer lost sheep counts (no client names). Google Sheets (stats, adoption) are read live by the page instead.

Usage: python scripts/build_drive_data.py [output path]
       python scripts/build_drive_data.py --app-clients <billing health .csv>   (updates app-clients.json)
Needs: pip install xlrd openpyxl
"""
import base64
import csv
import gzip
import html
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

import openpyxl
import xlrd

ROOT_FOLDER = "1mLoeOAb2twG-9sC97JyXfaTElyjwoPm9"
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


def read_workbook(file_id, name):
    """Returns {sheet name: rows} for a shared .xls or .xlsx file, or a Google Sheet (exported as .xlsx)."""
    if len(file_id) > 40:  # Google Sheets have long ids and can't be downloaded as files
        data = get(f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx", binary=True)
    else:
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


def text(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return "" if v is None else str(v).strip()


def number(v):
    try:
        return float(str(v).replace(",", "")) if text(v) else 0.0
    except ValueError:
        return 0.0


def iso_date(v):
    """Excel date serial, datetime or M/D/YYYY text -> "YYYY-MM-DD" ("" if blank or unreadable)."""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, (int, float)) and 20000 < v < 80000:
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).strftime("%Y-%m-%d")
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", text(v))
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else ""


def header_index(rows, first_col):
    for i, r in enumerate(rows):
        if any(text(v).lower() == first_col for v in r):
            return i, [text(v).lower() for v in r]
    return None, None


def read_staff(f, contacts=None):
    """Trainers and fitness managers for drive-data.json. When `contacts` is a list, every active
    staff member's email and phone numbers are added to it too (for the encrypted contacts file)."""
    sheets = read_workbook(f["id"], f["name"])
    rows = next(iter(sheets.values()))
    hi, h = header_index(rows, "userid")
    if hi is None:
        return []
    if contacts is not None:
        col = lambda k: h.index(k) if k in h else None
        cc = {k: col(k) for k in ("userid", "firstname", "lastname", "location", "employee type", "email", "cell phone", "home phone")}
        g = lambda r, k: text(r[cc[k]]) if cc[k] is not None else ""
        for r in rows[hi + 1:]:
            if not g(r, "userid") or "terminated" in g(r, "employee type").lower() or re.search(r" - demo$", g(r, "location"), re.I):
                continue
            contacts.append({"id": g(r, "userid"), "first": g(r, "firstname"), "last": g(r, "lastname"),
                             "location": g(r, "location"), "type": g(r, "employee type"), "email": g(r, "email"),
                             "cell": g(r, "cell phone"), "phone": g(r, "home phone"), "file": f["name"]})
    c = {k: h.index(k) for k in ("userid", "firstname", "lastname", "location", "employee type")}
    added = h.index("dateadded") if "dateadded" in h else None  # date added to the system ~ hire date
    out = []
    for r in rows[hi + 1:]:
        typ = text(r[c["employee type"]])
        if not text(r[c["userid"]]) or "terminated" in typ.lower() or not KEEP_STAFF.search(typ):
            continue
        out.append({
            "id": text(r[c["userid"]]), "first": text(r[c["firstname"]]), "last": text(r[c["lastname"]]),
            "location": text(r[c["location"]]), "type": typ, "file": f["name"],
            "hired": iso_date(r[added]) if added is not None else "",
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


def read_lost_sheep(f):
    """Lost sheep report: one row per member without a completed booking in the report window.
    A lost sheep belongs to the trainer of their last session ("Last Booking With"). The report is
    full of client contact details, so only per-trainer counts are kept."""
    sheets = read_workbook(f["id"], f["name"])
    rows = next(iter(sheets.values()))
    hi, h = header_index(rows, "last booking with")
    if hi is None:
        return None
    c = {k: h.index(k) for k in ("location name", "user id", "last booking with")}
    counts, total, no_booking = {}, 0, 0
    for r in rows[hi + 1:]:
        loc = text(r[c["location name"]])
        if not text(r[c["user id"]]) or re.search(r" - demo$", loc, re.I):  # Demo = test logins
            continue
        total += 1
        trainer = text(r[c["last booking with"]])
        if not trainer:
            no_booking += 1
            continue
        counts[(trainer, loc)] = counts.get((trainer, loc), 0) + 1
    notes = [text(r[0]) for r in rows[:hi] if text(r[0])]
    return {"file": f["name"], "title": " ".join(notes), "total": total, "noBooking": no_booking,
            "rows": [{"trainer": t, "location": loc, "count": n} for (t, loc), n in sorted(counts.items())]}


def company_of(text_):
    t = text_.lower()
    return ("Elevate" if re.search(r"elevate|fitness connection", t) else "GRIP" if re.search(r"grip|la fitness", t)
            else "Lighthouse" if re.search(r"lighthouse|10gym|\blfm\b", t) else "Other")


def pay_period(name):
    """"... 2026-10-01 - 2026-10-15.xls" -> {"start", "end", "label": "Oct 1-15, 2026"} (None if no dates)."""
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})", name)
    if not m:
        return None
    s = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    e = datetime(int(m.group(4)), int(m.group(5)), int(m.group(6)))
    label = f"{s:%b} {s.day}-{e.day}, {e.year}" if s.month == e.month else f"{s:%b} {s.day}-{e:%b} {e.day}, {e.year}"
    return {"start": s.strftime("%Y-%m-%d"), "end": e.strftime("%Y-%m-%d"), "label": label}


def read_agreements(f, sales, period):
    """Agreements Log: one row per agreement. Adds each salesperson's invoice total for the pay period
    (the Invoice column = the agreement's total value), leaving out cancelled agreements; an agreement
    sold by two people ("Noah R.\n+ Addison Compton") is split evenly. Keeps no customer details."""
    rows = next(iter(read_workbook(f["id"], f["name"]).values()))
    hi, h = header_index(rows, "salesperson")
    if hi is None:
        return 0
    c = {k: h.index(k) for k in ("user id", "customer", "description", "salesperson", "invoice")}
    cancelled = 0
    for r in rows[hi + 1:]:
        if not text(r[c["user id"]]):
            continue
        if re.search(r"^cancelled\b", text(r[c["description"]]), re.I | re.M):
            cancelled += 1
            continue
        names = [n.strip() for n in re.split(r"\n|\+", text(r[c["salesperson"]])) if n.strip()]
        if not names:
            continue
        loc = text(r[c["customer"]]).split("\n")[-1]
        company = company_of(loc)
        club = re.sub(r"^.*?(fitness|connection|10gym)\s*-\s*", "", loc, flags=re.I).strip()
        share = number(r[c["invoice"]]) / len(names)
        for n in names:
            s = sales.setdefault((company, n), {"company": company, "trainer": n, "clubs": [], "periods": {}})
            if club and club not in s["clubs"]:
                s["clubs"].append(club)
            p = s["periods"].setdefault(period["label"], {"invoice": 0.0, "agreements": 0})
            p["invoice"] = round(p["invoice"] + share, 2)
            p["agreements"] += 1
    return cancelled


def read_time_clock(f, hours, period):
    """Time Clock Payroll summary: total clocked minutes per employee (by user ID) for the pay period."""
    rows = next(iter(read_workbook(f["id"], f["name"]).values()))
    hi, h = header_index(rows, "employee user id")
    if hi is None:
        return
    c = {k: h.index(k) for k in ("employee user id", "location name", "total minutes")}
    for r in rows[hi + 1:]:
        uid = text(r[c["employee user id"]])
        if not uid:
            continue
        e = hours.setdefault(uid, {"id": uid, "company": company_of(text(r[c["location name"]])), "periods": {}})
        e["periods"][period["label"]] = e["periods"].get(period["label"], 0) + int(number(r[c["total minutes"]]))


APP_CLIENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app-clients.json")


def count_app_clients(csv_text, name):
    """Billing health export (Client Name, Trainer, Status, ..., Location): one row per client billed
    through the app. Keeps only the number of clients per trainer per brand, never client names."""
    rows = list(csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff"))))
    counts = {}
    for r in rows:
        trainer = (r.get("Trainer") or "").strip()
        loc = (r.get("Location") or "").strip()
        if not trainer or trainer.lower() == "unassigned" or not loc:
            continue
        key = (loc.split()[0], trainer)  # "GRIP Cumming" -> brand "GRIP"
        counts[key] = counts.get(key, 0) + 1
    return {"file": name, "total": len(rows),
            "rows": [{"company": c, "trainer": t, "clients": n} for (c, t), n in sorted(counts.items())]}


def encrypt_for_page(obj, password, iterations=600000):
    """Same format the Rates page writes (rates.js, v2): gzip, then AES-256-GCM with a key from
    PBKDF2-SHA-256 of the password. The page opens it with the rates password."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(password.encode())
    ct = AESGCM(key).encrypt(iv, gzip.compress(json.dumps(obj, separators=(",", ":")).encode()), None)
    b = lambda x: base64.b64encode(x).decode()
    return {"v": 2, "iter": iterations, "salt": b(salt), "iv": b(iv), "ct": b(ct)}


def newest_staff_lists(files):
    """One staff list per brand: the newest by the date in its name ("Stafflist10-23GRIP.xls",
    "stafflist11-3-2026GRIP.xls"), so an old list left in the folder doesn't double-count anyone."""
    def brand(f):
        m = re.search(r"grip|elevate|lighthouse|redwood", f["name"], re.I)
        return m.group(0).lower() if m else f["name"]
    def stamp(f):
        m = re.search(r"(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?", f["name"])
        if not m:
            return (0, 0, 0)
        now = datetime.now(timezone.utc)  # no year in the name: this year, or last year for a later month
        year = int(m.group(3)) if m.group(3) else now.year - (int(m.group(1)) > now.month)
        return (year + 2000 if year < 100 else year, int(m.group(1)), int(m.group(2)))
    best = {}
    for f in files:
        if brand(f) not in best or stamp(f) > stamp(best[brand(f)]):
            best[brand(f)] = f
    return set(id(f) for f in best.values())


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--app-clients":
        with open(sys.argv[2], encoding="utf-8-sig") as fh:
            counts = count_app_clients(fh.read(), os.path.basename(sys.argv[2]))
        with open(APP_CLIENTS_FILE, "w", encoding="utf-8") as fh:
            json.dump(counts, fh, indent=1)
        print(f"Wrote app-clients.json: {len(counts['rows'])} trainers from {counts['total']} clients")
        return
    out = sys.argv[1] if len(sys.argv) > 1 else "drive-data.json"
    files = list_folder(ROOT_FOLDER, [])
    keep_staff = newest_staff_lists([f for f in files if f["kind"] == "file" and re.search(r"staff list", f["folder"], re.I)])
    staff, unlogged, lost_sheep, errors, billing_files = [], [], [], [], []
    sales, hours, periods, cancelled = {}, {}, {}, 0  # trainer payroll stats (agreements, time clock)
    # Staff contact details, only when the rates password is set (RATES_PASSWORD, a GitHub secret).
    password = os.environ.get("RATES_PASSWORD", "")
    contacts = [] if password else None
    for f in files:
        if f["kind"] != "file":
            continue
        if len(f["id"]) > 40 and re.search(r"staff list|unlogged|lost sheep|trainer payroll", f["folder"], re.I):
            errors.append(f"{f['name']}: is a Google Doc, so its table can't be read; save it as a Google Sheet or Excel file")
            continue
        try:
            if re.search(r"staff list", f["folder"], re.I):
                if id(f) in keep_staff:
                    staff += read_staff(f, contacts)
            elif re.search(r"unlogged", f["folder"], re.I):
                u = read_unlogged(f)
                if u:
                    unlogged.append(u)
            elif re.search(r"trainer payroll", f["folder"], re.I):
                period = pay_period(f["name"])
                if not period:
                    continue
                if re.search(r"agreements", f["name"], re.I):
                    cancelled += read_agreements(f, sales, period)
                elif re.search(r"time clock", f["name"], re.I):
                    read_time_clock(f, hours, period)
                else:
                    continue
                periods.setdefault(period["label"], {**period, "files": []})["files"].append(f["name"])
            elif re.search(r"billing health", f["folder"], re.I) and f["name"].lower().endswith(".csv"):
                billing_files.append(f)
            elif re.search(r"lost sheep", f["folder"], re.I):
                ls = read_lost_sheep(f)
                if ls:
                    lost_sheep.append(ls)
        except Exception as e:  # keep going; the page shows what failed
            errors.append(f"{f['name']}: {e}")
            print("ERROR", f["name"], e, file=sys.stderr)
    # Clients on the app per trainer: the newest export in a "Billing Health" Drive folder, else the
    # counts committed in app-clients.json.
    app_clients = None
    for f in sorted(billing_files, key=lambda f: f["name"], reverse=True)[:1]:
        try:
            app_clients = count_app_clients(get(f"https://drive.usercontent.google.com/download?id={f['id']}&export=download"), f["name"])
        except Exception as e:
            errors.append(f"{f['name']}: {e}")
    if app_clients is None and os.path.exists(APP_CLIENTS_FILE):
        with open(APP_CLIENTS_FILE, encoding="utf-8") as fh:
            app_clients = json.load(fh)
    data = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "folder": ROOT_FOLDER,
        "staffFiles": sorted({s["file"] for s in staff}),
        "staff": staff,
        "unlogged": unlogged,
        "lostSheep": lost_sheep,
        "appClients": app_clients,
        # Per pay period: invoice totals per salesperson (cancelled agreements left out) and clocked
        # minutes per employee, from the "Trainer Payroll Stats" folder.
        "payrollStats": {"periods": sorted(({k: v for k, v in p.items() if k != "files"} for p in periods.values()), key=lambda p: p["start"]),
                         "sales": sorted(sales.values(), key=lambda s: (s["company"], s["trainer"])),
                         "hours": sorted(hours.values(), key=lambda e: e["id"]), "cancelledLeftOut": cancelled},
        "errors": errors,
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    # Encrypted contacts next to drive-data.json; never written unencrypted.
    if contacts is not None:
        contacts_out = os.path.join(os.path.dirname(os.path.abspath(out)), "contacts.enc.json")
        payload = {"generated": data["generated"], "files": sorted({c["file"] for c in contacts}), "rows": contacts}
        with open(contacts_out, "w", encoding="utf-8") as fh:
            json.dump(encrypt_for_page(payload, password), fh)
        print(f"Wrote {contacts_out}: {len(contacts)} staff contacts (encrypted)")
    print(f"Wrote {out}: {len(staff)} staff, {len(unlogged)} payroll comparisons, "
          f"{len(lost_sheep)} lost sheep reports, {len(errors)} errors")


if __name__ == "__main__":
    main()
