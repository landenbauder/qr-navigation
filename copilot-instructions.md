# Copilot Instructions for QR Navigation

## Scope
- This is a static web app.
- Use vanilla JavaScript, HTML, and CSS only.
- Do not introduce frameworks, build tools, or package managers unless explicitly requested.

## Code style and change strategy
- Make minimal, surgical changes that solve the requested problem.
- Preserve existing public behavior and UI structure unless the task asks for UX changes.
- Avoid unrelated refactors.
- Keep naming clear and consistent with existing files.

## Project-specific rules
- Preserve compatibility with the existing `offices.json` schema.
- Keep geolocation behavior compatible with HTTPS deployment expectations.
- Keep map and routing behavior aligned with current Leaflet + OSRM usage in `app.js`.
- Maintain mobile-first behavior and touch-friendly interactions.

## Reliability and validation
- Add defensive input checks for external data (for example office coordinates and search inputs).
- Prefer readable, maintainable logic over clever shortcuts.
- When changing routing, geolocation, or search behavior, include a short manual verification checklist in the response.

## Documentation updates
- If behavior changes, update the relevant docs (`README.md`, `DEPLOYMENT.md`, or `qr-code-info.md`) in the same task.
- Keep documentation concise and task-focused.
