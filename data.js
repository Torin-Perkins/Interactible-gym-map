// USA PT gym map data.
//
// GYMS: every GRIP (LA Fitness) and Elevate (Fitness Connection) gym. `name` must match the
// gym's column header in the brand's stats sheet; `label` (optional) is the display name.
// Addresses come from lafitness.com / fitnessconnection.com; approx: true = coordinates estimated.
const BRANDS = {
  GRIP: { label: "GRIP @ LA Fitness", color: "#d62828" },
  Elevate: { label: "Elevate @ Fitness Connection", color: "#6a3fb5" },
};

const GYMS = [
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "Vancouver East", "address":  "11505 NE Fourth Plain Rd, Vancouver, WA 98662", "lat":  45.666, "lng":  -122.55752},
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "Hazel Dell", "address":  "7607 NE 5th Avenue, Vancouver, WA 98665", "lat":  45.67709, "lng":  -122.66703},
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "Pearl", "label":  "Pearl District", "address":  "1400 NW Northrup Street, Portland, OR 97209", "lat":  45.5314, "lng":  -122.68556},
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "Lloyd Center", "address":  "1270 NE Weidler St, Portland, OR 97232", "lat":  45.53428, "lng":  -122.65284},
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "82nd", "label":  "SE 82nd", "address":  "4140 SE 82nd Avenue, Portland, OR 97266", "lat":  45.49249, "lng":  -122.57869},
  {"brand":  "GRIP", "region":  "Portland/Washington", "name":  "Tualtin", "label":  "Tualatin", "address":  "7405 SW Nyberg Street, Tualatin, OR 97062", "lat":  45.38268, "lng":  -122.75369},
  {"brand":  "GRIP", "region":  "Western Oregon", "name":  "Hillsboro", "address":  "7410 NE Imbrie Dr, Hillsboro, OR 97124", "lat":  45.55012, "lng":  -122.90276},
  {"brand":  "GRIP", "region":  "Western Oregon", "name":  "Beaverton", "address":  "2800 SW Hocken Ave, Beaverton, OR 97005", "lat":  45.4995, "lng":  -122.81287},
  {"brand":  "GRIP", "region":  "Western Oregon", "name":  "Gresham", "address":  "779 NW Council Drive, Gresham, OR 97030", "lat":  45.51058, "lng":  -122.43898},
  {"brand":  "GRIP", "region":  "Jacksonville", "name":  "Atlantic Beach", "address":  "985 Atlantic Blvd, Atlantic Beach, FL 32233", "lat":  30.32448, "lng":  -81.41467},
  {"brand":  "GRIP", "region":  "Jacksonville", "name":  "Kernan", "label":  "Atlantic @ Kernan", "address":  "11901 Atlantic Blvd, Jacksonville, FL 32225", "lat":  30.32142, "lng":  -81.49685},
  {"brand":  "GRIP", "region":  "Jacksonville", "name":  "Lakewood", "address":  "3600 University Blvd W, Jacksonville, FL 32217", "lat":  30.26149, "lng":  -81.6256, "approx":  true},
  {"brand":  "GRIP", "region":  "Jacksonville", "name":  "Old St. Augustine", "address":  "11250 Old St Augustine Rd, Jacksonville, FL 32257", "lat":  30.17163, "lng":  -81.60318},
  {"brand":  "GRIP", "region":  "Jacksonville", "name":  "Orange Park", "address":  "661 Blanding Blvd, Orange Park, FL 32073", "lat":  30.14961, "lng":  -81.75407},
  {"brand":  "GRIP", "region":  "Cincinnati", "name":  "Beavercreek", "address":  "2500 North Fairfield Rd, Beavercreek, OH 45431", "lat":  39.76204, "lng":  -84.05309},
  {"brand":  "GRIP", "region":  "Cincinnati", "name":  "Centerville", "address":  "45 West Alex Bell Road, Centerville, OH 45459", "lat":  39.64391, "lng":  -84.15794},
  {"brand":  "GRIP", "region":  "Cincinnati", "name":  "Kenwood", "address":  "8129 Montgomery Road, Cincinnati, OH 45236", "lat":  39.20364, "lng":  -84.36965},
  {"brand":  "GRIP", "region":  "Cincinnati", "name":  "West Chester", "address":  "7730 Dudley Drive, West Chester, OH 45069", "lat":  39.35422, "lng":  -84.36946},
  {"brand":  "GRIP", "region":  "Columbus", "name":  "Columbus-East Broad St", "address":  "6585 East Broad Street, Columbus, OH 43213", "lat":  39.981, "lng":  -82.82901},
  {"brand":  "GRIP", "region":  "Columbus", "name":  "Columbus-Goodale Blvd", "address":  "850 Goodale Blvd, Columbus, OH 43212", "lat":  39.97431, "lng":  -83.02636},
  {"brand":  "GRIP", "region":  "Columbus", "name":  "Columbus-Graceland Blvd.", "address":  "260 Graceland Blvd, Columbus, OH 43214", "lat":  40.06604, "lng":  -83.02472},
  {"brand":  "GRIP", "region":  "Columbus", "name":  "Columbus-Old Hamilton Rd", "address":  "5959 Old Hamilton Rd, Columbus, OH 43230", "lat":  40.07744, "lng":  -82.86222},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Allen", "address":  "605 W McDermott Dr, Allen, TX 75013", "lat":  33.10172, "lng":  -96.67608},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Carrollton", "address":  "2810 E Trinity Mills Rd, Carrollton, TX 75006", "lat":  32.98701, "lng":  -96.8544},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Denton", "address":  "2201 S Interstate 35 E, Denton, TX 76205", "lat":  33.18743, "lng":  -97.10834},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Garland", "address":  "2334 W Buckingham Rd, Garland, TX 75042", "lat":  32.93042, "lng":  -96.66332},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Irving", "address":  "3888 Irving Mall, Irving, TX 75062", "lat":  32.841, "lng":  -96.99437},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Lewisville", "address":  "1565 W Main St, Lewisville, TX 75067", "lat":  33.04237, "lng":  -97.03304},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Mesquite", "address":  "2021 N Town East Blvd, Mesquite, TX 75150", "lat":  32.81154, "lng":  -96.63074},
  {"brand":  "Elevate", "region":  "East Dallas", "name":  "Park Forest", "address":  "3630 Forest Lane, Dallas, TX 75234", "lat":  32.90947, "lng":  -96.85729},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Arlington", "address":  "3775 S Cooper St, Arlington, TX 76015", "lat":  32.6852, "lng":  -97.1319},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Bedford", "address":  "3300 Harwood Rd, Bedford, TX 76021", "lat":  32.85185, "lng":  -97.11462},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Forest Hill", "address":  "6750 Forest Hill Drive, Forest Hill, TX 76140", "lat":  32.65719, "lng":  -97.26997},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Grand Prairie", "address":  "4126 S Carrier Parkway, Grand Prairie, TX 75052", "lat":  32.67136, "lng":  -97.00583},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Hulen", "address":  "6080 S Hulen Street, Fort Worth, TX 76132", "lat":  32.66008, "lng":  -97.40084},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Oak Cliff", "address":  "2550 W Red Bird Lane, Dallas, TX 75237", "lat":  32.671, "lng":  -96.86077},
  {"brand":  "Elevate", "region":  "West Dallas", "name":  "Watauga", "address":  "8428 Denton Highway, Watauga, TX 76148", "lat":  32.8929, "lng":  -97.25888},
  {"brand":  "Elevate", "region":  "San Antonio/Austin", "name":  "Blanco West", "address":  "11743 West Ave, San Antonio, TX 78216", "lat":  29.54737, "lng":  -98.50782},
  {"brand":  "Elevate", "region":  "San Antonio/Austin", "name":  "Lake Creek", "address":  "13776 US Highway 183 N, Austin, TX 78750", "lat":  30.4618, "lng":  -97.7955, "approx":  true},
  {"brand":  "Elevate", "region":  "San Antonio/Austin", "name":  "South Park Mall", "address":  "2310 SW Military Drive, San Antonio, TX 78224", "lat":  29.35659, "lng":  -98.532},
  {"brand":  "Elevate", "region":  "San Antonio/Austin", "name":  "Tech Ridge", "address":  "12901 N Interstate 35, Austin, TX 78753", "lat":  30.41807, "lng":  -97.67232},
  {"brand":  "Elevate", "region":  "San Antonio/Austin", "name":  "Westover", "address":  "8327 State Highway 151, San Antonio, TX 78245", "lat":  29.43679, "lng":  -98.65198},
  {"brand":  "Elevate", "region":  "Nevada", "name":  "Kietzke", "label":  "Kietzke Center", "address":  "3310 Kietzke Lane, Reno, NV 89502", "lat":  39.49213, "lng":  -119.78906},
  {"brand":  "Elevate", "region":  "Nevada", "name":  "Sparks", "address":  "255 Disc Drive, Sparks, NV 89436", "lat":  39.575737, "lng":  -119.72255},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Baytown", "address":  "5035 Garth Rd, Baytown, TX 77521", "lat":  29.77872, "lng":  -94.9778},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Champions", "label":  "Champion Forest", "address":  "16616 Champion Forest Dr, Spring, TX 77379", "lat":  30.01127, "lng":  -95.53741},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Greenspoint", "address":  "12300 North Fwy, Houston, TX 77060", "lat":  29.94601, "lng":  -95.41261},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Humble", "address":  "9669 FM 1960 Bypass Rd W, Humble, TX 77338", "lat":  30.0051, "lng":  -95.28376},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Jones Road", "address":  "10920 FM 1960 Rd W, Houston, TX 77070", "lat":  29.9578, "lng":  -95.5555, "approx":  true},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Mission Bend", "address":  "7355 S Texas 6, Houston, TX 77083", "lat":  29.7, "lng":  -95.644, "approx":  true},
  {"brand":  "Elevate", "region":  "North Houston", "name":  "Woodlands", "address":  "129 Sawdust Rd, Spring, TX 77380", "lat":  30.12668, "lng":  -95.44421},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Almeda", "address":  "12338 Gulf Fwy, Houston, TX 77034", "lat":  29.61918, "lng":  -95.22009},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Bissonnet", "address":  "7098 Bissonnet St, Houston, TX 77074", "lat":  29.68742, "lng":  -95.50764},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Clear Lake", "address":  "20761 Gulf Fwy, Webster, TX 77598", "lat":  29.5275, "lng":  -95.12887},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Federal", "address":  "12032 East Fwy, Houston, TX 77029", "lat":  29.77108, "lng":  -95.22559},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Katy", "address":  "333 S Mason Rd, Katy, TX 77450", "lat":  29.78101, "lng":  -95.75171},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Pasadena", "address":  "3900 Spencer Hwy, Pasadena, TX 77504", "lat":  29.66507, "lng":  -95.18373},
  {"brand":  "Elevate", "region":  "West Houston", "name":  "Sugarland", "address":  "4610 Highway 6 South, Sugar Land, TX 77479", "lat":  29.64066, "lng":  -95.65163},
  {"brand":  "Elevate", "region":  "Charlotte", "name":  "Eastside", "address":  "6320 Albemarle Road, Charlotte, NC 28212", "lat":  35.20291, "lng":  -80.73816},
  {"brand":  "Elevate", "region":  "Charlotte", "name":  "Indian Trail", "address":  "13705 East Independence Blvd, Indian Trail, NC 28079", "lat":  35.08407, "lng":  -80.66061},
  {"brand":  "Elevate", "region":  "Charlotte", "name":  "Northlake", "address":  "8626 Hankins Road, Charlotte, NC 28269", "lat":  35.34089, "lng":  -80.83433},
  {"brand":  "Elevate", "region":  "Charlotte", "name":  "University", "label":  "University Place", "address":  "8709 JW Clay Blvd, Charlotte, NC 28262", "lat":  35.31089, "lng":  -80.75287},
  {"brand":  "Elevate", "region":  "Northern NC", "name":  "Fayetteville", "address":  "1937 Skibo Road, Fayetteville, NC 28314", "lat":  35.066, "lng":  -78.96716},
  {"brand":  "Elevate", "region":  "Northern NC", "name":  "Greenville", "address":  "140 Oakmont Drive, Greenville, NC 27858", "lat":  35.57843, "lng":  -77.35968},
  {"brand":  "Elevate", "region":  "Northern NC", "name":  "North Hills", "address":  "4120 Main at North Hills St, Raleigh, NC 27609", "lat":  35.83661, "lng":  -78.64324},
  {"brand":  "Elevate", "region":  "Northern NC", "name":  "RTP", "address":  "4700 Emperor Blvd, Durham, NC 27703", "lat":  35.87683, "lng":  -78.83883},
  {"brand":  "Elevate", "region":  "Georgia", "name":  "Morrow", "address":  "1905 Mt Zion Road, Morrow, GA 30260", "lat":  33.56829, "lng":  -84.32979},
  {"brand":  "Elevate", "region":  "Georgia", "name":  "Stone Mountain", "address":  "5370 Stone Mountain Highway, Stone Mountain, GA 30087", "lat":  33.82293, "lng":  -84.11335},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Akers Mill", "address":  "2995 Cobb Parkway, Atlanta, GA 30339", "lat":  33.87961, "lng":  -84.45947},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Alpharetta / Windward", "address":  "5530 Windward Parkway, Suite H, Alpharetta, GA 30004", "lat":  34.08721, "lng":  -84.26647},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Ansley Mall", "address":  "1544 Piedmont Ave NE, Suite 115, Atlanta, GA 30324", "lat":  33.79708, "lng":  -84.36909},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Atlanta - Peachtree Rd", "address":  "3535 Peachtree Road NE, Suite 300, Atlanta, GA 30326", "lat":  33.8528, "lng":  -84.35974},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Austell - Austell Rd", "address":  "3999 Austell Road, Suite 101, Austell, GA 30106", "lat":  33.85698, "lng":  -84.60116},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Buford", "address":  "3420 Buford Drive NE, Buford, GA 30519", "lat":  34.07547, "lng":  -83.98401},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Cumming", "address":  "540 Lakeland Plaza, Cumming, GA 30040", "lat":  34.18244, "lng":  -84.14595},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Douglasville", "address":  "3020 Chapel Hill Rd, Douglasville, GA 30135", "lat":  33.72364, "lng":  -84.72939},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Duluth - Peachtree Industrial", "address":  "3455 Peachtree Industrial Blvd, Duluth, GA 30096", "lat":  34.00629, "lng":  -84.17037},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Duluth - Pleasant Hill", "address":  "1625 Pleasant Hill Rd, #245, Duluth, GA 30096", "lat":  33.94551, "lng":  -84.12555},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Holcomb @ 400", "address":  "1475 Holcomb Bridge Rd, Suite 189, Roswell, GA 30076", "lat":  34.02026, "lng":  -84.31818},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Johns Creek", "address":  "11720 Medlock Bridge Road, Suite 400, Duluth, GA 30097", "lat":  34.06532, "lng":  -84.1699},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Kennesaw - Wade Green", "address":  "4200 Wade Green Rd, Suite 38, Kennesaw, GA 30144", "lat":  34.05857, "lng":  -84.59092},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Lenox / Buckhead", "address":  "3232 Peachtree Road NE, #A, Atlanta, GA 30305", "lat":  33.84179, "lng":  -84.36302},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Marietta South", "address":  "1453 Terrell Mill Road, Suite 145, Marietta, GA 30067", "lat":  33.91686, "lng":  -84.46865},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Midtown", "address":  "75 Fifth Street NW, Suite E, Atlanta, GA 30308", "lat":  33.77692, "lng":  -84.38997},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Norcross - Peachtree Corners", "address":  "6131 Peachtree Parkway, Peachtree Corners, GA 30092", "lat":  33.95209, "lng":  -84.2346},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Perimeter Pointe", "address":  "1155 Mount Vernon Hwy, Suite 600, Dunwoody, GA 30338", "lat":  33.93376, "lng":  -84.3509},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Roswell - Hwy 92 / Hardscrabble Road", "address":  "1045 Woodstock Road, Roswell, GA 30075", "lat":  34.06285, "lng":  -84.39425},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Sandy Springs", "address":  "6690 Roswell Road, Sandy Springs, GA 30328", "lat":  33.93768, "lng":  -84.37792},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Sprayberry", "address":  "2550 Sandy Plains Rd, Marietta, GA 30066", "lat":  34.01871, "lng":  -84.49091},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Sugar Hill", "address":  "6025 Cumming Highway, Sugar Hill, GA 30518", "lat":  34.12198, "lng":  -84.07991},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Sugarloaf", "address":  "1860 Duluth Highway, Lawrenceville, GA 30043", "lat":  33.97639, "lng":  -84.0771},
  {"brand":  "GRIP", "region":  "Georgia", "name":  "Towne Lake", "address":  "2060 Eagle Drive, Woodstock, GA 30189", "lat":  34.11372, "lng":  -84.56691},
];

// Live stats: one Google Sheet per brand, one tab per metric, a column per gym, a row per date.
// Shared "Anyone with the link can view"; only read, never written.
const STATS_SHEETS = {
  GRIP: "1G7bKW31ZsTMCzNmElXLPGSZ-eJWGodTNHxdEyO4UXOg",
  Elevate: "1L5dspQ716Qx0gF7hhq04PSapbMJ1FvhZPY6Ke-wYJqU",
};
// better: "up" = higher is better, "down" = lower is better
const METRICS = [
  { tab: "Total Clients All", key: "clients", label: "Total clients", pct: false, better: "up" },
  { tab: "Total Lost Sheep Inc Prospects", key: "lost", label: "Lost sheep (incl. prospects)", pct: false, better: "down" },
  { tab: "Non Prospect Lost Sheep", key: "lostNp", label: "Lost sheep (non-prospect)", pct: false, better: "down" },
  { tab: "Lost Sheep %", key: "lostPct", label: "Lost sheep %", pct: true, better: "down" },
  { tab: "Members With Late Amounts", key: "late", label: "Members with late amounts", pct: false, better: "down" },
  { tab: "Billing Health", key: "billing", label: "Billing health", pct: true, better: "up" },
];

// Active staff per gym from the brands' staff lists (terminated excluded).
// pt = trainers, fm = fitness managers (incl. senior), afm = assistant fitness managers.
const STAFF_AS_OF = "Oct 12, 2026";
const STAFF = {
  "GRIP": {
    "82nd": {
      "fm": 1,
      "pt": 4
    },
    "Alpharetta / Windward": {
      "pt": 5,
      "afm": 1,
      "fm": 1
    },
    "Atlantic Beach": {
      "pt": 4
    },
    "Beavercreek": {
      "afm": 4,
      "pt": 5
    },
    "Beaverton": {
      "fm": 2,
      "pt": 4
    },
    "Buford": {
      "pt": 4,
      "afm": 3,
      "fm": 1
    },
    "Centerville": {
      "pt": 4,
      "fm": 2,
      "afm": 1
    },
    "Columbus-East Broad St": {
      "pt": 2
    },
    "Columbus-Goodale Blvd": {
      "fm": 3,
      "afm": 1,
      "pt": 3
    },
    "Columbus-Graceland Blvd.": {
      "afm": 2,
      "pt": 5,
      "fm": 1
    },
    "Columbus-Old Hamilton Rd": {
      "pt": 4,
      "fm": 2
    },
    "Cumming": {
      "pt": 2
    },
    "Duluth - Peachtree Industrial": {
      "afm": 3,
      "pt": 3
    },
    "Duluth - Pleasant Hill": {
      "pt": 2
    },
    "Gresham": {
      "pt": 6,
      "afm": 1,
      "fm": 1
    },
    "Hazel Dell": {
      "pt": 7,
      "afm": 4,
      "fm": 1
    },
    "Hillsboro": {
      "pt": 6,
      "afm": 8
    },
    "Holcomb @ 400": {
      "pt": 1
    },
    "Johns Creek": {
      "pt": 5,
      "afm": 4,
      "fm": 1
    },
    "Kenwood": {
      "pt": 6,
      "afm": 1
    },
    "Kernan": {
      "pt": 3
    },
    "Lakewood": {
      "pt": 1,
      "fm": 1
    },
    "Lloyd Center": {
      "pt": 6
    },
    "Norcross - Peachtree Corners": {
      "pt": 2
    },
    "Old St. Augustine": {
      "pt": 7,
      "fm": 3
    },
    "Orange Park": {
      "pt": 2,
      "fm": 1
    },
    "Pearl": {
      "pt": 7,
      "fm": 1,
      "afm": 2
    },
    "Roswell - Hwy 92 / Hardscrabble Road": {
      "pt": 3,
      "afm": 1
    },
    "Sandy Springs": {
      "pt": 4
    },
    "Sugar Hill": {
      "afm": 3,
      "pt": 2
    },
    "Tualtin": {
      "afm": 3,
      "fm": 1,
      "pt": 6
    },
    "Vancouver East": {
      "pt": 4,
      "afm": 1
    },
    "West Chester": {
      "pt": 5,
      "fm": 1
    }
  },
  "Elevate": {
    "Allen": {
      "afm": 3,
      "pt": 2,
      "fm": 1
    },
    "Baytown": {
      "pt": 4,
      "afm": 1
    },
    "Bedford": {
      "afm": 2,
      "pt": 5
    },
    "Bissonnet": {
      "fm": 1,
      "afm": 2,
      "pt": 2
    },
    "Blanco West": {
      "pt": 2,
      "fm": 1
    },
    "Carrollton": {
      "pt": 5,
      "afm": 2
    },
    "Champions": {
      "pt": 8,
      "fm": 4,
      "afm": 1
    },
    "Clear Lake": {
      "pt": 3,
      "afm": 1,
      "fm": 1
    },
    "Demo": {
      "pt": 5,
      "fm": 2,
      "afm": 1
    },
    "Denton": {
      "pt": 7,
      "afm": 4,
      "fm": 1
    },
    "Eastside": {
      "pt": 8,
      "afm": 1
    },
    "Fayetteville": {
      "pt": 3,
      "fm": 1
    },
    "Federal": {
      "fm": 1,
      "pt": 3,
      "afm": 2
    },
    "Forest Hill": {
      "pt": 3,
      "fm": 1
    },
    "Garland": {
      "fm": 1,
      "pt": 5,
      "afm": 1
    },
    "Grand Prairie": {
      "afm": 4,
      "pt": 4,
      "fm": 1
    },
    "Greenspoint": {
      "afm": 1,
      "pt": 1
    },
    "Greenville": {
      "pt": 3,
      "fm": 1
    },
    "Hulen": {
      "pt": 7,
      "afm": 1
    },
    "Humble": {
      "pt": 2
    },
    "Indian Trail": {
      "pt": 2,
      "afm": 1,
      "fm": 1
    },
    "Irving": {
      "pt": 8,
      "afm": 1,
      "fm": 2
    },
    "Jones Road": {
      "afm": 1,
      "fm": 1
    },
    "Katy": {
      "afm": 3,
      "pt": 1
    },
    "Kietzke": {
      "pt": 5,
      "afm": 1
    },
    "Lake Creek": {
      "pt": 6
    },
    "Lewisville": {
      "pt": 3,
      "afm": 1
    },
    "Mesquite": {
      "pt": 5,
      "afm": 5,
      "fm": 1
    },
    "Mission Bend": {
      "pt": 2
    },
    "Morrow": {
      "pt": 10,
      "fm": 2,
      "afm": 1
    },
    "North Hills": {
      "pt": 2,
      "afm": 2
    },
    "Northlake": {
      "pt": 2
    },
    "Oak Cliff": {
      "fm": 1,
      "pt": 7
    },
    "Park Forest": {
      "afm": 5,
      "pt": 3,
      "fm": 2
    },
    "Pasadena": {
      "fm": 1,
      "afm": 1,
      "pt": 2
    },
    "RTP": {
      "pt": 1
    },
    "South Park Mall": {
      "pt": 7,
      "afm": 2,
      "fm": 2
    },
    "Sparks": {
      "pt": 13,
      "fm": 1,
      "afm": 1
    },
    "Stone Mountain": {
      "pt": 8,
      "afm": 4,
      "fm": 1
    },
    "Sugarland": {
      "pt": 7,
      "afm": 1
    },
    "Tech Ridge": {
      "pt": 10,
      "afm": 3,
      "fm": 2
    },
    "University": {
      "pt": 4,
      "afm": 1,
      "fm": 1
    },
    "Watauga": {
      "pt": 4,
      "afm": 2
    },
    "Westover": {
      "pt": 10,
      "fm": 1,
      "afm": 3
    },
    "Woodlands": {
      "pt": 3,
      "afm": 6
    }
  }
};

// Live candidate data: trainer-candidates Google Sheet, one tab per region.
// Shared "Anyone with the link can view"; only read, never written.
const CANDIDATE_SHEET = {
  id: "1UYh1uadx_E8jQ8z5h0eSy7ZZRO2MJ7xZWqQJix5fev0",
  tabs: ["Austin and San Antonio", "Dallas", "Eastern", "GA", "Houston", "ohio", "Portland", "Jacksonville "],
};

// Metros candidates can pick that belong to a GRIP or Elevate region, with their centers.
const METROS = {
  "Portland, OR": [45.5152, -122.6784],
  "Jacksonville, FL": [30.3322, -81.6557],
  "Cincinnati, OH": [39.1031, -84.512],
  "Dayton, OH": [39.7589, -84.1916],
  "Columbus, OH": [39.9612, -82.9988],
  "Atlanta, GA": [33.749, -84.388],
  "Dallas, TX": [32.7767, -96.797],
  "Fort Worth, TX": [32.7555, -97.3308],
  "San Antonio, TX": [29.4241, -98.4936],
  "Austin, TX": [30.2672, -97.7431],
  "Houston, TX": [29.7604, -95.3698],
  "Charlotte, NC": [35.2271, -80.8431],
  "Raleigh, NC": [35.7796, -78.6382],
  "Fayetteville, NC": [35.0527, -78.8784],
  "Greenville, NC": [35.6127, -77.3664],
};

// Pre-computed locations for candidates' "what part of the metro do you live in" answers,
// keyed by "<answer, lowercased>|<metro>" -> [lat, lng, radiusKm, label]. Only place names, no
// personal data. Answers not listed here are looked up on OpenStreetMap when the page loads.
const CANDIDATE_GEO = {
  "1604n westloop|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "1817 west 38th street austin texas|Austin, TX": [30.31, -97.75, 3, "Oakmont Heights"],
  "2400 briarwest blvd, houston, texas, 77077 area code|Houston, TX": [29.74, -95.61, 3, "Houston"],
  "32246|Jacksonville, FL": [30.3009, -81.5105, 4, "32246"],
  "77013|Houston, TX": [29.7826, -95.2441, 4, "77013"],
  "77020 houston tx|Houston, TX": [29.775, -95.3128, 4, "77020"],
  "78227 west side|San Antonio, TX": [29.48, -98.49, 3, "78212"],
  "addison, dallas|Dallas, TX": [32.9601, -96.83, 6, "Addison"],
  "addison|Dallas, TX": [32.9601, -96.83, 6, "Addison"],
  "alameda houston|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "alamo ranch|San Antonio, TX": [29.4843, -98.7333, 3.5, "Alamo Ranch"],
  "alington|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "allen|Dallas, TX": [33.1032, -96.6706, 6, "Allen"],
  "alpharetta|Atlanta, GA": [34.0754, -84.2941, 5, "Alpharetta"],
  "arlington tx|Dallas, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington tx|Fort Worth, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington, fort worth, grand prairie|Fort Worth, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington, mansfield, ft worth|Fort Worth, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington, tx|Dallas, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington,texas|Dallas, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington/irving|Dallas, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington|Dallas, TX": [32.7356, -97.1071, 6, "Arlington"],
  "arlington|Fort Worth, TX": [32.7356, -97.1071, 6, "Arlington"],
  "athens|Atlanta, GA": [33.9519, -83.3576, 6, "Athens"],
  "atlanta|Atlanta, GA": [33.749, -84.388, 12, "Atlanta"],
  "atlantic beach|Jacksonville, FL": [30.3344, -81.3987, 5, "Atlantic Beach"],
  "atlantic blvd, la fitness|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "auburn or mulberry|Atlanta, GA": [34.0137, -83.8277, 5, "Auburn / Mulberry"],
  "austin /pflugerville|Austin, TX": [30.2649, -97.7474, 12, "Austin"],
  "austin, tx|Austin, TX": [30.2672, -97.7431, 12, "Austin"],
  "austin- east side near the airport|Austin, TX": [30.2649, -97.7474, 12, "Austin"],
  "austin|Austin, TX": [30.2672, -97.7431, 12, "Austin"],
  "bandera|San Antonio, TX": [29.727, -99.0725, 5, "Bandera"],
  "baytown/pasedena area|Houston, TX": [29.7355, -94.9774, 5, "Baytown"],
  "baytown|Houston, TX": [29.7355, -94.9774, 5, "Baytown"],
  "beavercreek, oh is not an option in the question above|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "beaverton or|Portland, OR": [45.4872, -122.8038, 6, "Beaverton"],
  "beaverton, or|Portland, OR": [45.4872, -122.8038, 6, "Beaverton"],
  "beaverton,or|Portland, OR": [45.4872, -122.8038, 6, "Beaverton"],
  "beaverton|Portland, OR": [45.4872, -122.8038, 6, "Beaverton"],
  "bedford|Dallas, TX": [32.844, -97.1431, 5, "Bedford"],
  "bexar county- sa 78242|San Antonio, TX": [29.4264, -98.5105, 12, "Bexar County"],
  "bexar county|San Antonio, TX": [29.4264, -98.5105, 12, "Bexar County"],
  "boerne|San Antonio, TX": [29.7947, -98.732, 5, "Boerne"],
  "buckhead|Atlanta, GA": [33.8381, -84.3796, 3.5, "Buckhead"],
  "buda|Austin, TX": [30.0825, -97.8417, 5, "Buda"],
  "buford|Atlanta, GA": [34.1207, -84.0044, 4, "Buford"],
  "burleson texas|Fort Worth, TX": [32.5421, -97.3208, 5, "Burleson"],
  "canal winchester|Cincinnati, OH": [39.8428, -82.8056, 5, "Canal Winchester"],
  "canal winchester|Columbus, OH": [39.8428, -82.8056, 5, "Canal Winchester"],
  "carrollton, texas|Dallas, TX": [32.9515, -96.9034, 6, "Carrollton"],
  "carrollton|Dallas, TX": [32.9515, -96.9034, 6, "Carrollton"],
  "carrolton|Dallas, TX": [32.9537, -96.8903, 5, "Carrollton"],
  "cary|Raleigh, NC": [35.7874, -78.7812, 6, "Cary"],
  "castle hills|San Antonio, TX": [29.5233, -98.5164, 3.5, "Castle Hills"],
  "castle hill|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "cedar hill/grand prairie|Dallas, TX": [32.5888, -96.9554, 5, "Cedar Hill"],
  "cedar hill|Dallas, TX": [32.5888, -96.9554, 5, "Cedar Hill"],
  "cedar park|Austin, TX": [30.5217, -97.8278, 5, "Cedar Park"],
  "centennial|Portland, OR": [45.5056, -122.4997, 3.5, "Centennial"],
  "central austin|Austin, TX": [30.2672, -97.7431, 5, "Central Austin"],
  "charlotte mecklenburg|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "charlotte nc east charlotte|Charlotte, NC": [35.2271, -80.6831, 10, "East Charlotte"],
  "charlotte nc|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "charlotte west side|Charlotte, NC": [35.2271, -81.0031, 10, "West Charlotte"],
  "charlotte, nc|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "charlotte|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "cherokee county|Atlanta, GA": [34.2368, -84.4908, 10, "Cherokee County"],
  "cincinnati ohio|Cincinnati, OH": [39.1031, -84.512, 12, "Cincinnati"],
  "cincinnati|Cincinnati, OH": [39.1031, -84.512, 12, "Cincinnati"],
  "city|Atlanta, GA": [33.749, -84.388, 12, "Atlanta"],
  "city|Fayetteville, NC": [35.0527, -78.8784, 12, "Fayetteville"],
  "clayton county|Atlanta, GA": [33.5205, -84.3592, 12, "Clayton County"],
  "clayton, north carolina|Raleigh, NC": [35.6507, -78.4564, 5, "Clayton"],
  "clintonville|Columbus, OH": [40.0392, -83.0096, 3, "Clintonville"],
  "college hill|Cincinnati, OH": [39.2023, -84.5472, 3.5, "College Hill"],
  "columbus ohio|Cincinnati, OH": [39.9612, -82.9988, 12, "Columbus"],
  "columbus ohio|Dayton, OH": [39.9612, -82.9988, 12, "Columbus"],
  "columbus, oh|Columbus, OH": [39.9612, -82.9988, 12, "Columbus"],
  "columbus|Dayton, OH": [39.9612, -82.9988, 12, "Columbus"],
  "concord|Charlotte, NC": [35.4094, -80.58, 6, "Concord"],
  "conroe|Houston, TX": [30.3119, -95.4561, 5, "Conroe"],
  "crosby|Houston, TX": [29.9115, -95.0633, 5, "Crosby"],
  "cumberland area|Atlanta, GA": [33.8818, -84.4697, 3, "Cumberland"],
  "cumming/alpharetta|Atlanta, GA": [34.2073, -84.1402, 5, "Cumming"],
  "cumming|Atlanta, GA": [34.2073, -84.1402, 5, "Cumming"],
  "cypress|Houston, TX": [29.9691, -95.6972, 5, "Cypress"],
  "dallas - the 1701 preston location is best for now|Dallas, TX": [32.7763, -96.7969, 12, "Dallas"],
  "dallas by smu|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas county|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas fort worth texas|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "dallas texas 404 e ninth st|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas texas, 75228 (garland)|Dallas, TX": [32.9126, -96.6389, 6, "Garland"],
  "dallas texas|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas tx|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas, texas|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dallas|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "dawsonville|Atlanta, GA": [34.4212, -84.1191, 5, "Dawsonville"],
  "dayton|Portland, OR": [39.7589, -84.1916, 12, "Dayton"],
  "decatur, georgia|Atlanta, GA": [33.7748, -84.2963, 4, "Decatur"],
  "decatur,ga|Atlanta, GA": [33.7748, -84.2963, 4, "Decatur"],
  "decatur|Atlanta, GA": [33.7748, -84.2963, 4, "Decatur"],
  "dekalb|Atlanta, GA": [33.7576, -84.2187, 12, "DeKalb County"],
  "denton tx(moving to richardson soon)|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "denton, tx|Dallas, TX": [33.215, -97.133, 6, "Denton"],
  "denton|Dallas, TX": [33.215, -97.133, 6, "Denton"],
  "denton|Fort Worth, TX": [33.215, -97.133, 6, "Denton"],
  "desoto|Dallas, TX": [32.5898, -96.857, 5, "DeSoto"],
  "dfw/north dallas|Dallas, TX": [32.9067, -96.797, 10, "North Dallas"],
  "dickinson|Houston, TX": [29.4608, -95.0513, 5, "Dickinson"],
  "douglasville, ga|Atlanta, GA": [33.7515, -84.7477, 5, "Douglasville"],
  "downtown columbus|Columbus, OH": [39.9612, -82.9988, 5, "Downtown Columbus"],
  "downtown east of i-35, between holly and 12th st|Austin, TX": [30.2672, -97.5831, 10, "East Austin"],
  "downtown portland|Portland, OR": [45.5152, -122.6784, 5, "Downtown Portland"],
  "downtown|Dallas, TX": [32.7767, -96.797, 5, "Downtown Dallas"],
  "downtown|Houston, TX": [29.7604, -95.3698, 5, "Downtown Houston"],
  "downtown|Jacksonville, FL": [30.3322, -81.6557, 5, "Downtown Jacksonville"],
  "dripping springs|Austin, TX": [30.1902, -98.0867, 5, "Dripping Springs"],
  "duluth, ga|Atlanta, GA": [34.0029, -84.1446, 4, "Duluth"],
  "duluth, georgia|Atlanta, GA": [34.0029, -84.1446, 4, "Duluth"],
  "duluth|Atlanta, GA": [34.0029, -84.1446, 4, "Duluth"],
  "duncanville tx|Dallas, TX": [32.6518, -96.9083, 5, "Duncanville"],
  "durham, north carolina|Raleigh, NC": [35.9967, -78.9018, 6, "Durham"],
  "durham|Raleigh, NC": [35.9967, -78.9018, 6, "Durham"],
  "east austin|Austin, TX": [30.2745, -97.7165, 2.5, "East Austin"],
  "east charlotte|Charlotte, NC": [35.2271, -80.6831, 10, "East Charlotte"],
  "east side|Austin, TX": [30.2672, -97.5831, 10, "East Austin"],
  "eastgate|Cincinnati, OH": [39.0172, -84.2023, 2.5, "Eastgate Village"],
  "energy corridor|Houston, TX": [29.7849, -95.6174, 3.5, "Energy Corridor"],
  "eugene|Portland, OR": [44.0505, -123.0951, 6, "Eugene"],
  "euless, texas|Fort Worth, TX": [32.8371, -97.082, 5, "Euless"],
  "euless|Dallas, TX": [32.8371, -97.082, 5, "Euless"],
  "euless|Fort Worth, TX": [32.8371, -97.082, 5, "Euless"],
  "fairburn, ga|Atlanta, GA": [33.5671, -84.581, 5, "Fairburn"],
  "fayetteville nc|Fayetteville, NC": [35.0527, -78.8784, 12, "Fayetteville"],
  "fayetteville|Fayetteville, NC": [35.0527, -78.8784, 12, "Fayetteville"],
  "flower mound|Fort Worth, TX": [33.0284, -97.0867, 5, "Flower Mound"],
  "flowery branch|Atlanta, GA": [34.1851, -83.9252, 4, "Flowery Branch"],
  "forest hill|Fort Worth, TX": [32.6721, -97.2692, 5, "Forest Hill"],
  "forney|Dallas, TX": [32.7479, -96.4719, 5, "Forney"],
  "fort worth texas|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "fort worth, tx|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "fort worth|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "four oaks|Raleigh, NC": [35.4456, -78.4295, 3.5, "Four Oaks"],
  "friendswood, tx, 77546|Houston, TX": [29.5294, -95.201, 5, "Friendswood"],
  "frisco/mckinney|Dallas, TX": [33.1506, -96.8238, 6, "Frisco"],
  "frisco|Dallas, TX": [33.1506, -96.8238, 6, "Frisco"],
  "fulton (fairburn)|Atlanta, GA": [34.0581, -84.2962, 12, "Fulton County"],
  "fulton county|Atlanta, GA": [34.0581, -84.2962, 12, "Fulton County"],
  "fuquay-varina, nc|Raleigh, NC": [35.5844, -78.7999, 6, "Fuquay-Varina"],
  "galleria|Houston, TX": [29.7348, -95.4882, 2.5, "Tiffany's at the Galleria"],
  "garland tx|Dallas, TX": [32.9126, -96.6389, 6, "Garland"],
  "garland, tx|Dallas, TX": [32.9126, -96.6389, 6, "Garland"],
  "garland|Dallas, TX": [32.9126, -96.6389, 6, "Garland"],
  "gastonia|Charlotte, NC": [35.2623, -81.1838, 6, "Gastonia"],
  "goldsboro|Raleigh, NC": [35.3849, -77.9928, 6, "Goldsboro"],
  "grand prairie|Dallas, TX": [32.746, -96.9978, 6, "Grand Prairie"],
  "grayson|Atlanta, GA": [33.8943, -83.9557, 3.5, "Grayson"],
  "greenville ecu district|Greenville, NC": [35.6127, -77.3664, 12, "Greenville"],
  "greenville sc|Jacksonville, FL": [35.6127, -77.3664, 12, "Greenville"],
  "greenville, nc|Greenville, NC": [35.6127, -77.3664, 12, "Greenville"],
  "greenville|Greenville, NC": [35.6127, -77.3664, 12, "Greenville"],
  "gresham or|Portland, OR": [45.4979, -122.433, 6, "Gresham"],
  "gresham/ portland|Portland, OR": [45.4979, -122.433, 6, "Gresham"],
  "haltom city|Fort Worth, TX": [32.7996, -97.2692, 5, "Haltom City"],
  "happy valley|Portland, OR": [45.4287, -122.4972, 5, "Happy Valley"],
  "harris county (greenspoint)|Houston, TX": [29.812, -95.3741, 12, "Harris County"],
  "harris county|Houston, TX": [29.812, -95.3741, 12, "Harris County"],
  "harrisburg/albemarle rd|Charlotte, NC": [35.3258, -80.6455, 5, "Harrisburg"],
  "heights|Houston, TX": [29.3888, -94.9305, 3, "Heights"],
  "highway 6/mission bend area|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "hillsboro|Portland, OR": [45.5229, -122.9898, 6, "Hillsboro"],
  "hobby area|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "hollywood park/ live oak|San Antonio, TX": [29.6005, -98.4872, 3.5, "Hollywood Park"],
  "home: conyers, ga —> school: atlanta, ga|Atlanta, GA": [33.6676, -84.0177, 5, "Conyers"],
  "homestead/north houston|Houston, TX": [29.8904, -95.3698, 10, "North Houston"],
  "hope mills, nc|Fayetteville, NC": [34.9704, -78.9453, 5, "Hope Mills"],
  "houston 77038|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston heights|Houston, TX": [29.7977, -95.3984, 3.5, "Houston Heights"],
  "houston med-center district|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "houston tx (77082)|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston tx|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "houston, close to sugarland on highway 6|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston, texas|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "houston, tx in between downtown and pasadena|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston, tx, 77054|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston/ clear lake|Houston, TX": [29.7589, -95.3677, 12, "Houston"],
  "houston|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "hulen area|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "hulen|Fort Worth, TX": [32.6259, -97.3984, 2.5, "Hulen Heights"],
  "humble|Houston, TX": [29.9988, -95.2622, 5, "Humble"],
  "huntersville|Charlotte, NC": [35.4108, -80.8429, 6, "Huntersville"],
  "huntsville tx|Houston, TX": [30.7235, -95.5508, 5, "Huntsville"],
  "hutto|Austin, TX": [30.5428, -97.5469, 5, "Hutto"],
  "i am located in vancouver, washington. the job was for an la fitness in the area|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "i am moving to the vancouver, wa area|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "i between crowley and forest hill|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "i have not found housing just yet but am in portland|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "i live between windcrest, converse, and kirby...but im can do 15 miles around the area as well|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "irving texas|Dallas, TX": [32.8295, -96.9442, 6, "Irving"],
  "irving, tx|Dallas, TX": [32.8295, -96.9442, 6, "Irving"],
  "irving|Dallas, TX": [32.8295, -96.9442, 6, "Irving"],
  "jacksonville, fl. my area was not listed above but i had to select one in order to continue. i am in jacksonville, fl|Dallas, TX": [30.3322, -81.6557, 12, "Jacksonville"],
  "jacksonville, fl|Atlanta, GA": [30.3322, -81.6557, 12, "Jacksonville"],
  "jacksonville, orange park|Atlanta, GA": [30.3322, -81.6557, 12, "Jacksonville"],
  "jacksonville|Atlanta, GA": [30.3322, -81.6557, 12, "Jacksonville"],
  "jacksonville|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "jersey village harris county|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "jersey village|Houston, TX": [29.8886, -95.5699, 5, "Jersey Village"],
  "johns creek|Atlanta, GA": [34.0289, -84.1986, 4.5, "Johns Creek"],
  "jonesboro, ga|Atlanta, GA": [33.5215, -84.3538, 4, "Jonesboro"],
  "jonesboro|Atlanta, GA": [33.5215, -84.3538, 4, "Jonesboro"],
  "katy/fulshear, tx. ~25 minutes from houston via i-10|Houston, TX": [29.7858, -95.8244, 5, "Katy"],
  "katy|Houston, TX": [29.7858, -95.8244, 5, "Katy"],
  "kaufman, tx|Dallas, TX": [32.5868, -96.3087, 5, "Kaufman"],
  "keller/ southlake|Fort Worth, TX": [32.93, -97.2271, 5, "Keller"],
  "kennesaw georgia|Atlanta, GA": [34.0234, -84.6155, 5, "Kennesaw"],
  "kenton|Portland, OR": [45.5831, -122.6931, 3.5, "Kenton"],
  "kinston, nc|Greenville, NC": [35.2627, -77.5816, 6, "Kinston"],
  "kirby|San Antonio, TX": [29.4613, -98.3858, 3.5, "Kirby"],
  "lake creek of austin, tx|Austin, TX": [30.2672, -97.7431, 12, "Austin"],
  "lake highlands|Dallas, TX": [32.8863, -96.7306, 3, "Lake Highlands"],
  "lakeway|Austin, TX": [30.3645, -97.9875, 5, "Lakeway"],
  "las colinas|Dallas, TX": [32.8907, -96.9619, 3.5, "Las Colinas"],
  "lawerenceville|Atlanta, GA": [33.9562, -83.988, 5, "Lawrenceville"],
  "lawrenceville, ga|Atlanta, GA": [33.9562, -83.988, 5, "Lawrenceville"],
  "lawrenceville|Atlanta, GA": [33.9562, -83.988, 5, "Lawrenceville"],
  "league city|Houston, TX": [29.5075, -95.0949, 5, "League City"],
  "lebanon|Cincinnati, OH": [39.4353, -84.203, 5, "Lebanon"],
  "lewisville|Dallas, TX": [33.0462, -96.9942, 6, "Lewisville"],
  "little elm , plano , frisco area|Dallas, TX": [33.1626, -96.9375, 5, "Little Elm"],
  "loganville, ga (close to lawrenceville and snellville)|Atlanta, GA": [33.839, -83.9008, 5, "Loganville"],
  "loganville|Atlanta, GA": [33.839, -83.9008, 5, "Loganville"],
  "longview, wa|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "louisville|Houston, TX": [29.7066, -95.5474, 2.5, "SunBlossom Louisville"],
  "lower heights|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "magnolia|Houston, TX": [30.2096, -95.7508, 3.5, "Magnolia"],
  "mandarin|Jacksonville, FL": [30.1508, -81.6474, 3.5, "Mandarin"],
  "manor 78653|Austin, TX": [30.3421, -97.5559, 5, "Manor"],
  "mansfield/ arlington|Fort Worth, TX": [32.5635, -97.142, 5, "Mansfield"],
  "mansfield|Dallas, TX": [32.5635, -97.142, 5, "Mansfield"],
  "manvel/pearland|Houston, TX": [29.4665, -95.3557, 5, "Manvel"],
  "marietta, roswell, sandy springs|Atlanta, GA": [33.9526, -84.5499, 5, "Marietta"],
  "marietta,smyrna and austell|Atlanta, GA": [33.9526, -84.5499, 5, "Marietta"],
  "marietta|Atlanta, GA": [33.9526, -84.5499, 5, "Marietta"],
  "matthews|Charlotte, NC": [35.116, -80.7224, 5, "Matthews"],
  "mcdonough|Atlanta, GA": [33.4473, -84.1469, 5, "McDonough"],
  "mckinney dallas forth worth|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "mckinney texas (north dallas)|Dallas, TX": [32.9067, -96.797, 10, "North Dallas"],
  "mckinney texas and sherman texas|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "mckinney, tx|Dallas, TX": [33.1976, -96.6154, 6, "McKinney"],
  "mckinney|Dallas, TX": [33.1976, -96.6154, 6, "McKinney"],
  "mecklemburg|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "mesquite|Dallas, TX": [32.7666, -96.5995, 6, "Mesquite"],
  "metro atlanta (lawrenceville)|Atlanta, GA": [33.9562, -83.988, 5, "Lawrenceville"],
  "middleburg, orange park area|Jacksonville, FL": [30.0689, -81.8604, 3.5, "Middleburg"],
  "middletown ohio|Dayton, OH": [39.5166, -84.4042, 6, "Middletown"],
  "midtown|Atlanta, GA": [33.784, -84.383, 2.5, "Midtown"],
  "mint hill|Charlotte, NC": [35.1735, -80.657, 5, "Mint Hill"],
  "mission bend - houston|Houston, TX": [29.6939, -95.6651, 3, "Mission Bend"],
  "mission bend|Houston, TX": [29.6939, -95.6651, 3, "Mission Bend"],
  "missouri city sugar land|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "missouri city texas|Houston, TX": [29.6186, -95.5377, 5, "Missouri City"],
  "missouri city|Houston, TX": [29.6186, -95.5377, 5, "Missouri City"],
  "monroe|Charlotte, NC": [34.9854, -80.5495, 6, "Monroe"],
  "mooresville, nc|Charlotte, NC": [35.5849, -80.8101, 5, "Mooresville"],
  "morrow|Atlanta, GA": [33.5832, -84.3394, 4, "Morrow"],
  "n/a|Austin, TX": [30.2672, -97.7431, 12, "Austin"],
  "near pearland. i am 5 minutes from there|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "new braunfels|San Antonio, TX": [29.7028, -98.1257, 6, "New Braunfels"],
  "nortb dallas|Dallas, TX": [32.7767, -96.797, 12, "Dallas"],
  "north austin|Austin, TX": [30.4446, -97.695, 2.5, "Conservatory At North Austin"],
  "north dallas/ uptown|Dallas, TX": [32.9067, -96.797, 10, "North Dallas"],
  "north houston|Houston, TX": [29.9199, -95.5187, 3, "North Houston"],
  "north of atlanta (gwinnett)|Atlanta, GA": [34.02, -84.04, 8, "North Gwinnett"],
  "north richland hills|Fort Worth, TX": [32.8343, -97.2289, 5, "North Richland Hills"],
  "northeast portland|Portland, OR": [45.6452, -122.5184, 10, "Northeast Portland"],
  "northern fayetteville, outside of fort bragg|Fayetteville, NC": [35.0527, -78.8784, 12, "Fayetteville"],
  "northwest & north|Austin, TX": [30.3972, -97.9031, 10, "Northwest Austin"],
  "northwest|Portland, OR": [45.5041, -122.4478, 3.5, "Northwest"],
  "northwest|San Antonio, TX": [27.8285, -97.54, 3.5, "Northwest"],
  "norwood|Charlotte, NC": [35.2196, -80.1189, 3.5, "Norwood"],
  "not currently living in the portland metro area, but living nearby and willing to relocate if necessary|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "nw atlanta|Atlanta, GA": [33.795, -84.455, 5, "NW Atlanta"],
  "oakleaf plantation / orange park area|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "oakwood|Atlanta, GA": [34.2273, -83.8843, 4, "Oakwood"],
  "old town|Portland, OR": [45.5249, -122.6735, 3.5, "Old Town"],
  "orange park|Jacksonville, FL": [30.1655, -81.7016, 3.5, "Orange Park"],
  "pasadena|Houston, TX": [29.6911, -95.2092, 6, "Pasadena"],
  "pearland,tx|Houston, TX": [29.564, -95.2864, 5, "Pearland"],
  "pembroke, nc|Fayetteville, NC": [34.6801, -79.1933, 5, "Pembroke"],
  "pflugerville, texas|Austin, TX": [30.4394, -97.62, 5, "Pflugerville"],
  "pflugerville|Austin, TX": [30.4394, -97.62, 5, "Pflugerville"],
  "plano|Dallas, TX": [33.0137, -96.6925, 6, "Plano"],
  "portland ( pearl district)|Portland, OR": [45.5202, -122.6742, 12, "Portland"],
  "portland oregon|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "portland or|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "portland(city), oregon(state)|Portland, OR": [45.5202, -122.6742, 12, "Portland"],
  "portland, or. (hollywood neighborhood)|Portland, OR": [45.5202, -122.6742, 12, "Portland"],
  "portland, oregon|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "portland,multnomah county|Portland, OR": [45.5202, -122.6742, 12, "Portland"],
  "portland/beaverton oregon|Portland, OR": [45.5202, -122.6742, 12, "Portland"],
  "portland|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "prosper, north of dallas near frisco and mckinney|Dallas, TX": [33.2372, -96.7977, 5, "Prosper"],
  "raeford|Fayetteville, NC": [34.981, -79.2242, 5, "Raeford"],
  "raleigh nc|Raleigh, NC": [35.7796, -78.6382, 12, "Raleigh"],
  "raleigh, nc|Raleigh, NC": [35.7796, -78.6382, 12, "Raleigh"],
  "raleigh|Raleigh, NC": [35.7796, -78.6382, 12, "Raleigh"],
  "rhome|Fort Worth, TX": [33.0535, -97.472, 3.5, "Rhome"],
  "richardson, tx|Dallas, TX": [32.9482, -96.7297, 6, "Richardson"],
  "richardson|Dallas, TX": [32.9482, -96.7297, 6, "Richardson"],
  "richmond, tx|Houston, TX": [29.5822, -95.7608, 5, "Richmond"],
  "richmond/rosenberg/sugarland|Houston, TX": [29.5822, -95.7608, 5, "Richmond"],
  "riverdale|Atlanta, GA": [33.5726, -84.4133, 4, "Riverdale"],
  "rock hill|Charlotte, NC": [35.2271, -80.8431, 12, "Charlotte"],
  "rockwall|Dallas, TX": [32.9312, -96.4597, 5, "Rockwall"],
  "rocky mount, nc|Raleigh, NC": [35.9424, -77.7957, 6, "Rocky Mount"],
  "roswell|Atlanta, GA": [34.0232, -84.3616, 4.5, "Roswell"],
  "round rock|Austin, TX": [30.5086, -97.6788, 6, "Round Rock"],
  "rtp and north hills|Raleigh, NC": [35.9096, -78.6382, 10, "North Raleigh"],
  "sachse|Dallas, TX": [32.9762, -96.5953, 5, "Sachse"],
  "saginaw|Fort Worth, TX": [32.8601, -97.3639, 5, "Saginaw"],
  "saint augustine|Jacksonville, FL": [29.8947, -81.3145, 5, "Saint Augustine"],
  "saint johns|Jacksonville, FL": [29.9032, -81.4145, 12, "Saint Johns County"],
  "salem oregon|Portland, OR": [44.9392, -123.0331, 6, "Salem"],
  "salem|Portland, OR": [44.9392, -123.0331, 6, "Salem"],
  "san antonio (north central)|San Antonio, TX": [29.4246, -98.4951, 12, "San Antonio"],
  "san antonio, bexar county|San Antonio, TX": [29.4246, -98.4951, 12, "San Antonio"],
  "san antonio, tx (near lackland afb area)|San Antonio, TX": [29.4246, -98.4951, 12, "San Antonio"],
  "san antonio, tx 78232|San Antonio, TX": [29.4246, -98.4951, 12, "San Antonio"],
  "san antonio|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "san antonio–dominion area (san antonio, tx)|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "san marcos|Austin, TX": [29.8826, -97.9406, 5, "San Marcos"],
  "san pablo|Jacksonville, FL": [30.2955, -81.4376, 3.5, "San Pablo"],
  "sandy springs|Atlanta, GA": [33.9304, -84.3733, 3.5, "Sandy Springs"],
  "sanford, nc|Fayetteville, NC": [35.4799, -79.1803, 6, "Sanford"],
  "se portland, close to foster powell, milwaukie, and oregon city|Portland, OR": [45.3852, -122.5184, 10, "SE Portland"],
  "se portland|Portland, OR": [45.3852, -122.5184, 10, "SE Portland"],
  "seguin|San Antonio, TX": [29.5688, -97.9647, 5, "Seguin"],
  "se|Portland, OR": [45.3852, -122.5184, 10, "SE Portland"],
  "shelby|Greenville, NC": [35.6127, -77.3664, 12, "Greenville"],
  "south fulton|Atlanta, GA": [33.5903, -84.6712, 5, "South Fulton"],
  "southeast|Portland, OR": [45.3852, -122.5184, 10, "Southeast Portland"],
  "southern columbus|Columbus, OH": [39.9612, -82.9988, 12, "Columbus"],
  "southside jacksonville|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "southside san antonio|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "southside. university / phillips area|Jacksonville, FL": [30.3322, -81.6557, 12, "Jacksonville"],
  "southwest houston, tx|Houston, TX": [29.6304, -95.5298, 10, "Southwest Houston"],
  "spring/ north houston|Houston, TX": [29.8228, -95.5453, 3.5, "Spring Branch North"],
  "spring/thewoodlands/humble|Houston, TX": [30.0796, -95.4188, 5, "Spring"],
  "springfield, or|Portland, OR": [44.0462, -123.022, 6, "Springfield"],
  "spring|Houston, TX": [30.0796, -95.4188, 5, "Spring"],
  "st. johns|Jacksonville, FL": [29.9032, -81.4145, 12, "Saint Johns County"],
  "stockbridge|Atlanta, GA": [33.5443, -84.2338, 5, "Stockbridge"],
  "stone mountain|Atlanta, GA": [33.8082, -84.1702, 4, "Stone Mountain"],
  "stone oak|San Antonio, TX": [29.6494, -98.4513, 3.5, "Stone Oak"],
  "stonemountain|Atlanta, GA": [33.8082, -84.1702, 4, "Stone Mountain"],
  "sugar land tx|Houston, TX": [29.6197, -95.6349, 6, "Sugar Land"],
  "sugar land|Houston, TX": [29.6197, -95.6349, 6, "Sugar Land"],
  "sugarland or mission bend|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "sugarland/richmond|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "the woodlands|Houston, TX": [30.1734, -95.5047, 6, "The Woodlands"],
  "tigard|Portland, OR": [45.4307, -122.7719, 6, "Tigard"],
  "tillamook|Portland, OR": [45.6166, -123.0672, 2.5, "Tillamook Junction"],
  "town|Greenville, NC": [35.6127, -77.3664, 12, "Greenville"],
  "tualatin|Portland, OR": [45.3809, -122.7694, 5, "Tualatin"],
  "tucker|Atlanta, GA": [33.8545, -84.2171, 4, "Tucker"],
  "union city|Atlanta, GA": [33.5871, -84.5424, 5, "Union City"],
  "university city|Charlotte, NC": [35.3171, -80.7529, 3.5, "University City"],
  "university|Charlotte, NC": [36.0374, -79.0356, 3, "University"],
  "uptown richmond bissonet|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
  "vancouver wa|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "vancouver, wa|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "vancouver/camas, wa|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "vancouver|Portland, OR": [45.5152, -122.6784, 12, "Portland"],
  "villa rica|Atlanta, GA": [33.732, -84.9191, 4, "Villa Rica"],
  "von ormy|San Antonio, TX": [29.2869, -98.6482, 3.5, "Von Ormy"],
  "wake forest|Raleigh, NC": [35.9776, -78.5098, 6, "Wake Forest"],
  "watuga area|Fort Worth, TX": [32.7555, -97.3308, 12, "Fort Worth"],
  "waxahachie|Fort Worth, TX": [32.3945, -96.8439, 5, "Waxahachie"],
  "west fort worth|Fort Worth, TX": [32.7555, -97.4908, 10, "West Fort Worth"],
  "west linn|Portland, OR": [45.3657, -122.6123, 5, "West Linn"],
  "west side. i am not familiar with the names of towns and suburbs just yet|Jacksonville, FL": [30.3322, -81.8157, 10, "West Jacksonville"],
  "west side/ 151|San Antonio, TX": [29.4241, -98.6536, 10, "West San Antonio"],
  "west side|San Antonio, TX": [29.4241, -98.6536, 10, "West San Antonio"],
  "westlake (78746)|Austin, TX": [30.3467, -97.8027, 2.5, "Nalle Woods of Westlake"],
  "west|Charlotte, NC": [35.2271, -81.0031, 10, "West Charlotte"],
  "west|San Antonio, TX": [29.4241, -98.6536, 10, "West San Antonio"],
  "willowbrook, or northwest houston|Houston, TX": [29.9608, -95.5436, 3.5, "Willowbrook"],
  "wilsonville|Portland, OR": [45.3099, -122.7682, 5, "Wilsonville"],
  "woodlands|Houston, TX": [30.1734, -95.5047, 6, "The Woodlands"],
  "working on relocating closer to san antonio|San Antonio, TX": [29.4241, -98.4936, 12, "San Antonio"],
  "wylie|Dallas, TX": [33.0152, -96.5388, 5, "Wylie"],
  "zip 77073. well within travelling distance to humble,woodlands and greenspoint|Houston, TX": [29.7604, -95.3698, 12, "Houston"],
};

// Session payroll snapshot (counts only, no names or pay), per club:
// trainers = staff (not terminated) who ran at least one session in the period,
// sessionsPerWeek = all sessions in the period / weeks, maxTrainerLoad = busiest trainer's sessions/week.
const PAYROLL_PERIOD = "Sep 1 – Oct 15, 2026";
const PAYROLL = {
  GRIP: {
    "Alpharetta / Windward": { trainers: 4, sessionsPerWeek: 43.2, maxTrainerLoad: 20.8 },
    "Atlantic Beach": { trainers: 4, sessionsPerWeek: 135.5, maxTrainerLoad: 61.3 },
    "Beavercreek": { trainers: 5, sessionsPerWeek: 145.9, maxTrainerLoad: 58.0 },
    "Beaverton": { trainers: 4, sessionsPerWeek: 119.3, maxTrainerLoad: 59.4 },
    "Buford": { trainers: 5, sessionsPerWeek: 30.2, maxTrainerLoad: 12.3 },
    "Centerville": { trainers: 4, sessionsPerWeek: 126.3, maxTrainerLoad: 78.7 },
    "Columbus-East Broad St": { trainers: 2, sessionsPerWeek: 35.3, maxTrainerLoad: 28.8 },
    "Columbus-Goodale Blvd": { trainers: 4, sessionsPerWeek: 33.1, maxTrainerLoad: 13.7 },
    "Columbus-Graceland Blvd.": { trainers: 4, sessionsPerWeek: 83.1, maxTrainerLoad: 34.4 },
    "Columbus-Old Hamilton Rd": { trainers: 6, sessionsPerWeek: 76.7, maxTrainerLoad: 33.6 },
    "Cumming": { trainers: 1, sessionsPerWeek: 3.7, maxTrainerLoad: 3.7 },
    "Duluth - Peachtree Industrial": { trainers: 2, sessionsPerWeek: 7.0, maxTrainerLoad: 6.4 },
    "Duluth - Pleasant Hill": { trainers: 1, sessionsPerWeek: 0.5, maxTrainerLoad: 0.5 },
    "Gresham": { trainers: 3, sessionsPerWeek: 139.1, maxTrainerLoad: 49.8 },
    "Hazel Dell": { trainers: 7, sessionsPerWeek: 257.3, maxTrainerLoad: 70.2 },
    "Hillsboro": { trainers: 5, sessionsPerWeek: 146.5, maxTrainerLoad: 75.4 },
    "Holcomb @ 400": { trainers: 1, sessionsPerWeek: 6.4, maxTrainerLoad: 6.4 },
    "Johns Creek": { trainers: 4, sessionsPerWeek: 29.7, maxTrainerLoad: 14.6 },
    "Kenwood": { trainers: 5, sessionsPerWeek: 111.7, maxTrainerLoad: 54.0 },
    "Kernan": { trainers: 3, sessionsPerWeek: 78.2, maxTrainerLoad: 51.0 },
    "Lloyd Center": { trainers: 7, sessionsPerWeek: 93.0, maxTrainerLoad: 33.9 },
    "Norcross - Peachtree Corners": { trainers: 3, sessionsPerWeek: 33.0, maxTrainerLoad: 17.1 },
    "Old St. Augustine": { trainers: 5, sessionsPerWeek: 99.1, maxTrainerLoad: 43.1 },
    "Orange Park": { trainers: 2, sessionsPerWeek: 61.4, maxTrainerLoad: 31.0 },
    "Pearl": { trainers: 7, sessionsPerWeek: 173.1, maxTrainerLoad: 48.2 },
    "82nd": { trainers: 3, sessionsPerWeek: 70.2, maxTrainerLoad: 49.2 },
    "Roswell - Hwy 92 / Hardscrabble Road": { trainers: 4, sessionsPerWeek: 14.9, maxTrainerLoad: 8.6 },
    "Sandy Springs": { trainers: 5, sessionsPerWeek: 15.2, maxTrainerLoad: 8.9 },
    "Sugar Hill": { trainers: 3, sessionsPerWeek: 19.0, maxTrainerLoad: 16.5 },
    "Tualtin": { trainers: 6, sessionsPerWeek: 156.6, maxTrainerLoad: 61.6 },
    "Vancouver East": { trainers: 4, sessionsPerWeek: 76.1, maxTrainerLoad: 40.1 },
    "West Chester": { trainers: 4, sessionsPerWeek: 56.9, maxTrainerLoad: 20.1 },
  },
  Elevate: {
    "Allen": { trainers: 2, sessionsPerWeek: 7.9, maxTrainerLoad: 7.6 },
    "Baytown": { trainers: 4, sessionsPerWeek: 16.5, maxTrainerLoad: 4.5 },
    "Bedford": { trainers: 5, sessionsPerWeek: 32.5, maxTrainerLoad: 14.5 },
    "Bissonnet": { trainers: 5, sessionsPerWeek: 47.9, maxTrainerLoad: 23.2 },
    "Blanco West": { trainers: 3, sessionsPerWeek: 44.2, maxTrainerLoad: 17.0 },
    "Carrollton": { trainers: 3, sessionsPerWeek: 67.2, maxTrainerLoad: 39.0 },
    "Champions": { trainers: 8, sessionsPerWeek: 157.7, maxTrainerLoad: 35.6 },
    "Clear Lake": { trainers: 3, sessionsPerWeek: 28.9, maxTrainerLoad: 16.2 },
    "Denton": { trainers: 5, sessionsPerWeek: 53.4, maxTrainerLoad: 27.7 },
    "Eastside": { trainers: 5, sessionsPerWeek: 17.4, maxTrainerLoad: 10.9 },
    "Fayetteville": { trainers: 2, sessionsPerWeek: 49.5, maxTrainerLoad: 24.6 },
    "Federal": { trainers: 3, sessionsPerWeek: 55.4, maxTrainerLoad: 33.0 },
    "Forest Hill": { trainers: 3, sessionsPerWeek: 14.6, maxTrainerLoad: 7.6 },
    "Garland": { trainers: 4, sessionsPerWeek: 15.1, maxTrainerLoad: 10.3 },
    "Grand Prairie": { trainers: 3, sessionsPerWeek: 39.5, maxTrainerLoad: 26.0 },
    "Greenspoint": { trainers: 2, sessionsPerWeek: 4.7, maxTrainerLoad: 3.4 },
    "Greenville": { trainers: 3, sessionsPerWeek: 42.3, maxTrainerLoad: 20.5 },
    "Hulen": { trainers: 7, sessionsPerWeek: 79.8, maxTrainerLoad: 28.5 },
    "Humble": { trainers: 2, sessionsPerWeek: 19.1, maxTrainerLoad: 14.5 },
    "Indian Trail": { trainers: 3, sessionsPerWeek: 13.5, maxTrainerLoad: 5.0 },
    "Irving": { trainers: 7, sessionsPerWeek: 27.5, maxTrainerLoad: 12.4 },
    "Jones Road": { trainers: 1, sessionsPerWeek: 26.1, maxTrainerLoad: 26.1 },
    "Katy": { trainers: 2, sessionsPerWeek: 22.6, maxTrainerLoad: 15.4 },
    "Kietzke": { trainers: 6, sessionsPerWeek: 45.7, maxTrainerLoad: 16.8 },
    "Lake Creek": { trainers: 5, sessionsPerWeek: 105.6, maxTrainerLoad: 40.4 },
    "Lewisville": { trainers: 3, sessionsPerWeek: 10.4, maxTrainerLoad: 5.4 },
    "Mesquite": { trainers: 5, sessionsPerWeek: 54.3, maxTrainerLoad: 50.6 },
    "Mission Bend": { trainers: 2, sessionsPerWeek: 23.8, maxTrainerLoad: 12.1 },
    "Morrow": { trainers: 5, sessionsPerWeek: 22.1, maxTrainerLoad: 10.0 },
    "North Hills": { trainers: 4, sessionsPerWeek: 29.7, maxTrainerLoad: 23.2 },
    "Northlake": { trainers: 1, sessionsPerWeek: 10.4, maxTrainerLoad: 10.3 },
    "Oak Cliff": { trainers: 6, sessionsPerWeek: 26.3, maxTrainerLoad: 10.6 },
    "Park Forest": { trainers: 4, sessionsPerWeek: 60.7, maxTrainerLoad: 40.8 },
    "Pasadena": { trainers: 3, sessionsPerWeek: 13.1, maxTrainerLoad: 7.5 },
    "RTP": { trainers: 1, sessionsPerWeek: 5.1, maxTrainerLoad: 5.1 },
    "South Park Mall": { trainers: 6, sessionsPerWeek: 79.8, maxTrainerLoad: 43.2 },
    "Sparks": { trainers: 9, sessionsPerWeek: 210.6, maxTrainerLoad: 52.7 },
    "Stone Mountain": { trainers: 7, sessionsPerWeek: 54.9, maxTrainerLoad: 31.1 },
    "Sugarland": { trainers: 7, sessionsPerWeek: 43.6, maxTrainerLoad: 15.9 },
    "Tech Ridge": { trainers: 12, sessionsPerWeek: 135.6, maxTrainerLoad: 28.6 },
    "University": { trainers: 5, sessionsPerWeek: 50.2, maxTrainerLoad: 23.2 },
    "Watauga": { trainers: 5, sessionsPerWeek: 61.0, maxTrainerLoad: 21.6 },
    "Westover": { trainers: 10, sessionsPerWeek: 71.9, maxTrainerLoad: 26.8 },
    "Woodlands": { trainers: 4, sessionsPerWeek: 152.0, maxTrainerLoad: 77.6 },
  },
};

// "Likelihood of needing a new trainer" model (see hiringNeed() in app.js). Tune here.
const HIRING = {
  trainerCapacity: 80,      // sessions/week one trainer can carry (40 hrs of 30-min sessions)
  sessionsPerNewClient: 1.5, // sessions/week each net new client adds
  lookbackWeeks: 4,          // window for weekly client growth from the stats sheets
  highUtilization: 0.9,      // High if already this full ...
  highWeeks: 4,              // ... or full within this many weeks
  mediumUtilization: 0.7,    // Medium if this full ...
  mediumWeeks: 10,           // ... or full within this many weeks
};

// Live app-adoption data: one row per trainer, tabs per region. Shared "Anyone with the link"; read-only.
const ADOPTION_SHEET = {
  id: "1sG9Md9EJtQjKARumiLW-Mwi3pBC_ikzG9UbxF95a6gA",
  tabs: [
    { tab: "Dallas FC", brand: "Elevate" },
    { tab: "San Antonio_Austin Fc", brand: "Elevate" },
    { tab: "Houston FC", brand: "Elevate" },
    { tab: "Eastern FC", brand: "Elevate" },
    { tab: "Portland Grip PT", brand: "GRIP" },
    { tab: "Ohio Grip PT", brand: "GRIP" },
    { tab: "Jacksonville GripPT", brand: "GRIP" },
  ],
};
// The adoption sheet's "Club" column is typed by hand; map its spellings (lowercased) to gym names.
const ADOPTION_ALIASES = {
  "watagua": "Watauga", "park forrest": "Park Forest", "carrolton": "Carrollton",
  "spm": "South Park Mall", "blanco": "Blanco West", "champion forest": "Champions",
  "fayettville": "Fayetteville", "north lake": "Northlake", "university place": "University",
  "pearl district": "Pearl", "llyod center": "Lloyd Center", "lloyd": "Lloyd Center",
  "vancouver e": "Vancouver East", "tulutain": "Tualtin", "tualitin": "Tualtin", "tualatin": "Tualtin",
  "se 82nd": "82nd", "portland se 82nd": "82nd", "old st": "Old St. Augustine", "old st augustine": "Old St. Augustine",
  "westchester": "West Chester",
};

// ---------- Trainer stats tab ----------
// Staff lists and unlogged sessions come from the shared "USAPT Data" Drive folder, read into
// drive-data.json by scripts/build_drive_data.py (run by the deploy workflow every 3 hours):
// "Staff List" (one .xls per brand) and "Unlogged Sessions" (payroll "Different Rows"
// comparisons, one per brand per pay period). Club KPIs come live from STATS_SHEETS.
const DRIVE_FOLDER = "1mLoeOAb2twG-9sC97JyXfaTElyjwoPm9";
// Onboarding form responses: everyone listed counts as onboarded; a cert uploaded there counts
// as cert on file. Must be shared "Anyone with the link can view".
const ONBOARDING_SHEET = { id: "1GQIwWuAYPU23wPL6TW3lp5Uv4rPX47bMEhsv5dd1tzw", gid: "830884200" };
// Optional separate cert list (a sheet with a trainer name column). Anyone on it has a cert on file.
const CERT_SHEET = { id: "", gid: "" };

// Staff-list "Employee Type" values that count as trainers: any title with "Trainer" in it
// (personal, hybrid, head, ghost...) except the "Trainer Compliance" login.
const PT_TYPE = /^(?!.*compliance).*trainer/i;
// Club names that are spelled differently in the stats sheets and the staff lists.
const CLUB_ALIASES = { tualtin: "tualatin", pearl: "pearl district", "82nd": "portland se 82nd" };

// Club tags on the Trainer stats tab: billing health below billingWarn (and the red "worse" tag
// below billingBad), trainers not onboarded, and more than unloggedMax unlogged sessions per pay
// period for the whole club.
const CLUB_TAGS = { billingWarn: 94, billingBad: 90, unloggedMax: 10 };

// Shared trainer tracker: the Apps Script web app URL (ends in /exec) from apps-script/README.md.
// Leave blank to keep tracker edits in each person's browser only.
const TRACKER_DB = { url: "https://script.google.com/macros/s/AKfycbzVnvAUwMKs1_iUUPHEFUIVhyx9yAGVxPwKFnbPKxJCbqohSVb6RRME9MZbhw5sk90xqg/exec" };
