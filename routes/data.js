/* RouteReady — seed data
 *
 * UK DVSA practical-test centres with a few practice routes each.
 *
 * Official DVSA test routes have not been published since 2010, so these are
 * realistic practice loops around each test centre. Each route is a list of
 * waypoints; the app asks the OSRM routing engine to snap them to real roads
 * and return road-following geometry + turn-by-turn instructions at runtime.
 * Users can also record and save their own routes (see app.js).
 *
 * Coordinates are [lat, lng].
 */

window.TEST_CENTRES = [
  {
    id: "cardiff-llanishen",
    name: "Cardiff (Llanishen)",
    town: "Cardiff",
    region: "Wales",
    lat: 51.5274, lng: -3.1903,
    routes: [
      {
        id: "cardiff-1", name: "Llanishen Loop A", difficulty: "Easy",
        notes: "Residential streets, one mini-roundabout, a left reverse opportunity.",
        waypoints: [
          [51.5274, -3.1903], [51.5310, -3.1850], [51.5340, -3.1920],
          [51.5300, -3.1990], [51.5250, -3.1960], [51.5274, -3.1903]
        ]
      },
      {
        id: "cardiff-2", name: "Thornhill Hills", difficulty: "Hard",
        notes: "Gradients, a busy roundabout and a dual carriageway merge.",
        waypoints: [
          [51.5274, -3.1903], [51.5390, -3.1800], [51.5450, -3.1900],
          [51.5380, -3.2010], [51.5290, -3.2000], [51.5274, -3.1903]
        ]
      }
    ]
  },
  {
    id: "london-mill-hill",
    name: "Mill Hill (London)",
    town: "London",
    region: "Greater London",
    lat: 51.6155, lng: -0.2433,
    routes: [
      {
        id: "millhill-1", name: "The Ridgeway Circuit", difficulty: "Medium",
        notes: "Mix of A-roads and residential, two roundabouts.",
        waypoints: [
          [51.6155, -0.2433], [51.6200, -0.2350], [51.6230, -0.2470],
          [51.6170, -0.2560], [51.6110, -0.2500], [51.6155, -0.2433]
        ]
      }
    ]
  },
  {
    id: "london-wood-green",
    name: "Wood Green (London)",
    town: "London",
    region: "Greater London",
    lat: 51.5975, lng: -0.1097,
    routes: [
      {
        id: "woodgreen-1", name: "Alexandra Park Run", difficulty: "Hard",
        notes: "Heavy urban traffic, bus lanes, multi-lane junctions.",
        waypoints: [
          [51.5975, -0.1097], [51.6010, -0.1180], [51.5950, -0.1230],
          [51.5900, -0.1140], [51.5930, -0.1040], [51.5975, -0.1097]
        ]
      }
    ]
  },
  {
    id: "manchester-west-didsbury",
    name: "Manchester (West Didsbury)",
    town: "Manchester",
    region: "North West",
    lat: 53.4220, lng: -2.2470,
    routes: [
      {
        id: "manchester-1", name: "Didsbury Village Loop", difficulty: "Medium",
        notes: "Tram crossings, parked-car narrows, a one-way system.",
        waypoints: [
          [53.4220, -2.2470], [53.4270, -2.2380], [53.4300, -2.2480],
          [53.4250, -2.2570], [53.4190, -2.2540], [53.4220, -2.2470]
        ]
      }
    ]
  },
  {
    id: "birmingham-garretts-green",
    name: "Birmingham (Garretts Green)",
    town: "Birmingham",
    region: "West Midlands",
    lat: 52.4700, lng: -1.7880,
    routes: [
      {
        id: "birmingham-1", name: "Garretts Green Industrial", difficulty: "Medium",
        notes: "Wide industrial roads, big roundabouts, good for emergency stop.",
        waypoints: [
          [52.4700, -1.7880], [52.4760, -1.7790], [52.4790, -1.7900],
          [52.4730, -1.8000], [52.4670, -1.7960], [52.4700, -1.7880]
        ]
      }
    ]
  },
  {
    id: "leeds-horsforth",
    name: "Leeds (Horsforth)",
    town: "Leeds",
    region: "Yorkshire",
    lat: 53.8360, lng: -1.6260,
    routes: [
      {
        id: "leeds-1", name: "Horsforth Ring", difficulty: "Easy",
        notes: "Calm suburban roads, ideal first practice route.",
        waypoints: [
          [53.8360, -1.6260], [53.8410, -1.6170], [53.8440, -1.6280],
          [53.8390, -1.6370], [53.8330, -1.6340], [53.8360, -1.6260]
        ]
      }
    ]
  }
];
