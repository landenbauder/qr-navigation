# App feature audit and improvement plan

Date: October 20, 2026

Status: Release A is implemented locally: admin map actions minimize the editor, expose a compact Cancel strip, restore existing drafts/selections, and handle Escape before exiting admin. All 61 tests pass, including 12 new admin map-action regressions. Browser checks covered small mobile, landscape, and desktop layouts with mocked authentication/persistence. Configuration, office data, and live records were not changed by this work.

The audit findings below describe the original, pre-implementation behavior. Later releases remain proposals.

Update (same day): Release B's sign previews (explicit Save sign / Change spot / Discard, default "New sign" naming, 20-second save timeout) and Release C's keyboard search, Browse all tenants directory, truthful accuracy display, and friendlier Street View errors are implemented locally. The walking route now draws as a single thin solid line. 68 tests pass.

## 1. Scope and evidence

The review covers visitor search, navigation, QR-sign walking routes, map/Street View controls, tenant/sign administration, and local developer tools. Recommendations keep the static vanilla JavaScript/HTML/CSS architecture.

### Automated checks completed

- All **49 existing Node tests passed**, with no failures or skipped tests.
- The real-network test checks all three built-in signs against all 30 office doors, including route lengths and crossings of reference office outlines. This is software validation, not proof of physical walkability.
- The walkway draft validator returned **0 errors and 3 warnings**: no buildings in the draft, no navigation boundary, and all 84 walkways lacking field verification. The draft contains one connected group, 30 doors, three signs, and no parking features.
- Existing automated tests cover geometry, graph routing, validation, and legacy import. They do not cover the admin sheet or other browser interactions.

Commands used:

```powershell
node --test .\tests\nav-geo.test.js .\tests\nav-graph.test.js .\tests\nav-validate.test.js .\tests\import-legacy.test.js .\tests\willowbrook-network.test.js
node .\tools\validate-property.js
```

### Browser audit

The separate browser agent exercised the local app on desktop and at 390 x 844 and 320 x 568. Admin access used mocked authentication, with real backend mutation requests intercepted. No live saves or browser draft-storage writes occurred.

| Feature / flow | Result | Evidence / boundary |
|---|---|---|
| Company/unit search and empty results | Pass | Partial-name search found Airtex; unit search returned matches; an unknown query displayed No offices found. |
| Select office and return to search | Pass | Exercised on desktop and the 390-pixel visitor layout. |
| Visitor View All directory | Missing in tested UI | No dedicated visitor-facing control appeared, despite the advertised feature. |
| Legacy navigation | Pass with emulated location | An on-site location produced a 213 m route; a distant location displayed Location too far. Physical walking was not tested. |
| Sign-based routes and Change start | Pass | Main lot to Airtex displayed 93 m; a West lot preview displayed 163 m. |
| Unknown sign link | Pass | An invalid start ID opened the picker with a sign-not-recognized message. |
| One-time GPS start and denied permission | Pass with simulation | A 5 m-accuracy fix produced a route labeled Not live tracking; denial offered sign starts instead. |
| Panorama open/close | Pass for UI lifecycle | Exit 360 restored navigation. |
| Actual panorama imagery | Blocked | Google rejected the loopback referrer with RefererNotAllowedMapError. Imagery rendering was not verified. |
| Admin entry cancel and rejected login | Pass with mocked dialogs/auth | Cancellation stayed outside admin; simulated rejection displayed the passcode error. Real credentials and native permission/auth dialogs were not exercised. |
| Tenant selection and discard protection | Pass in mocked admin | Rejecting discard retained the selected tenant and staged door change. |
| Move front door | Placement works; mobile UX fails | Tapping the small exposed map strip staged a point without saving, but the editor continued to obscure the map. |
| Add sign and Move sign | Mobile UX fails | Name validation and pick-mode toggles worked; the sheet remained open. No real sign save was attempted. |
| Keyboard search selection | Fail | ArrowDown followed by Enter did not select the displayed result. |
| Office tracing | Pass for safe subset | Opened/closed tracing and displayed 30 saved outlines; no edits were saved. |
| Walkway editor | Pass for safe subset | Open/close, Fit, Aerial, and References worked; draft counts/warnings matched the validator. |
| Saves, sign rename/remove, trace/editor export-import round trips, movement, and disconnected-route UI | Not fully tested | Require controlled integration tests or additional browser/device verification. Pure graph tests cover disconnected routes, not the complete UI flow. |

**Main mobile reproduction:** enter admin, select Move front door, or type a new sign name and select Add sign, or select Move for an existing sign. The sheet remains in front of the map; hit-testing the map center returns the admin panel.

- At **390 x 844**, the sheet measured approximately **366 x 744**, occupying **88% of viewport height**.
- At **320 x 568**, it measured **296 x 536**, occupying **94% of viewport height**, with internal scrolling required.
- There is no explicit Cancel. Pressing the armed action button again toggles the mode off, but its instruction text still tells the user to tap the map.

### Testing limitations

- Real admin credentials and live backend writes are outside this audit. Mocked authentication or persistence must not be represented as a successful production integration test.
- Native browser prompts were unsupported by the audit browser; their app branches were exercised using simulated dialog responses.
- Browser viewport emulation is not a physical iPhone/Android test. Actual permission dialogs, virtual keyboards, safe areas, GPS precision, and outdoor walking require device verification.
- Third-party map and panorama availability must be distinguished from app UI behavior.
- The current user-edited runtime configuration is preserved.

## 2. First release: fix admin map actions

**Priority: P0 / first implementation.**

### Confirmed cause

[Admin action handlers](app.js) arm entrance/sign placement and change instruction text, but do not collapse the admin panel. The [mobile panel styling](styles.css) allows the sheet to occupy almost the entire viewport. Instructions live inside that same sheet, and there is no dedicated map-action Cancel control.

Current map actions are:

| Action | Current completion behavior | Required presentation change |
|---|---|---|
| Move front door | Tap stages a tenant entrance; Save changes publishes it | Minimize while choosing, then restore the tenant editor |
| Add sign | Requires a new name, then a valid map tap immediately saves the sign | Minimize after name validation; restore editor with saving/result feedback |
| Move sign | A valid map tap immediately saves the selected sign | Minimize while choosing; restore editor with saving/result feedback |

### Intended interaction

1. Validate prerequisites while the editor is still open. For example, an empty/new-sign name error must remain visible and focused rather than collapsing the sheet.
2. Once a map action is armed, minimize the full editor and dismiss the input keyboard.
3. Show only a compact instruction strip with a persistent, touch-friendly **Cancel** button:

   ```text
   Move front door - Unit 12
   Tap the new location on the map.       [Cancel]
   ```

4. Keep the rest of the map available for panning, zooming, and choosing the point. Do not use a full-screen backdrop that intercepts map taps.
5. Cancel restores the editor, its selected tenant/sign, entered names, previous pending entrance, and scroll position. Preserve map center/zoom and replace stale tap instructions with a neutral cancellation/editing status. It leaves admin mode active and performs **zero writes**.
6. A valid entrance tap restores the editor with the pending entrance and the existing Save changes workflow. A valid sign tap restores the editor with its existing save progress/result.
7. An invalid sign location keeps map-picking active and displays its validation error in the compact strip, not in the hidden sheet. Cancel remains reachable.
8. Escape cancels an active map action first. Only when no action is active does it retain the existing exit-admin behavior.

**Cancel semantics:** cancel only the action just started; do not discard unrelated edits already pending before that action. Once a sign save request has been sent, Cancel cannot promise to undo a server write. The second release below addresses that separate save-model inconsistency.

### Implementation outline

- In [app.js](app.js), introduce one shared enter/complete/cancel presentation lifecycle for admin map actions. Connect both entrance and sign handlers to it; avoid three independent collapse implementations.
- Retain the existing mutually exclusive pick modes, placement checks, tenant drafts, sign IDs, and routing behavior.
- In [index.html](index.html), add the compact instruction/status strip and Cancel button.
- In [styles.css](styles.css), add the minimized state, safe-area-aware positioning, and at least 44-by-44 CSS-pixel cancellation target. Coordinate other floating controls so the strip remains reachable.
- Hide inactive editor controls from keyboard navigation. Announce the active action/errors, and return focus to the initiating control on cancellation/completion.
- Reset the transient presentation on admin exit and error paths; do not leave invisible pick flags or orphaned banners.
- Reuse the principle already present in the walking test-start picker: dismiss the selection sheet before requesting a map tap.
- Update the admin instructions in [README.md](README.md).

### Acceptance criteria

- All three actions minimize the editor immediately after successful prerequisite validation, on mobile and desktop.
- At 320 x 568 and 390 x 844, at least 60% of the viewport remains unobstructed and available for map interaction while picking. Also verify landscape and a physical phone with its keyboard open.
- Cancel is visible without scrolling and can be reached by touch and keyboard.
- Cancel produces no tenant/sign write and preserves the draft that existed before picking.
- Cancelled actions cannot consume subsequent map taps.
- Invalid placement, network failure, and expired authentication produce visible feedback; they never claim a save succeeded.
- Tenant entrance selection still requires Save changes. This first release does not silently change signs' existing immediate-save behavior.
- Renaming/removing a sign, editing a tenant name, route selection, and ordinary map panning retain their existing behavior.
- Regression cases cover repeated start/cancel cycles, switching action types, admin exit, and completion/failure for each action.

## 3. Improve existing features

Priorities are relative: P1 follows the required mobile fix; P2 is polish or a larger dependency.

| Priority | Improvement | Reason and definition of done |
|---|---|---|
| P1 | Consistent sign preview and explicit save | Signs currently publish on a map tap, unlike tenant doors. Stage add/move results, show a marker preview, then offer Save sign and Discard. A misplaced tap must not publish. Keep sign IDs/printed links stable. This is an intentional behavior change, documented and tested separately from the first release. |
| P1 | Reliable admin drafts and recovery | Preserve edits on validation/write failure; warn before discarding sign drafts as well as tenant drafts. Disable duplicate submissions and distinguish authentication expiry, permission/rules failure, and connectivity errors. Do not report every login/network failure as an incorrect passcode. |
| P1 | Route-readiness and field verification | Complete building and navigation-boundary features in the walkway draft, survey the 84 walkways and actual signs/doors, and record verification. Existing outline checks help but cannot verify gates, curbs, closures, or physical access. Keep pilot labeling until the publishing requirements are met. |
| P1 | Search accessibility and directory discoverability | Search result items currently use clickable divs. Provide keyboard-selectable results with clear focus and suitable combobox/listbox semantics. Make browsing all tenants available in the visitor UI; align the advertised View All feature with what visitors can actually access. Preserve name/unit/description matching. |
| P1 | Truthful location accuracy | The legacy accuracy circle is capped at 20 m even for a worse fix. Show the numeric reported uncertainty and either draw it faithfully or explicitly label any visual cap. Keep one-time walking starts visibly distinct from live tracking; do not change GPS or movement thresholds as part of a presentation fix. |
| P2 | Mobile overlay coordination | Use a predictable placement scheme for destination information, walking-start status, map controls, developer panels, and panorama controls. Ensure no critical button or attribution is hidden at small heights, landscape, or increased text size. |
| P2 | Provider failure and retry UX | Preserve navigation/search when Street View is unavailable. Distinguish missing configuration, provider rejection, offline state, and genuinely missing imagery; provide useful recovery instead of a permanent loading state. |
| P2 | Developer-tool editing ergonomics | Apply compact map-action prompts where tracing/editor tools obstruct placement. Preserve existing trace persistence, undo, export/import, and validation rather than rebuilding those features. Keep developer tools local-only. |
| P2 | Documentation accuracy | Refresh outdated feature lists and troubleshooting so they distinguish legacy GPS/OSRM navigation from sign-based walking routes. Remove already-implemented items such as admin management from the future-feature list. |

## 4. Suggested additions

These are additions to existing capabilities, not prerequisites for fixing the admin panel.

| Order | New capability | User value | Dependencies / safeguards |
|---|---|---|---|
| 1 | QR-sign toolkit | Copy/open each stable sign link and download a printable sign with its QR code, starting-point name, and a human-readable URL | Verify generated codes by scanning them. Moving/renaming a sign must not change its ID. Decide QR-generation implementation without adding a framework/package manager by default. |
| 2 | Visitor route preview in admin | Preview an office route from each sign and flag doors/signs that no longer connect after edits | Reuse the existing graph/placement checks. Show network version and verification status; do not imply a preview proves on-site accessibility. |
| 3 | Destination sharing and entrance details | Share a chosen tenant and start, plus a concise entrance card with an optional door photo, business hours/contact, and landmark notes | Define stable destination IDs and optional metadata without breaking the current office schema. Do not include a visitor's GPS coordinates by default. Existing 360 preview remains available. |
| 4 | Report a wrong door or blocked path | Let visitors identify a specific office/sign/path and submit a short issue for management | Requires a reviewed submission workflow, storage, and abuse controls. Reports must not directly modify routing or public data. |
| 5 | Step-free route preference | Offer routes avoiding verified stairs and inaccessible connections | Requires field-verified ramps/curbs/steps and an explicit graph filter. Unknown accessibility is not equivalent to accessible; return a clear no-verified-route result when appropriate. |
| 6 | Admin temporary-closure controls | Management can close/reopen verified walkway segments with a reason and audit history | Reuse existing edge closure support, add authorized persistence and visitor refresh behavior, and check affected routes before publishing. A safe disconnected result is preferable to an invented detour. |
| Later | Landmark-based text directions; optional voice | Help users who cannot comfortably follow the map | Generate from validated graph turns and surveyed landmarks; validate on site before treating prompts as reliable turn-by-turn guidance. |
| Later | Offline resilience | Keep the app shell and explicitly versioned last-known data useful during a weak connection | Respect map/imagery provider caching terms. Label stale information and unavailable live services. Do not silently queue/publish admin edits or present stale closures as current. |

## 5. Delivery sequence

1. **Release A - required usability fix:** shared admin map-action lifecycle, compact strip, Cancel, mobile/accessibility regression coverage, and admin documentation. No routing or backend/schema changes.
2. **Release B - safer editing:** explicit sign previews/save/discard, draft protection, and actionable authentication/save errors.
3. **Parallel operational work:** field survey, complete draft geometry, and review moved entrances. Keep the network in pilot until verified.
4. **Release C - visitor polish:** keyboard search/directory access, truthful accuracy, overlay coordination, and provider recovery.
5. **Release D - useful additions:** QR-sign toolkit and admin route preview first; select later additions based on actual visitor/manager feedback.

Do not combine all additions into the first fix. Backend features and new office metadata need separate schema/rules review and test cases.

## 6. Verification before implementation is considered complete

### Admin map-action matrix

For Move front door, Add sign, and Move sign, check: prerequisite validation; minimized UI; pan/zoom; valid tap; invalid tap where applicable; Cancel before a tap; Escape; repeated activation; preserved selection/drafts; restored focus; successful save; rejected save; and no writes on cancellation. Use controlled/mocked persistence for repeatable tests, then an authorized test backend for integration.

### Navigation and device checklist

- **Permission flow:** plain-link legacy behavior and allow/deny/retry on Safari, Chrome, Firefox, and Android WebView. Sign/pilot links must not request location on load; their one-time GPS option requests it only when chosen.
- **Route generation:** each sign to each of the 30 doors, changing starts, invalid/removed sign links, disconnected or moved doors, and provider failures. Walking mode must never fall back to OSRM or a straight line.
- **Movement updates:** legacy movement below 15 m must not trigger a distance-based recalculation; movement at/above 15 m must retain the existing update behavior. Sign-based/one-time walking starts must not silently become live tracking.
- **Accuracy indicator:** verify precise and imprecise fixes, stale fixes, denied permission, numeric uncertainty, and visual uncertainty. Preserve current walking thresholds: 25 m maximum fix uncertainty, 15-second maximum age, 30 m attachment distance, and 2 m door-match tolerance.
- **Mobile interaction:** 320 x 568, 390 x 844, landscape, enlarged text, physical iOS/Android keyboard and safe areas. All required controls remain visible and touch-friendly.
- **Other features:** search and directory, return-to-search, basemap switching, panorama open/close/context map, trace save/export, and walkway editor undo/import/export/validation in isolated draft storage.
- **Release safety:** all 49 existing tests still pass; add focused admin interaction regressions without introducing a framework/build system. Verify production does not expose local developer tools and preserve map-provider attribution.

### Current guardrails

Preserve the office schema, existing Firebase authorization, stable sign links, browser-specific geolocation branches, Leaflet routing configuration, map attribution, and the pilot/published split. Do not publish a network or change GPS thresholds merely to make a test pass.
