# RouteReady — UK Driving Test Routes (free, ad-supported)

A mobile-first PWA that lets learner drivers practise routes around their local
**DVSA test centre** with free voice sat-nav guidance. It's the ad-supported
answer to subscription/paywall apps like Route-Led.

**Live:** https://coin-maker3.github.io/routes/

## How it works

- **Browse test centres** → pick one → see its practice routes.
- **Route preview** draws the road-following route on a map with distance,
  time and manoeuvre count.
- **Start drive** gives turn-by-turn **voice + map** guidance. It uses real GPS
  when you're moving, and auto-**simulates** the drive when you're not (so you
  can review a route from your desk).
- **Record a route** captures your own GPS track and saves it on-device — this
  is how the route library grows (official DVSA routes haven't been published
  since 2010).

## Tech (all free, no API keys)

| Concern        | Choice                                                        |
|----------------|--------------------------------------------------------------|
| Map + tiles    | Leaflet + OpenStreetMap                                       |
| Routing + steps| OSRM public demo server (`router.project-osrm.org`)          |
| Voice          | Web Speech API (`speechSynthesis`)                            |
| Location       | `navigator.geolocation.watchPosition`                        |
| Offline/install| Service worker + web manifest (installable PWA)              |
| Storage        | `localStorage` (recorded routes + route cache)               |

## Monetisation — ads, not subscriptions

Google AdSense is wired to publisher `ca-pub-2025557203901587` (the ID already
in this repo's `app-ads.txt`). Ad units appear **only** on the browse, route-list
and post-drive summary screens — **never during live navigation**, which is both
an AdSense policy requirement and a driver-safety must.

### To go live with real ads
1. In the AdSense console, create display ad units and replace each
   `data-ad-slot="0000000000"` in `index.html` with the real slot ID.
2. Until then the slots render as labelled placeholders.

## Known limitations / next steps

- OSRM's public demo server is rate-limited and not for production load — swap
  for a self-hosted OSRM or a paid routing API before scaling.
- Seed routes are realistic practice loops, not the (unpublished) official DVSA
  routes. Real coverage comes from user recordings + curation.
- Recorded routes are device-local; a backend would let users share routes and
  build per-centre libraries.
- For a Play Store presence, wrap this PWA (e.g. Bubblewrap/TWA) and switch to
  AdMob.
