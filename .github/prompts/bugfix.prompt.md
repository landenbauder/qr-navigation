---
name: bugfix
description: "Reproduce and fix a bug with minimal changes, including project-specific verification."
agent: agent
---
# Bugfix

## Bug Description
${input:bug:Describe the bug — what is happening wrong?}

## Expected Behavior
${input:expected:What should happen instead?}

## Success Criteria
${input:success:How will you verify it is fixed?}

Fix this bug with a minimal patch. Follow these steps:
1. Identify root cause — read the relevant code before changing anything
2. Make the smallest change that fixes the root cause
3. Avoid unrelated refactors
4. Preserve existing behavior for all unaffected paths

Include in your response:
- **Root cause**: Why the bug happens
- **Files changed**: List each file and what was modified
- **Verification steps**: How to test the fix

## Project Verification Checklist
After fixing, verify:
- [ ] App loads without console errors
- [ ] Office search still works
- [ ] Location permission flow still works
- [ ] Route generates for selected office
- [ ] Mobile layout remains usable
- [ ] The specific bug is resolved per success criteria
