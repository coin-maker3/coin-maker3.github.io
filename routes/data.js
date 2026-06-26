/* RouteReady — UK DVSA test centres
 *
 * Just the centre locations. Practice routes are GENERATED at runtime as loops
 * on the real public road network around each centre (see generateRoutes() in
 * app.js) — no proprietary/examiner route data is used or needed. Since the
 * 2010 "independent driving" change, examiners vary the route around the
 * centre, so practising the local road network is the right preparation.
 *
 * Coordinates are approximate (town/area level) and should be replaced with the
 * official DVSA centre list before launch. [lat, lng]
 */

window.TEST_CENTRES = [
  { id: "cardiff-llanishen",      name: "Cardiff (Llanishen)",        town: "Cardiff",     region: "Wales",          lat: 51.5274, lng: -3.1903 },
  { id: "newport",                name: "Newport",                    town: "Newport",     region: "Wales",          lat: 51.5842, lng: -2.9977 },
  { id: "london-mill-hill",       name: "Mill Hill (London)",         town: "London",      region: "Greater London", lat: 51.6155, lng: -0.2433 },
  { id: "london-wood-green",      name: "Wood Green (London)",        town: "London",      region: "Greater London", lat: 51.5975, lng: -0.1097 },
  { id: "london-hither-green",    name: "Hither Green (London)",      town: "London",      region: "Greater London", lat: 51.4520, lng: -0.0040 },
  { id: "manchester-w-didsbury",  name: "Manchester (West Didsbury)", town: "Manchester",  region: "North West",     lat: 53.4220, lng: -2.2470 },
  { id: "manchester-cheetham",    name: "Manchester (Cheetham Hill)", town: "Manchester",  region: "North West",     lat: 53.5060, lng: -2.2360 },
  { id: "birmingham-garretts",    name: "Birmingham (Garretts Green)",town: "Birmingham",  region: "West Midlands",  lat: 52.4700, lng: -1.7880 },
  { id: "birmingham-kingstanding",name: "Birmingham (Kingstanding)",  town: "Birmingham",  region: "West Midlands",  lat: 52.5430, lng: -1.8870 },
  { id: "nuneaton",               name: "Nuneaton",                   town: "Nuneaton",    region: "Warwickshire",   lat: 52.5250, lng: -1.4960 },
  { id: "leeds-horsforth",        name: "Leeds (Horsforth)",          town: "Leeds",       region: "Yorkshire",      lat: 53.8360, lng: -1.6260 },
  { id: "bristol-brislington",    name: "Bristol (Brislington)",      town: "Bristol",     region: "South West",     lat: 51.4390, lng: -2.5470 },
  { id: "glasgow-anniesland",     name: "Glasgow (Anniesland)",       town: "Glasgow",     region: "Scotland",       lat: 55.8870, lng: -4.3170 },
  { id: "edinburgh-currie",       name: "Edinburgh (Currie)",         town: "Edinburgh",   region: "Scotland",       lat: 55.8970, lng: -3.3160 },
  { id: "liverpool-speke",        name: "Liverpool (Speke)",          town: "Liverpool",   region: "North West",     lat: 53.3500, lng: -2.8580 },
  { id: "nottingham-colwick",     name: "Nottingham (Colwick)",       town: "Nottingham",  region: "East Midlands",  lat: 52.9500, lng: -1.0760 },
  { id: "sheffield-handsworth",   name: "Sheffield (Handsworth)",     town: "Sheffield",   region: "Yorkshire",      lat: 53.3760, lng: -1.3870 }
];
