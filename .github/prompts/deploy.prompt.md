---
name: deploy
description: "Generate a pre-deployment checklist and verify readiness for GitHub Pages deployment."
agent: agent
---
# Pre-Deployment Checklist

Prepare for deployment to GitHub Pages. Perform these checks:

1. **Required files exist**: `index.html`, `styles.css`, `app.js`, `app-config.js`, `offices.json`, `images/wbcLogoRC600.png`
2. **Configuration**: Verify `app-config.js` has appropriate settings (API key if needed)
3. **Data integrity**: Confirm `offices.json` is valid JSON with expected office count
4. **No exposed secrets**: Scan for hardcoded API keys or credentials in committed files
5. **Console errors**: Check for obvious JS errors (undefined references, missing files)
6. **Mobile readiness**: Confirm responsive meta tag and touch-friendly elements
7. **HTTPS features**: Geolocation requires HTTPS — confirm GitHub Pages will serve over HTTPS

Reference [DEPLOYMENT.md](../DEPLOYMENT.md) for the full deployment procedure.

Report findings as:
- **Status**: Ready / Needs Attention / Blocked
- **Issues**: List any problems found with recommended fixes
- **Deploy steps**: Summary of next actions to complete deployment
