/* RouteReady — UK driving test route practice (free, ad-supported PWA) */
(function () {
  "use strict";

  const OSRM = "https://router.project-osrm.org/route/v1/driving/";
  const TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTR = '&copy; OpenStreetMap contributors';

  const $ = (id) => document.getElementById(id);
  const screens = ["home", "routes", "map", "nav", "summary", "record"];
  const history = [];

  let activeCentre = null;
  let activeRoute = null;      // {name, geometry:[[lat,lng]], steps:[...], distance, duration, notes}
  let muted = false;
  let userLoc = null;          // [lat, lng] once we know where the user is

  /* ───────────────────────── screen router ───────────────────────── */
  function show(name, push = true) {
    screens.forEach((s) => { $("screen-" + s).hidden = s !== name; });
    if (push && history[history.length - 1] !== name) history.push(name);
    $("backBtn").hidden = history.length <= 1;
    window.scrollTo(0, 0);
  }
  function back() {
    history.pop();
    const prev = history[history.length - 1] || "home";
    // leaving a live screen? stop its sensors
    stopNav(true); stopRecording(true);
    show(prev, false);
  }
  $("backBtn").addEventListener("click", back);

  /* ───────────────────────── toast ───────────────────────── */
  let toastT;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ───────────────────────── ads ───────────────────────── */
  function renderAds() {
    document.querySelectorAll(".ad-slot ins.adsbygoogle").forEach((ins) => {
      if (ins.dataset.filled) return;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); ins.dataset.filled = "1"; }
      catch (e) { /* AdSense not approved yet — slot stays as a placeholder */ }
    });
  }

  /* ───────────────────────── geo helpers ───────────────────────── */
  function haversine(a, b) {
    const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const fmtKm = (m) => (m / 1000).toFixed(1) + " km";
  const fmtMin = (s) => Math.max(1, Math.round(s / 60)) + " min";

  /* ───────────────────────── OSRM routing ───────────────────────── */
  async function fetchRoute(waypoints) {
    const cacheKey = "rr_route_" + waypoints.map((w) => w.join(",")).join(";");
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `${OSRM}${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("routing failed");
    const json = await res.json();
    if (!json.routes || !json.routes.length) throw new Error("no route");
    const r = json.routes[0];

    const out = {
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance: r.distance,
      duration: r.duration,
      steps: []
    };
    r.legs.forEach((leg) => {
      leg.steps.forEach((st) => {
        const [lng, lat] = st.maneuver.location;
        out.steps.push({
          loc: [lat, lng],
          text: instructionText(st.maneuver, st.name),
          dist: st.distance
        });
      });
    });
    try { localStorage.setItem(cacheKey, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function instructionText(m, road) {
    const where = road ? ` onto ${road}` : "";
    const dir = m.modifier ? m.modifier.replace("slight ", "slight ").replace("sharp ", "sharp ") : "";
    switch (m.type) {
      case "depart": return "Start the route" + (road ? ` on ${road}` : "");
      case "arrive": return "You have arrived back at the test centre";
      case "turn": return `Turn ${dir}${where}`;
      case "new name": return `Continue${where}`;
      case "merge": return `Merge ${dir}${where}`;
      case "on ramp": return `Take the slip road ${dir}`;
      case "off ramp": return `Take the exit ${dir}`;
      case "fork": return `Keep ${dir}${where}`;
      case "end of road": return `Turn ${dir}${where}`;
      case "continue": return `Continue ${dir}`.trim() + where;
      case "roundabout":
      case "rotary":
        return `At the roundabout, take exit ${m.exit || ""}`.trim() + where;
      default: return `Continue${where}`;
    }
  }

  /* ───────────────────────── HOME: find nearest centres ───────────────────────── */
  const miles = (m) => (m / 1609.34).toFixed(1) + " mi";

  // Geocode an address/postcode via the free OpenStreetMap Nominatim service.
  // (Fine for low traffic; self-host or use a paid geocoder before scaling.)
  async function geocode(query) {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q="
      + encodeURIComponent(query);
    const res = await fetch(url, { headers: { "Accept-Language": "en-GB" } });
    if (!res.ok) throw new Error("geocode failed");
    const j = await res.json();
    if (!j.length) throw new Error("not found");
    return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
  }

  function nearestCentres() {
    let centres = TEST_CENTRES.slice();
    if (userLoc) {
      centres.forEach((c) => (c._dist = haversine(userLoc, [c.lat, c.lng])));
      centres.sort((a, b) => a._dist - b._dist);
      centres = centres.slice(0, 8); // nearest 8
    }
    return centres;
  }

  function renderCentres() {
    const centres = nearestCentres();
    const list = $("centreList"); list.innerHTML = "";
    centres.forEach((c) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<div class="c-main">
          <div class="c-title">${c.name}</div>
          <div class="c-sub">${c.town} · ${c.region}</div>
        </div>${userLoc ? `<span class="dist-badge">${miles(c._dist)}</span>` : `<div class="chev">›</div>`}`;
      el.addEventListener("click", () => openCentre(c));
      list.appendChild(el);
    });
    renderHomeMap(centres);
  }

  /* ───────────── home overview map with a pin per centre ───────────── */
  let homeMap, homeLayer;
  function renderHomeMap(centres) {
    if (typeof L === "undefined") return; // Leaflet CDN unavailable — list still works
    if (!homeMap) {
      homeMap = L.map("homeMap", { zoomControl: true, attributionControl: false });
      L.tileLayer(TILE, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(homeMap);
      homeMap.setView([54.0, -2.4], 5); // UK overview until we know the user
    }
    setTimeout(() => homeMap.invalidateSize(), 60);
    if (homeLayer) homeMap.removeLayer(homeLayer);

    const markers = [];
    centres.forEach((c) => {
      const icon = L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 24],
        html: `<div class="centre-pin"><span>P</span></div>` });
      const m = L.marker([c.lat, c.lng], { icon }).bindTooltip(c.name);
      m.on("click", () => openCentre(c));
      markers.push(m);
    });
    if (userLoc) {
      const you = L.marker(userLoc, {
        icon: L.divIcon({ className: "", iconSize: [18, 18], html: '<div class="user-dot"></div>' })
      }).bindTooltip("You");
      markers.push(you);
    }
    homeLayer = L.layerGroup(markers).addTo(homeMap);

    const pts = centres.map((c) => [c.lat, c.lng]);
    if (userLoc) pts.push(userLoc);
    if (pts.length) homeMap.fitBounds(L.latLngBounds(pts).pad(0.25));
  }

  async function findNearest(query) {
    try {
      $("findBtn").textContent = "Finding…"; $("findBtn").disabled = true;
      userLoc = await geocode(query);
      renderCentres();
      toast("Showing your nearest test centres");
    } catch (e) {
      toast("Couldn’t find that address — try a postcode.");
    } finally {
      $("findBtn").textContent = "Find my centres"; $("findBtn").disabled = false;
    }
  }

  $("findBtn").addEventListener("click", () => {
    const q = $("addrInput").value.trim();
    if (q) findNearest(q); else toast("Enter a postcode or address first.");
  });
  $("addrInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("findBtn").click(); });
  $("geoBtn").addEventListener("click", () => {
    if (!("geolocation" in navigator)) { toast("Location not supported."); return; }
    $("geoBtn").textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (p) => { userLoc = [p.coords.latitude, p.coords.longitude]; renderCentres();
               $("geoBtn").textContent = "📍 Use my location"; toast("Showing centres near you"); },
      () => { $("geoBtn").textContent = "📍 Use my location"; toast("Couldn’t get your location."); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  /* ───────────── auto-generate practice routes on roads around a centre ───────────── */
  // Deterministic loops at increasing radius — no proprietary route data involved.
  function loopWaypoints(lat, lng, r, n, seed) {
    const lngScale = 1 / Math.cos((lat * Math.PI) / 180); // keep loops roughly circular on the map
    const pts = [[lat, lng]];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 2 * Math.PI + seed * 0.9;
      const rad = r * (0.65 + 0.35 * ((Math.sin(seed * 3.1 + i * 1.7) + 1) / 2));
      pts.push([lat + rad * Math.cos(ang), lng + rad * Math.sin(ang) * lngScale]);
    }
    pts.push([lat, lng]);
    return pts;
  }
  function generateRoutes(centre) {
    const specs = [
      { name: "Local roads",     difficulty: "Easy",   r: 0.011, n: 5 },
      { name: "Town circuit",    difficulty: "Medium", r: 0.020, n: 6 },
      { name: "Extended route",  difficulty: "Hard",   r: 0.030, n: 7 }
    ];
    return specs.map((s, i) => ({
      id: centre.id + "-gen" + i,
      name: s.name,
      difficulty: s.difficulty,
      notes: `Practice loop on the public roads around ${centre.name}.`,
      waypoints: loopWaypoints(centre.lat, centre.lng, s.r, s.n, i)
    }));
  }

  /* ───────────────────────── ROUTE LIST ───────────────────────── */
  function openCentre(c) {
    activeCentre = c;
    $("centreTitle").textContent = c.name;
    $("centreSub").textContent = `${c.town} · ${c.region}`;
    const list = $("routeList"); list.innerHTML = "";

    const saved = getSavedRoutes(c.id);
    const all = generateRoutes(c).map((r) => ({ ...r, saved: false }))
      .concat(saved.map((r) => ({ ...r, saved: true })));

    all.forEach((r) => list.appendChild(routeCard(c, r)));

    // Community routes (e.g. built from public videos by the extractor tool)
    // load asynchronously and append, clearly badged as unverified.
    getCommunityRoutes(c.id).then((rs) => {
      if ($("centreTitle").textContent !== c.name) return; // user navigated away
      rs.forEach((r) => list.appendChild(routeCard(c, { ...r, community: true })));
    });

    show("routes");
    renderAds();
  }

  function routeCard(c, r) {
    const el = document.createElement("div");
    el.className = "card";
    const badge = r.community ? "Community" : (r.difficulty || (r.saved ? "Saved" : "Easy"));
    const icon = r.community ? "⚠️ " : (r.saved ? "📍 " : "");
    const sub = r.community
      ? "Rebuilt from a video — unverified. Drive with care."
      : (r.notes || "Your recorded route");
    el.innerHTML = `<div class="c-main">
        <div class="c-title">${icon}${r.name}</div>
        <div class="c-sub">${sub}</div>
      </div>
      <span class="pill ${r.community ? "Community" : (r.difficulty || "Easy")}">${badge}</span>`;
    el.addEventListener("click", () => openRoute(c, r));
    return el;
  }

  // fetch + cache the community-route manifest, return routes for this centre
  let communityManifest = null;
  async function getCommunityRoutes(centreId) {
    try {
      if (!communityManifest) {
        const res = await fetch("community/manifest.json", { cache: "no-cache" });
        communityManifest = res.ok ? await res.json() : [];
      }
      const mine = communityManifest.filter((m) => m.centreId === centreId);
      const routes = await Promise.all(mine.map((m) =>
        fetch("community/" + m.file).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      return routes.filter(Boolean);
    } catch (e) { return []; }
  }

  /* ───────────────────────── MAP PREVIEW ───────────────────────── */
  let previewMap;
  async function openRoute(centre, route) {
    show("map");
    $("routeName").textContent = route.name;
    $("routeStats").textContent = "Loading…";
    $("routeNotes").textContent = route.notes || "";

    if (!previewMap) {
      previewMap = L.map("map", { zoomControl: true });
      L.tileLayer(TILE, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(previewMap);
    }
    setTimeout(() => previewMap.invalidateSize(), 60);

    try {
      let data;
      if (route.geometry) {
        // user-recorded route already has geometry
        data = { geometry: route.geometry, steps: route.steps || [], distance: route.distance, duration: route.duration };
      } else {
        data = await fetchRoute(route.waypoints);
      }
      activeRoute = { ...data, name: route.name, notes: route.notes };
      drawRoute(previewMap, data);
      $("routeStats").textContent = `${fmtKm(data.distance)} · ${fmtMin(data.duration)} · ${data.steps.length} steps`;
    } catch (e) {
      $("routeStats").textContent = "Couldn’t load this route — check your connection.";
      toast("Routing service unavailable. Try again.");
    }
  }

  let previewLayer;
  function drawRoute(map, data) {
    if (previewLayer) map.removeLayer(previewLayer);
    const line = L.polyline(data.geometry, { color: "#3da5ff", weight: 5, opacity: .9 });
    const start = L.circleMarker(data.geometry[0], { radius: 8, color: "#27d796", fillOpacity: 1 });
    previewLayer = L.layerGroup([line, start]).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }

  $("startNavBtn").addEventListener("click", () => startNav());

  /* ───────────────────────── LIVE NAVIGATION ───────────────────────── */
  let navMap, navLine, userMarker, watchId, navStepIdx, simTimer, navStartLen;

  function speak(text) {
    if (muted || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB"; u.rate = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  function startNav() {
    if (!activeRoute) return;
    show("nav");
    navStepIdx = 0;
    navStartLen = activeRoute.geometry.length;

    if (!navMap) {
      navMap = L.map("navMap", { zoomControl: false });
      L.tileLayer(TILE, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(navMap);
    }
    setTimeout(() => navMap.invalidateSize(), 60);

    if (navLine) navMap.removeLayer(navLine);
    navLine = L.polyline(activeRoute.geometry, { color: "#3da5ff", weight: 6, opacity: .9 }).addTo(navMap);
    navMap.fitBounds(navLine.getBounds(), { padding: [40, 40] });

    const icon = L.divIcon({ className: "", html: '<div class="user-dot"></div>', iconSize: [18, 18] });
    userMarker = L.marker(activeRoute.geometry[0], { icon }).addTo(navMap);

    updateInstruction(activeRoute.geometry[0]);
    speak("Starting your practice drive. Drive safely.");

    // Real GPS if we're actually moving; otherwise simulate so the route is reviewable.
    if ("geolocation" in navigator) {
      let moved = false;
      watchId = navigator.geolocation.watchPosition(
        (p) => { moved = true; onPosition([p.coords.latitude, p.coords.longitude]); },
        () => { if (!moved) simulate(); },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
      );
      // If no real movement within 6s (e.g. testing on a desktop), simulate the drive.
      setTimeout(() => { if (!moved) simulate(); }, 6000);
    } else {
      simulate();
    }
  }

  function onPosition(pos) {
    if (!userMarker) return;
    userMarker.setLatLng(pos);
    navMap.panTo(pos, { animate: true, duration: .5 });
    updateInstruction(pos);
  }

  function updateInstruction(pos) {
    const steps = activeRoute.steps;
    if (!steps.length) { $("navTurn").textContent = "Follow the blue line"; return; }
    // advance past any reached steps
    while (navStepIdx < steps.length - 1 && haversine(pos, steps[navStepIdx].loc) < 35) {
      navStepIdx++;
      speak(steps[navStepIdx].text);
    }
    const step = steps[Math.min(navStepIdx, steps.length - 1)];
    const d = haversine(pos, step.loc);
    $("navTurn").textContent = step.text;
    $("navDist").textContent = d > 30 ? `in ${Math.round(d)} m` : "now";

    const pct = Math.round((navStepIdx / Math.max(1, steps.length - 1)) * 100);
    $("navProgress").textContent = pct + "%";
    if (navStepIdx >= steps.length - 1 && d < 40) finishDrive();
  }

  function simulate() {
    if (simTimer) return;
    const geo = activeRoute.geometry; let i = 0;
    toast("Simulating drive (no live GPS)");
    simTimer = setInterval(() => {
      if (i >= geo.length) { finishDrive(); return; }
      onPosition(geo[i]); i += Math.max(1, Math.floor(geo.length / 120));
    }, 250);
  }

  function finishDrive() {
    if ($("screen-summary").hidden === false) return;
    const dist = activeRoute.distance, dur = activeRoute.duration;
    stopNav(true);
    $("summaryStats").textContent =
      `${activeRoute.name} · ${fmtKm(dist)} · ${activeRoute.steps.length} manoeuvres practised.`;
    speak("Drive complete. Well done.");
    show("summary");
    renderAds();
  }

  function stopNav(silent) {
    if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  $("stopNavBtn").addEventListener("click", () => { stopNav(); show("summary"); finishDrive(); });
  $("muteBtn").addEventListener("click", () => {
    muted = !muted; $("muteBtn").textContent = muted ? "🔇" : "🔊";
    if (muted && "speechSynthesis" in window) speechSynthesis.cancel();
  });
  $("summaryDoneBtn").addEventListener("click", () => { history.length = 0; show("home"); });

  /* ───────────────────────── RECORD A ROUTE ───────────────────────── */
  let recMap, recLine, recTrack, recWatch;

  $("recordBtn").addEventListener("click", startRecording);
  $("myRoutesBtn").addEventListener("click", () => {
    // jump into a synthetic "centre" listing all saved routes
    const saved = getAllSavedRoutes();
    if (!saved.length) { toast("No recorded routes yet — open a centre and tap Record."); return; }
    activeCentre = { id: "__saved__", name: "My recorded routes", town: "Saved", region: "On this device", routes: [] };
    $("centreTitle").textContent = "My recorded routes";
    $("centreSub").textContent = `${saved.length} saved on this device`;
    const list = $("routeList"); list.innerHTML = "";
    saved.forEach((r) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<div class="c-main"><div class="c-title">${r.name} 📍</div>
        <div class="c-sub">${r.centreName || ""} · ${fmtKm(r.distance || 0)}</div></div>
        <span class="pill Easy">Saved</span>`;
      el.addEventListener("click", () => openRoute(activeCentre, r));
      list.appendChild(el);
    });
    show("routes");
  });

  function startRecording() {
    if (!("geolocation" in navigator)) { toast("Geolocation not supported on this device."); return; }
    show("record");
    recTrack = [];
    if (!recMap) {
      recMap = L.map("recordMap", { zoomControl: false });
      L.tileLayer(TILE, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(recMap);
    }
    setTimeout(() => recMap.invalidateSize(), 60);
    if (recLine) recMap.removeLayer(recLine);
    recLine = L.polyline([], { color: "#27d796", weight: 6 }).addTo(recMap);

    recWatch = navigator.geolocation.watchPosition(
      (p) => {
        const pt = [p.coords.latitude, p.coords.longitude];
        recTrack.push(pt); recLine.addLatLng(pt); recMap.setView(pt, 16);
        $("recordPoints").textContent = recTrack.length + " pts";
        $("recordDist").textContent = fmtKm(trackLength(recTrack));
      },
      () => toast("Couldn’t get GPS fix — go outside for a better signal."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }

  function trackLength(t) {
    let d = 0; for (let i = 1; i < t.length; i++) d += haversine(t[i - 1], t[i]); return d;
  }

  function stopRecording(silent) {
    if (recWatch != null) { navigator.geolocation.clearWatch(recWatch); recWatch = null; }
    if (silent) return;
    if (!recTrack || recTrack.length < 2) { toast("Too short to save."); show("routes", false); return; }
    const name = prompt("Name this route:", activeCentre ? activeCentre.town + " practice" : "My route");
    if (!name) { show("routes", false); return; }
    saveRoute({
      id: "saved_" + Date.now(),
      name,
      centreId: activeCentre ? activeCentre.id : "__saved__",
      centreName: activeCentre ? activeCentre.name : "",
      geometry: recTrack,
      distance: trackLength(recTrack),
      duration: recTrack.length * 2,
      steps: [],
      notes: "Your recorded route"
    });
    toast("Route saved 📍");
    openCentre(activeCentre);
  }
  $("stopRecordBtn").addEventListener("click", () => stopRecording(false));

  /* ───────────────────────── saved-route storage ───────────────────────── */
  function getAllSavedRoutes() {
    try { return JSON.parse(localStorage.getItem("rr_saved") || "[]"); } catch (e) { return []; }
  }
  function getSavedRoutes(centreId) {
    return getAllSavedRoutes().filter((r) => r.centreId === centreId);
  }
  function saveRoute(r) {
    const all = getAllSavedRoutes(); all.push(r);
    try { localStorage.setItem("rr_saved", JSON.stringify(all)); } catch (e) { toast("Storage full."); }
  }

  /* ───────────────────────── boot ───────────────────────── */
  renderCentres();
  show("home", true);
  renderAds();
})();
