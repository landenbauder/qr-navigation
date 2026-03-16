---
description: "Use when working on office location data, the offices.json schema, generate-offices.js, building entrances, or sidewalk/panorama waypoints."
applyTo:
  - "offices.json"
  - "generate-offices.js"
  - "new_office_building_entrances"
  - "new_office_locations.json"
  - "panorama_gps_locations.txt"
  - "sidewalk_locations.txt"
---
# Office Data Guidelines

## offices.json schema
Each office entry must include: `name`, `lat`, `lng`, `unit`, `panorama` (with `lat`, `lng`, `heading`), and `walkingPath` array. Do not add, remove, or rename top-level fields without updating `app.js` to match.

## generate-offices.js pipeline
1. Reads entrance GPS from `new_office_building_entrances` and `new_office_locations.json`
2. Groups entrances by office name, finds nearest sidewalk point per entrance
3. Finds nearest panorama to the sidewalk point
4. Calculates heading from panorama toward entrance
5. Builds 3-point walking path: panorama → sidewalk → entrance
6. Outputs updated `offices.json`

Run with `node generate-offices.js`. Always verify the output `offices.json` after running.

## Coordinate format
- Latitude/longitude as decimal degrees (e.g., `41.750732, -87.937825`)
- GPS coordinates must be validated as numbers before processing
- Walking paths are arrays of `[lat, lng]` pairs, ordered from panorama to entrance

## Adding a new office
1. Add entrance coordinates to `new_office_building_entrances`
2. Add icon location to `new_office_locations.json`
3. Run `node generate-offices.js`
4. Verify the new entry in `offices.json`
