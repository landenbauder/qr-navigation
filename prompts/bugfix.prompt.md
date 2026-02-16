---
name: bugfix
description: Reproduce and fix a bug with minimal changes.
agent: agent
---

# Bugfix

${input:bug:Describe the bug}
Fix this bug with a minimal patch.

Include:
- root cause
- files changed
- verification steps
Expected behavior:
${input:expected:What should happen}

Success criteria:
${input:success:How you will verify it is fixed}

Fix root cause, keep patch minimal, avoid unrelated refactors, and report verification steps.
