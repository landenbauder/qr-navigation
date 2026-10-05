---
description: "Use when working on GPS, geolocation, location tracking, map routing, OSRM, Leaflet map behavior, or browser location permissions."
---
# Geolocation & Routing Guidelines

- The app requires HTTPS for geolocation to work (GitHub Pages provides this).
- Browser-specific location handling exists for Safari, Chrome, Firefox, and Android WebView — preserve all branches.
- Geolocation uses `navigator.geolocation.watchPosition` with high accuracy enabled.
- Plain links (no `?start=`) still use the legacy path below until the walkway network is published as `published`.
- Links with `?start=` or `?pilot=walking` use the property walkway network (`js/nav-graph.js`, data in `data/properties/willowbrook/`): no OSRM, no location permission on load, and no straight-line or road fallback when no route exists. GPS is used only for the one-time "Use my current location" start (thresholds in `walkingConfig`, tune from field tests).
- Legacy path: routes are calculated via Project OSRM public API (`router.project-osrm.org`) for walking profiles.
- Route recalculation triggers after 15+ meters of user movement — do not change this threshold without explicit request.
- Map tiles: CartoDB Positron (light grey) via Leaflet v1.9.4. Do not switch tile providers.
- Leaflet Routing Machine v3.2.12 handles legacy route display — preserve its configuration.
- When changing routing or geolocation behavior, include a manual verification checklist in the response covering: permission flow, route generation, route updates on movement, and accuracy indicator.
