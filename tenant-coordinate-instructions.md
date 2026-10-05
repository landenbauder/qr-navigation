# Tenant Coordinate Update Instructions

This repo stores tenant geometry in two source files:

- `new_office_locations.json`: one icon point per tenant or suite.
- `new_office_building_entrances`: one line per entrance coordinate. Repeat the same tenant name on multiple lines when a suite has multiple entrances.

## Fastest Workflow

1. Start from `tenant-units-from-pdf.csv`.
2. Review the rows with `confidence` set to `low` or `medium` before touching repo data.
3. Reuse existing coordinates whenever the physical suite is unchanged. The quickest path is usually to remap tenant names by suite number, not to recollect every coordinate from scratch.
4. For each tenant, keep one canonical name and use that exact same name in both source files.
5. For each suite, collect:
   - one icon point near the center of the suite
   - one primary entrance point on the actual door
   - extra entrance points only if the suite really has multiple usable doors
6. Update `new_office_locations.json` with the icon point.
7. Update `new_office_building_entrances` with one or more entrance points.
8. Run `node generate-offices.js`.
9. Verify the generated `offices.json` entry before moving on.

## What To Reuse First

The current repo already has icon and/or entrance geometry for many suites. That means you can often copy the existing coordinates and only change the tenant name.

Good reuse candidates from the current repo include:

- Airtex Manufacturing Inc.
- Advanced Physicians, SC
- Firmus Medical, LLC
- Ecodrive, Inc.
- Charland, LLC
- Thomas Murphy
- SFUSA
- John Devae Insurance Agency, Inc.
- Donald E. Morris Architect, PC
- Redwood Construction Group LLC
- Equitec Group LLC
- Armond Cozzi
- The Forest Electric Company
- Nightingale Home Healthcare of Illinois, Inc.
- Envirotest Perry Labs, Inc.
- Law Office of Robert J. Chio
- The Best Veneer Company LLC
- Troop Contracting, Inc.

The current repo also looks stale in places, so treat the new CSV as the source of truth for tenant-to-unit mapping and reuse only the geometry.

Examples of stale data already visible in the repo:

- Unit 608 is currently modeled as Lifetime Restoration, but the PDF shows Sam International, LLC.
- `offices.json` currently preserves TRP Investments as unit 650, but the PDF shows unit 7650.
- The repo uses `Perform Technologies, Inc.` while the PDF appears to say `Proform Technologies, Inc.`.

## Important Generator Quirk

`generate-offices.js` only writes a `unit` field into `offices.json` when the office name contains the pattern `(Unit N)`.

That means you have two options if you want units preserved in generated app data:

1. Fast path: temporarily name entries like `Tenant Name (Unit 7652)` in the source coordinate files.
2. Cleaner path: update `generate-offices.js` later so it reads units from a dedicated mapping file instead of parsing them from the name.

If your immediate goal is only to update map coordinates and navigation behavior, you can leave unit tracking in the CSV for now and update the generator separately afterward.

## Recommended Working Columns

If you want one spreadsheet to drive the rest of the update, extend the CSV with these columns:

- `canonical_name`
- `icon_lat`
- `icon_lng`
- `entrance_1_lat`
- `entrance_1_lng`
- `entrance_2_lat`
- `entrance_2_lng`
- `status`
- `notes`

Then you can copy from that sheet into the two repo source files in one pass.

## What "Confirm" Means

When I say "confirm" for a reuse candidate, I do not mean confirm the tenant name.

I mean confirm that the new tenant is physically in the same suite footprint and uses the same exterior door location as the old tenant whose coordinates already exist in the repo.

You are checking geometry only:

- Is it the same suite location on the floor plan?
- Does it open to the same outside side of the building?
- Does it appear to use the same exterior door or pair of doors?

If the answer is yes, we can safely reuse the old icon and entrance coordinates and just change the tenant name.

If the answer is no, then that tenant needs new coordinates.

## How To Check A Reuse Candidate

Use this exact process for Redwood and Faron:

1. Open the tenant PDF floor plan page.
2. Find the suite number for the tenant you are checking.
3. Find the neighboring suite numbers around it.
4. Compare that position against the old tenant listed in `remaining-office-coordinate-capture.csv`.
5. Ignore the tenant name and focus only on whether the suite occupies the same physical spot.
6. If the old and new suites line up in the same place and use the same exterior side of the building, mark it as reusable.
7. If they do not line up, treat it as a new capture.

The key idea is simple: same suite shell and same outside door means reuse is safe.

## Detailed Instructions For The Remaining Offices

### Redwood Construction Group LLC, Unit 7630

What you are checking:

- Whether Redwood in suite 7630 occupies the same physical suite position that was previously modeled as Precise Bioscience.

Current candidate geometry:

- candidate icon: `41.75105293068326, -87.93762895381508`
- candidate entrance 1: `41.75105449411903, -87.93775206372628`
- candidate entrance 2: `41.75105136724749, -87.93750584390918`

What to do:

1. On the floor plan, locate suite 7630.
2. Check whether 7630 is the same upper suite area that sits between the neighboring upper-wing suites currently represented by the old Precise Bioscience geometry.
3. Check whether that suite appears to have two exterior access points on the same outside edge pattern as the old Precise Bioscience entry.
4. If yes, send me: `Redwood 7630 = reuse Precise Bioscience coordinates`.
5. If no, send me: `Redwood 7630 needs new coordinates`.

What you are not deciding:

- You are not deciding whether the handwritten unit number is correct here.
- You are only deciding whether the old door geometry still matches the physical suite.

### Faron and Associates, Inc., Unit 7648

What you are checking:

- Whether Faron in suite 7648 occupies the same physical suite location that was previously modeled as Henrich Electronics Corporation.

Current candidate geometry:

- candidate icon: `41.750595, -87.937635`
- candidate entrance 1: `41.750623885117584, -87.9375746756993`

What to do:

1. On the floor plan, locate suite 7648.
2. Check whether 7648 is the same upper-right wing suite that used the old Henrich exterior door.
3. Check whether the suite still appears to front the same outside building edge.
4. If yes, send me: `Faron 7648 = reuse Henrich coordinates`.
5. If no, send me: `Faron 7648 needs new coordinates`.

### Father & Sons Plumbing & Sewer Corp., Unit 636

This one is different.

There is no clean existing tenant entry for this suite, so you are not confirming a reuse. You are placing a new point.

Starter coordinates:

- starting icon: `41.7501391133893, -87.9388459330158`
- starting entrance: `41.7501381537982, -87.9389001581592`

Those starter coordinates are just a midpoint estimate between the known suites for unit 632 and unit 638.

What to do:

1. On the floor plan, find unit 636.
2. Verify that it sits between unit 632 and unit 638 as expected.
3. Open Google Maps or another satellite view.
4. Paste the starting icon coordinates to get close to the suite.
5. Switch to satellite view.
6. Place the icon point near the center of the unit footprint, not on the sidewalk and not on the door.
7. Place the entrance point on the actual exterior door threshold for that suite.
8. If you can identify more than one real exterior door for that suite, note both. Otherwise one entrance is enough.
9. Send me the adjusted coordinates, or tell me to use the starter point if it already looks correct.

What counts as a good icon point:

- inside the suite footprint
- roughly centered in the suite
- not in the parking lot or sidewalk

What counts as a good entrance point:

- directly on the exterior door used to enter the suite
- not just near the wall
- not centered in the suite

## What To Send Back To Me

You do not need to edit the JSON files yourself.

You can reply in this compact format:

- `Redwood 7630 = reuse Precise` or `Redwood 7630 = new coords needed`
- `Faron 7648 = reuse Henrich` or `Faron 7648 = new coords needed`
- `Father 636 icon = <lat>, <lng>`
- `Father 636 entrance = <lat>, <lng>`

If you want the shortest possible path, you can also just tell me:

- `Assume Redwood reuse`
- `Assume Faron reuse`
- `Use the Father 636 starter coordinates`

and I can apply those assumptions for you.

## Rows To Manually Check

- Redwood Construction Group LLC: handwriting looks like unit 630, but the same rent roll still lists 630 as vacant.
- Firmus Medical, LLC: handwriting appears to be 7646.
- Charland, LLC: handwriting appears to be 7656.
- Proform Technologies, Inc.: handwriting appears to be 7664, and the repo currently uses a different spelling.