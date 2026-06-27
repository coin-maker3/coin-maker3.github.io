/* RouteReady — curated in-app routes per centre.
 * waypoints are road names; the app geocodes them near the centre and snaps
 * to roads with OSRM at runtime (cached). Add more centres as keys over time. */
window.CURATED = {
  "nuneaton": [
    {
      "id": "nuneaton-1",
      "name": "Route 1 — The A444 / St Davids Way Loop",
      "blurb": "Multi-lane roundabout discipline on fast-feeling connector roads.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Earls Road",
        "Queens Road",
        "Roanne Ringway",
        "College Street",
        "Coventry Road",
        "St Davids Way",
        "Walsingham Drive",
        "Sutherland Drive"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd",
        "Left at Manor Court Rd roundabout onto Queens Rd",
        "Right onto Roanne Ringway (traffic lights)",
        "Right at Coton Rd, Right at Shepperton Hill, Left at College St roundabouts",
        "Right onto Coventry Rd",
        "Ahead at mini-roundabout, then Right at St Davids Way roundabout",
        "Left onto Walsingham Drive, Right onto A444, Left onto Sutherland Drive",
        "Return to Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-2",
      "name": "Route 2 — The Town Centre One-Way System",
      "blurb": "Nuneaton one-way traffic system and tight residential loops.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Croft Road",
        "Merevale Avenue",
        "Heath End Road",
        "Coventry Road",
        "Avenue Road",
        "Church Street",
        "Newtown Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd",
        "Ahead at Manor Court Rd onto Croft Rd",
        "Estate loop: Left Merevale Ave, Left Bentley Rd, Right Merevale Rd, Left Croft Rd",
        "Left at The Raywoods, Left onto Orkney Close, Left onto Heath End Rd",
        "Right at Bullring mini-roundabout into College Rd, Right at A444 (2nd exit)",
        "Ahead at mini-roundabout onto Coventry Rd, Right onto Avenue Rd",
        "Left at Highfield Rd into Attleborough Rd into Church St",
        "Return via one-way system (Bond Gate, Bond St, Newtown Rd) to Roanne Ringway, then Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-3",
      "name": "Route 3 — The Gipsy Lane / Marston Lane Loop",
      "blurb": "East Nuneaton — major roundabouts plus quieter residential streets.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Croft Road",
        "College Street",
        "St Davids Way",
        "Coventry Road",
        "Gipsy Lane",
        "Marston Lane",
        "Northbourne Drive"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd",
        "Ahead at Manor Court Rd, Left onto Croft Rd",
        "Left at Greenmoor Rd roundabout into Bullring, Right at College St roundabout",
        "Right at A444 (2nd roundabout), Left at St Davids Way, Right at Walsingham Drive, Left back onto A444",
        "Left onto Sutherland Drive, Right onto Nuneaton Rd/Coventry Rd",
        "Left at Gipsy Lane roundabout, Right onto Marston Lane, Right onto Northbourne Drive, Right at mini-roundabout onto Marston Lane",
        "Return to Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-4",
      "name": "Route 4 — The Weddington & Higham Lane Sweep",
      "blurb": "North Nuneaton — clearance control through older residential estates.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Midland Road",
        "Tuttle Hill",
        "Mancetter Road",
        "Weddington Road",
        "Shanklin Drive",
        "Leicester Road",
        "Newtown Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd, Left at Manor Court Rd",
        "Left at Midland Rd (traffic lights), Ahead onto Tuttle Hill, Right onto Mancetter Rd",
        "Estate loop: Left Berrington Rd, Left back onto Mancetter Rd, Left Weddington Rd, Left Bramdene Ave, Left Weddington Rd, Right Kingsbridge Rd, Left Shanklin Drive",
        "Return: Right onto Old Hinckley Rd, Right at Leicester Rd lights, Right at Bond Gate, Left at Bond St, ahead through Newtown Rd roundabouts to Roanne Ringway"
      ]
    },
    {
      "id": "nuneaton-5",
      "name": "Route 5 — Eastboro Way",
      "blurb": "Fast-flowing route to the outskirts toward Hinckley.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "St Nicolas Park Drive",
        "Coniston Way",
        "Wallingford Avenue",
        "Hinckley Road",
        "Eastboro Way",
        "Avenue Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd",
        "East Nuneaton estate: Left St Nicholas Park Drive, Left Coniston Way, Left Pallett Drive, Right Wallingford Ave, Right Milby Drive, Left Pallett Drive, Left St Nicolas Park Drive",
        "Right at Hinckley Rd roundabout onto Eastboro Way",
        "Flows down Eastboro Way toward Avenue Rd and back via Roanne Ringway"
      ]
    },
    {
      "id": "nuneaton-6",
      "name": "Route 6 — The Heath End Road & Arbury Focus",
      "blurb": "Meeting traffic in narrow spaces; closely-spaced mini-roundabouts.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Queens Road",
        "Tomkinson Road",
        "Haunchwood Road",
        "Westbury Road",
        "Arbury Road",
        "Heath End Road",
        "Radnor Drive",
        "Dorlecote Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd",
        "Ahead at Manor Court Rd mini-roundabout onto Queens Rd, Right onto Tomkinson Rd, Ahead into Haunchwood Rd",
        "Left onto Westbury Rd, Right at Arbury Rd mini-roundabout, Right onto Heath End Rd",
        "Estate loop: Right Radnor Drive, Left at end, Right at end, Right Charnwood Ave, Right Atholl Crescent, Right at end",
        "Right at Heath End Rd mini-roundabout, Right at Bull Ring/College St, Right at A444 (2nd exit)",
        "Right at B4113 Coventry Rd mini-roundabout, Right onto Donnithorne Ave, Right onto Dorlecote Rd",
        "Return to Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-7",
      "name": "Route 7 — Town Centre & St Nicolas Park",
      "blurb": "High-traffic town-centre driving mixed with quiet suburban navigation.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Queens Road",
        "Roanne Ringway",
        "Leicester Road",
        "Weddington Road",
        "Higham Lane",
        "St Nicolas Park Drive",
        "Hinckley Road",
        "Avenue Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd, Left at Manor Court Rd roundabout onto Queens Rd",
        "Right onto Roanne Ringway, Ahead at Vicarage St roundabout, Right at Back St lights",
        "Follow Bond St/Regent St round into Leicester Rd",
        "Right after bridge onto Weddington Rd, Left at Shanklin Drive/Brookdale Rd mini-roundabout, Right at Higham Lane mini-roundabout",
        "Return: Right onto St Nicolas Park Drive, Left Windermere Ave, Left St Nicolas Park Rd, Right at Hinckley Rd roundabout onto Eastboro Way, Left onto Avenue Rd"
      ]
    },
    {
      "id": "nuneaton-8",
      "name": "Route 8 — Sutherland Drive Variation",
      "blurb": "Like Route 1, but loops back tightly through Reynolds Road.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Croft Road",
        "Greenmoor Road",
        "College Street",
        "St Davids Way",
        "Walsingham Drive",
        "Sutherland Drive",
        "Reynolds Road"
      ],
      "steps": [
        "Left onto Beaumont Rd, Right onto Countess Rd, Right onto Earls Rd, Ahead at Manor Court Rd roundabout onto Croft Rd",
        "Left onto Greenmoor Rd, Left at Greenmoor Rd roundabout into Bullring",
        "Right at College St roundabout, Right at 2nd A444 roundabout, Left at St Davids Way, Right at Walsingham Drive",
        "Left onto A444, 1st Left onto Sutherland Drive, 2nd Left onto Reynolds Rd, Left onto Sutherland Drive",
        "Return to Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-9",
      "name": "Route 9 — The Variation Loop",
      "blurb": "Transitions: tight Camp Hill/Stockingford residential streets → A444 → town centre.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Barpool Road",
        "Tomkinson Road",
        "Northumberland Avenue",
        "Croft Road",
        "Heath End Road",
        "College Street",
        "Coventry Road",
        "St Davids Way",
        "Walsingham Drive",
        "Coton Road"
      ],
      "steps": [
        "Left Beaumont Rd, Left Barpool Rd, Right Tomkinson Rd, Left Northumberland Ave, Left Rutland Ave, Left Northumberland Ave, Left Croft Rd",
        "Mini-roundabout Right onto The Raywoods, Right Brodrick Way, Left Fair Isle Drive, Left Oldany Way, Right The Raywoods",
        "Left onto Heath End Rd, Right onto Bullring/College St, Ahead onto College St, Right onto Coventry Rd",
        "2nd roundabout Right onto St Davids Way, Left Walsingham Drive, Left onto A444, Left onto A444 (Nuneaton direction), Ahead at 2nd roundabout onto Chilvers Rise (A444)",
        "Town centre: Ahead onto Coton Rd, Right onto Vicarage St, Left onto Church St, follow one-way via Bond St to Newtown Rd",
        "Return: Ahead at 2nd roundabout onto Roanne Ringway, Right onto Queens Rd, Right onto Beaumont Rd back to Vernons Lane"
      ]
    },
    {
      "id": "nuneaton-10",
      "name": "Route 10 — The Northern / Higham Lane Variation",
      "blurb": "North Nuneaton flow — Weddington and St Nicolas Park areas, lots of speed-limit transitions.",
      "difficulty": "Test route",
      "waypoints": [
        "Beaumont Road",
        "Midland Road",
        "Tuttle Hill",
        "Mancetter Road",
        "Weddington Road",
        "Shanklin Drive",
        "Higham Lane",
        "St Nicolas Park Drive",
        "Hinckley Road",
        "Eastboro Way",
        "Avenue Road"
      ],
      "steps": [
        "Left Beaumont Rd, Right Countess Rd, Right Earls Rd, Left Manor Court Rd, Left Midland Rd (traffic lights)",
        "Ahead Tuttle Hill, Right Mancetter Rd, Left Berrington Rd, Left Mancetter Rd, Left Weddington Rd",
        "Right onto Kingsbridge Rd, Left Shanklin Drive, Ahead Brookdale Rd, Right onto Higham Lane",
        "Right St Nicolas Park Drive, Left Windermere Ave, Ahead, Right at end onto St Nicolas Park Rd, Left onto Hinckley Rd",
        "Right onto Eastboro Way, Ahead through 3rd roundabout onto Avenue Rd, Left onto Caldwell Rd, Left onto Avenue Rd",
        "Final stretch: Right onto Coton Rd, Left onto Vicarage St, Right onto Church St, Right at Bond Gate lights, Left onto Bond St, ahead through Newtown Rd roundabouts, Right onto Roanne Ringway",
        "Finish: Left onto Queens Rd, mini-roundabout right onto Beaumont Rd, back to Vernons Lane"
      ]
    }
  ]
};
