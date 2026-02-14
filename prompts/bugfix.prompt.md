---
description: Reproduce, fix, and verify a bug with minimal code changes.
agent: agent
---

# Bug fix request

Bug report:
{{input:Describe the bug and expected behavior}}

Context:
- Affected files or symbols: {{input:Optional file/symbol hints}}
- Reproduction steps: {{input:How to reproduce}}

Constraints:
- Fix root cause, not just symptoms.
- Keep patch small and avoid unrelated refactors.
- Preserve existing behavior outside bug scope.
- Do not add frameworks or tooling.

Execution steps:
1. Confirm likely root cause from current code.
2. Apply the smallest correct fix.
3. Validate with targeted checks and/or reproduction steps.
4. Update docs only if user-visible behavior changed.

Success criteria:
{{input:What must be true for this to be considered fixed}}

Output format:
- Root cause
- Fix implemented
- Files changed
- Verification steps and results
- Remaining risks (if any)
