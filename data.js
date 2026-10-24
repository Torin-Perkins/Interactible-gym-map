// Grip PT at LA Fitness locations (addresses from lafitness.com, geocoded).
const GYMS = [
  { name: "Akers Mill", address: "2995 Cobb Parkway, Atlanta, GA 30339", lat: 33.87961, lng: -84.45947 },
  { name: "Alpharetta / Windward", address: "5530 Windward Parkway, Suite H, Alpharetta, GA 30004", lat: 34.08721, lng: -84.26647 },
  { name: "Ansley Mall", address: "1544 Piedmont Ave NE, Suite 115, Atlanta, GA 30324", lat: 33.79708, lng: -84.36909 },
  { name: "Atlanta - Peachtree Rd", address: "3535 Peachtree Road NE, Suite 300, Atlanta, GA 30326", lat: 33.8528, lng: -84.35974 },
  { name: "Austell - Austell Rd", address: "3999 Austell Road, Suite 101, Austell, GA 30106", lat: 33.85698, lng: -84.60116 },
  { name: "Buford", address: "3420 Buford Drive NE, Buford, GA 30519", lat: 34.07547, lng: -83.98401 },
  { name: "Cumming", address: "540 Lakeland Plaza, Cumming, GA 30040", lat: 34.18244, lng: -84.14595 },
  { name: "Douglasville", address: "3020 Chapel Hill Rd, Douglasville, GA 30135", lat: 33.72364, lng: -84.72939 },
  { name: "Duluth - Peachtree Industrial", address: "3455 Peachtree Industrial Blvd, Duluth, GA 30096", lat: 34.00629, lng: -84.17037 },
  { name: "Duluth - Pleasant Hill", address: "1625 Pleasant Hill Rd, #245, Duluth, GA 30096", lat: 33.94551, lng: -84.12555 },
  { name: "Holcomb @ 400", address: "1475 Holcomb Bridge Rd, Suite 189, Roswell, GA 30076", lat: 34.02026, lng: -84.31818 },
  { name: "Johns Creek", address: "11720 Medlock Bridge Road, Suite 400, Duluth, GA 30097", lat: 34.06532, lng: -84.1699 },
  { name: "Kennesaw - Wade Green", address: "4200 Wade Green Rd, Suite 38, Kennesaw, GA 30144", lat: 34.05857, lng: -84.59092 },
  { name: "Lenox / Buckhead", address: "3232 Peachtree Road NE, #A, Atlanta, GA 30305", lat: 33.84179, lng: -84.36302 },
  { name: "Marietta South", address: "1453 Terrell Mill Road, Suite 145, Marietta, GA 30067", lat: 33.91686, lng: -84.46865 },
  { name: "Midtown", address: "75 Fifth Street NW, Suite E, Atlanta, GA 30308", lat: 33.77692, lng: -84.38997 },
  { name: "Norcross - Peachtree Corners", address: "6131 Peachtree Parkway, Peachtree Corners, GA 30092", lat: 33.95209, lng: -84.2346 },
  { name: "Perimeter Pointe", address: "1155 Mount Vernon Hwy, Suite 600, Dunwoody, GA 30338", lat: 33.93376, lng: -84.3509 },
  { name: "Roswell - Hwy 92 / Hardscrabble Road", address: "1045 Woodstock Road, Roswell, GA 30075", lat: 34.06285, lng: -84.39425 },
  { name: "Sandy Springs", address: "6690 Roswell Road, Sandy Springs, GA 30328", lat: 33.93768, lng: -84.37792 },
  { name: "Sprayberry", address: "2550 Sandy Plains Rd, Marietta, GA 30066", lat: 34.01871, lng: -84.49091 },
  { name: "Sugar Hill", address: "6025 Cumming Highway, Sugar Hill, GA 30518", lat: 34.12198, lng: -84.07991 },
  { name: "Sugarloaf", address: "1860 Duluth Highway, Lawrenceville, GA 30043", lat: 33.97639, lng: -84.0771 },
  { name: "Towne Lake", address: "2060 Eagle Drive, Woodstock, GA 30189", lat: 34.11372, lng: -84.56691 },
];

// Live candidate data: the GA tab of the trainer-candidates Google Sheet.
// The sheet must be shared "Anyone with the link can view". It is only read.
const SHEET = {
  id: "1UYh1uadx_E8jQ8z5h0eSy7ZZRO2MJ7xZWqQJix5fev0",
  tab: "GA",
  metro: "Atlanta", // only rows whose preferred metro contains this
};

// ---------- Trainer stats sources ----------
// The shared "USAPT Data" Drive folder. drive-index.json lists its files (refreshed every
// 3 hours by .github/workflows/drive-index.yml); the page downloads and reads them live.
// Sub-folders: "Staff List" (one .xls per company) and "Unlogged Sessions"
// (payroll "Different Rows" comparisons, one per company per pay period).
// Any Google Sheet in the folder root with the KPI tabs below is read as club KPIs.
const DRIVE_FOLDER = "1mLoeOAb2twG-9sC97JyXfaTElyjwoPm9";
const KPI_TABS = {
  clients: "Total Clients All",
  lostSheep: "Total Lost Sheep Inc Prospects",
  nonProspectLostSheep: "Non Prospect Lost Sheep",
  lostSheepPct: "Lost Sheep %",
  billingHealth: "Billing Health",
  late: "Members With Late Amounts",
};

// App adoption sheet: one tab per region, a row per trainer.
const ADOPTION_SHEET = "1sG9Md9EJtQjKARumiLW-Mwi3pBC_ikzG9UbxF95a6gA";
// Onboarding sheet: everyone listed here counts as onboarded.
// Must be shared "Anyone with the link can view" for the page to read it.
const ONBOARDING_SHEET = { id: "1GQIwWuAYPU23wPL6TW3lp5Uv4rPX47bMEhsv5dd1tzw", gid: "830884200" };
// Certifications: fill in once the cert list exists (a sheet with a trainer name column).
// Anyone with a cert on file also counts as onboarded.
const CERT_SHEET = { id: "", gid: "" };

// Staff-list "Employee Type" values that count as personal trainers.
const PT_TYPE = /personal trainer|^(pt )?trainer$/i;
// KPI sheet club names that don't match the staff list by spelling.
const CLUB_ALIASES = { tualtin: "tualatin", pearl: "pearl district", "82nd": "portland se 82nd" };

// Shared trainer tracker: the Apps Script web app URL (ends in /exec) from apps-script/README.md.
// Leave blank to keep tracker edits in each person's browser only.
const TRACKER_DB = { url: "https://script.google.com/macros/s/AKfycbzVnvAUwMKs1_iUUPHEFUIVhyx9yAGVxPwKFnbPKxJCbqohSVb6RRME9MZbhw5sk90xqg/exec" };

// Trainer needs: gyms below this many personal trainers are flagged on the map tab.
const PT_TARGET = 4;

// Snapshot used only if the live staff list can't be loaded.
// pt = personal trainers, fm = fitness managers (incl. senior), afm = assistant fitness managers.
const STAFF_AS_OF = "Oct 12, 2026";
const STAFF = {
  "Alpharetta / Windward": { pt: 5, fm: 1, afm: 1 },
  "Buford": { pt: 4, fm: 1, afm: 3 },
  "Cumming": { pt: 2 },
  "Duluth - Peachtree Industrial": { pt: 3, afm: 3 },
  "Duluth - Pleasant Hill": { pt: 2 },
  "Holcomb @ 400": { pt: 1 },
  "Johns Creek": { pt: 5, fm: 1, afm: 4 },
  "Norcross - Peachtree Corners": { pt: 2 },
  "Roswell - Hwy 92 / Hardscrabble Road": { pt: 3, afm: 1 },
  "Sandy Springs": { pt: 4 },
  "Sugar Hill": { pt: 2, afm: 3 },
};

// Known answers to "what part of the metro do you live in", matched by keyword.
// Anything not listed here is geocoded with OpenStreetMap and cached.
// radiusKm is the size of the highlighted region drawn on the map.
const KNOWN_AREAS = [
  { area: "Buckhead", keys: ["buckhead"], lat: 33.8381, lng: -84.3796, radiusKm: 3.5 },
  { area: "Kennesaw", keys: ["kennesaw"], lat: 34.0234, lng: -84.6155, radiusKm: 5 },
  { area: "Duluth", keys: ["duluth"], lat: 34.0029, lng: -84.1446, radiusKm: 4 },
  { area: "Tucker", keys: ["tucker"], lat: 33.8545, lng: -84.2171, radiusKm: 4 },
  { area: "Cumming", keys: ["cumming"], lat: 34.2073, lng: -84.1402, radiusKm: 5 },
  { area: "Loganville", keys: ["loganville"], lat: 33.839, lng: -83.9008, radiusKm: 5 },
  { area: "Lawrenceville", keys: ["lawrenceville"], lat: 33.9562, lng: -83.988, radiusKm: 5 },
  { area: "Snellville", keys: ["snellville"], lat: 33.8573, lng: -84.0199, radiusKm: 4 },
  { area: "Conyers", keys: ["conyers"], lat: 33.6676, lng: -84.0177, radiusKm: 5 },
  { area: "Alpharetta", keys: ["alpharetta"], lat: 34.0754, lng: -84.2941, radiusKm: 5 },
  { area: "Athens", keys: ["athens"], lat: 33.9519, lng: -83.3576, radiusKm: 6 },
  { area: "NW Atlanta", keys: ["nw atlanta", "northwest atlanta"], lat: 33.795, lng: -84.455, radiusKm: 5 },
  { area: "North Gwinnett", keys: ["gwinnett", "north of atlanta"], lat: 34.02, lng: -84.04, radiusKm: 8 },
  { area: "Midtown", keys: ["midtown"], lat: 33.7840, lng: -84.3830, radiusKm: 2.5 },
  { area: "Atlanta (Downtown)", keys: ["atlanta"], lat: 33.749, lng: -84.388, radiusKm: 4 },
  { area: "Cherokee County", keys: ["cherokee"], lat: 34.2368, lng: -84.4908, radiusKm: 10 },
  { area: "Canton", keys: ["canton"], lat: 34.2368, lng: -84.4908, radiusKm: 4 },
  { area: "Buford", keys: ["buford"], lat: 34.1207, lng: -84.0044, radiusKm: 4 },
  { area: "Cumberland", keys: ["cumberland", "vinings"], lat: 33.8818, lng: -84.4697, radiusKm: 3 },
  { area: "Roswell", keys: ["roswell"], lat: 34.0232, lng: -84.3616, radiusKm: 4.5 },
  { area: "Flowery Branch", keys: ["flowery branch"], lat: 34.1851, lng: -83.9252, radiusKm: 4 },
  { area: "Stone Mountain", keys: ["stone mountain"], lat: 33.8082, lng: -84.1702, radiusKm: 4 },
  { area: "Sandy Springs", keys: ["sandy springs"], lat: 33.9304, lng: -84.3733, radiusKm: 3.5 },
  { area: "Oakwood", keys: ["oakwood"], lat: 34.2273, lng: -83.8843, radiusKm: 4 },
  { area: "Villa Rica", keys: ["villa rica"], lat: 33.732, lng: -84.9191, radiusKm: 4 },
  { area: "Auburn / Mulberry", keys: ["auburn", "mulberry"], lat: 34.0137, lng: -83.8277, radiusKm: 5 },
  { area: "Johns Creek", keys: ["johns creek"], lat: 34.0289, lng: -84.1986, radiusKm: 4.5 },
  { area: "Riverdale", keys: ["riverdale"], lat: 33.5726, lng: -84.4133, radiusKm: 4 },
  { area: "Marietta", keys: ["marietta"], lat: 33.9526, lng: -84.5499, radiusKm: 5 },
  { area: "Smyrna", keys: ["smyrna"], lat: 33.8840, lng: -84.5144, radiusKm: 4 },
  { area: "Decatur", keys: ["decatur"], lat: 33.7748, lng: -84.2963, radiusKm: 4 },
  { area: "Dunwoody", keys: ["dunwoody"], lat: 33.9462, lng: -84.3346, radiusKm: 3.5 },
  { area: "Woodstock", keys: ["woodstock"], lat: 34.1015, lng: -84.5194, radiusKm: 4.5 },
];
