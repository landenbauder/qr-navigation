---
name: test-mobile
description: "Generate a tailored mobile testing checklist based on what changed in the app."
---
# Mobile Testing Checklist

## What Changed
${input:changes:Describe what was changed (e.g., search logic, route display, UI layout)}

Based on the changes described, generate a tailored manual testing checklist for mobile browsers. Cover:

1. **Core functionality** — Does the changed feature work on mobile?
2. **Touch interactions** — Are tap targets large enough? Do swipe/scroll gestures still work?
3. **Browser coverage** — Test on Safari (iOS), Chrome (Android), and Firefox mobile
4. **Responsive layout** — Does the UI adapt to small screens without overflow or clipping?
5. **Geolocation flow** — If location-related, test the permission prompt and GPS tracking
6. **Offline/slow network** — Does the app handle slow tile loading or OSRM timeouts gracefully?

Format the checklist as copy-pasteable markdown checkboxes grouped by category.
