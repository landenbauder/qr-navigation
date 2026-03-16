# Copilot Instructions for QR Navigation

## Scope
- Static web app: vanilla JavaScript, HTML, CSS only.
- No frameworks, build tools, or package managers unless explicitly requested.

## Code Style
- Minimal, surgical changes that solve the requested problem.
- Preserve existing public behavior and UI structure unless the task asks for UX changes.
- Avoid unrelated refactors.
- Keep naming clear and consistent with existing files.
- Prefer readable, maintainable logic over clever shortcuts.

## Project Guardrails
- Maintain mobile-first behavior and touch-friendly interactions.
- Keep documentation concise and task-focused.
- If behavior changes, update the relevant docs (`README.md`, `DEPLOYMENT.md`, or `qr-code-info.md`) in the same task.

## Key References
- App logic: `app.js` (NavigationApp class)
- Office data: `offices.json`, `generate-offices.js`
- Deployment: see [DEPLOYMENT.md](../DEPLOYMENT.md)
- QR codes: see [qr-code-info.md](../qr-code-info.md)
- Workflow: see [AI_WORKFLOW_GUIDE.md](../AI_WORKFLOW_GUIDE.md)
