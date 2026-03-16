---
description: "Use when editing JavaScript files. Covers vanilla JS coding standards, NavigationApp class patterns, and mobile-first requirements for this static web app."
applyTo: "**/*.js"
---
# JavaScript Standards

- Vanilla ES6+ only — no frameworks, transpilers, or module bundlers.
- Preserve the `NavigationApp` class structure in `app.js`. New features extend existing methods or add new ones on the class.
- Use `const` by default, `let` when reassignment is needed, never `var`.
- Add defensive input checks for external data (coordinates, search inputs, API responses).
- Keep all DOM manipulation compatible with mobile Safari, Chrome, and Firefox on both iOS and Android.
- Touch interactions: use `touchstart`/`touchend` alongside click events where needed.
- Do not add global variables — keep state within the `NavigationApp` instance.
