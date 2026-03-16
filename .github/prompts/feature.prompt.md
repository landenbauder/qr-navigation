---
name: feature
description: "Implement a scoped feature with minimal risk and clear validation."
agent: agent
---
# Feature Implementation

## Feature Description
${input:feature:Describe the feature in one sentence}

## Affected Area
${input:area:Which part of the app? (search, routing, UI, data, panorama)}

Implement this feature with minimal risk. Follow these guidelines:
1. Plan the change before coding — identify affected files and potential regressions
2. Make the smallest change that delivers the feature
3. Keep existing UX unchanged except where the feature requires it
4. No new frameworks or build tools
5. Preserve `offices.json` schema compatibility

Include in your response:
- **Summary**: What was implemented
- **Files changed**: List each file and what was modified
- **Risk assessment**: Low / Medium / High — and why

## Validation Steps
After implementing, verify:
- [ ] App loads without console errors
- [ ] The new feature works as described
- [ ] Office search still works
- [ ] Location permission flow still works
- [ ] Route generates for selected office
- [ ] Mobile layout remains usable
- [ ] No unrelated changes were introduced
