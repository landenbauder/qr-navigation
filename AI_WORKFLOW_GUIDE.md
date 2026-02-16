# AI Workflow Guide for QR Navigation

This guide is your day-to-day reference for using the Copilot workflow configured in this repository.

## Quick Cheat Sheet

Use this section when you need the fastest possible reminder.

### 1-minute mode picker

- Tiny local edit in one function: Inline suggestions or Inline chat
- New feature or scoped enhancement: `/feature`
- Bug with repro steps: `/bugfix`
- Multi-file or medium/high risk: Ask/Plan first, then Agent mode
- Before merge/deploy: Reviewer agent

### Daily default flow (short)

1. Start a fresh chat for one task
2. Run `/feature` or `/bugfix`
3. Include constraints + acceptance criteria
4. Implement minimal patch
5. Run validation checklist
6. Run reviewer agent
7. Update docs only if behavior changed

### Copy/paste ultra-short prompts

Feature:

```text
/feature
Task: [one sentence]
Constraints: keep UX unchanged; no new frameworks; keep offices.json compatibility
Acceptance criteria: [3 measurable bullets]
```

Bugfix:

```text
/bugfix
Bug: [what is wrong]
Repro: [numbered steps]
Expected: [correct behavior]
Success criteria: [2-3 measurable bullets]
```

Review:

```text
Review this change for scope drift, regressions (search/geolocation/routing/mobile UX), and offices.json compatibility.
Return verdict, prioritized findings, minimal fixes, and final pre-deploy checklist.
```

### Fast validation checklist

- [ ] App loads without console errors
- [ ] Office search still works
- [ ] Location permission flow still works
- [ ] Route generates for selected office
- [ ] Mobile layout remains usable

### Stop signs (restart or reframe)

- Prompt is vague (“make it better”)
- The chat includes unrelated history
- The AI is making broad refactors you did not ask for
- No measurable acceptance criteria are defined

## Goal

Use AI to ship reliable changes faster while keeping risk low.

This workflow is designed for:
- A static web app with vanilla JavaScript, HTML, and CSS
- Small to medium feature work
- Bug fixes with clear verification
- Safe iteration without unnecessary complexity

---

## What is already configured

- Global project instructions: `copilot-instructions.md`
- Reusable feature prompt: `.github/prompts/feature.prompt.md`
- Reusable bugfix prompt: `.github/prompts/bugfix.prompt.md`
- Focused reviewer agent: `.github/agents/reviewer.agent.md`

---

## The core workflow (default)

Use this sequence for almost every task:

1. Frame the task clearly
2. Pick the right interaction mode
3. Add targeted context
4. Plan before implementation (for non-trivial work)
5. Implement in small steps
6. Validate with explicit checks
7. Run reviewer agent before merge/deploy
8. Update docs only if behavior changed

---

## Step-by-step operating procedure

## Step 1) Frame the task

Write the request so it includes:
- Objective (what to change)
- Constraints (what must not change)
- Acceptance criteria (how success is measured)

Good example:
- “Improve office search matching in app.js, keep UI unchanged, preserve existing routing behavior. Success: partial name matches work for at least 5 known offices and no route regression.”

Avoid:
- “Make this better.”

---

## Step 2) Choose the right mode

Use this quick decision rule:

- Inline suggestions: tiny local edits while coding
- Ask/chat: understanding code, brainstorming, investigation
- Inline chat: focused in-place function/file edits
- Agent mode: multi-file implementation and tool-driven execution
- Plan mode: architecture, migrations, higher-risk work
- Reviewer agent: pre-merge or pre-deploy quality pass

For this repo, most tasks should be:
- Ask/chat -> Agent mode -> Reviewer agent

---

## Step 3) Add context intentionally

Before requesting implementation, include:
- Relevant files/symbols (for example app.js, offices.json)
- Errors from Problems panel if present
- Reproduction steps for bugs
- Expected output or acceptance criteria

Use context references to reduce ambiguity:
- #codebase for repository-wide search
- Specific file/folder/symbol references
- Web/repo fetch tools only when external reference is required

---

## Step 4) Use the reusable prompt files

## For feature work

Run:
- /feature

Then fill:
- One-sentence feature request
- Acceptance criteria with expected outcomes

Best use cases:
- New filtering behavior
- Routing logic enhancements
- UX improvements that keep existing architecture

## For bug fixes

Run:
- /bugfix

Then fill:
- Bug report
- Repro steps
- Success criteria

Best use cases:
- Search edge-case failures
- Geolocation/routing regressions
- Data validation issues

---

## Step 5) Plan before coding (when needed)

Always plan first if any of these are true:
- More than one file is likely to change
- Behavior is user-visible
- Regression risk is moderate/high
- You are unsure where root cause lives

A good plan has:
- Impacted files
- Ordered steps
- Verification steps per milestone

---

## Step 6) Implement in controlled increments

During implementation:
- Keep patches small
- Solve root cause, not symptoms
- Avoid unrelated refactors
- Preserve existing data compatibility

Project-specific guardrails:
- No new frameworks/toolchains unless explicitly requested
- Keep mobile-first behavior stable
- Keep geolocation/routing behavior compatible
- Keep offices.json schema assumptions intact

---

## Step 7) Validate every meaningful change

Use this validation ladder:

1. Targeted checks first (closest to changed logic)
2. Reproduction test for the original issue
3. Quick smoke check of adjacent behavior

Manual checklist template (copy/paste):

- [ ] App loads without console errors
- [ ] Office search returns expected results
- [ ] Location permission flow still works
- [ ] Route is generated for a selected office
- [ ] Route updates behave as expected while moving
- [ ] Mobile layout remains usable

---

## Step 8) Run reviewer agent before merge/deploy

Use the custom reviewer agent when:
- A feature is complete
- A bugfix is ready
- You are preparing deployment

Ask it to return:
- Verdict: pass / pass-with-notes / changes-requested
- Prioritized findings
- Minimal corrective actions
- Final regression checklist

This catches scope drift and hidden regressions.

---

## Step 9) Update documentation only when needed

Update docs when behavior, setup, or deployment steps changed:
- README.md for usage/behavior changes
- DEPLOYMENT.md for release/deploy changes
- qr-code-info.md for QR-related process changes

Keep doc updates short and task-specific.

---

## Daily quick-start (5-minute version)

1. Start a fresh chat for the task
2. Use /feature or /bugfix
3. Include acceptance criteria
4. Ask for a short plan if task is non-trivial
5. Implement
6. Run validation checklist
7. Run reviewer agent
8. Apply notes and finalize

---

## Complexity ladder (when to scale process)

## Level 1: Small local change
- Single file, low risk
- Use Ask or Inline chat
- Minimal validation

## Level 2: Standard change (most tasks here)
- Multi-step or moderate risk
- Use /feature or /bugfix + Agent mode
- Mandatory validation checklist
- Reviewer agent before finalize

## Level 3: High-risk change
- Multi-file, user-critical logic, possible regressions
- Ask -> Plan -> Agent implement -> Reviewer
- Strong acceptance criteria and explicit rollback plan

If a Level 2 task starts drifting, promote it to Level 3.

---

## Session management best practices

- Start a new session for unrelated tasks
- Keep one objective per thread
- Remove stale context when direction changes
- Use follow-up prompts to course-correct early
- Use subagents for isolated research to avoid context pollution

Signs you should restart session:
- Repeated misunderstanding
- Model using outdated assumptions
- Prompt history now contains unrelated work

---

## Prompt quality checklist

Before sending a prompt, verify:
- Is the objective specific?
- Are constraints explicit?
- Are acceptance criteria testable?
- Did you include the right files/context?
- Did you specify what not to change?

If any answer is no, revise prompt first.

---

## Copy/paste prompt templates

## Template: feature

Implement this feature:
[one-sentence objective]

Constraints:
- Keep existing UX unchanged except where stated
- No new frameworks or tooling
- Preserve offices.json compatibility

Acceptance criteria:
- [criterion 1]
- [criterion 2]
- [criterion 3]

Validation:
- Provide manual test checklist and results.

## Template: bugfix

Fix this bug:
[bug description]

Reproduction steps:
1. [step]
2. [step]
3. [step]

Expected behavior:
[expected]

Success criteria:
- [criterion 1]
- [criterion 2]

Validation:
- Confirm root cause and show verification results.

## Template: review

Review the completed changes for:
- Scope alignment with the request
- Regression risk (search, geolocation, routing, mobile UX)
- Data compatibility with offices.json

Return:
- Verdict
- Prioritized findings
- Minimal fixes
- Final pre-deploy checklist

---

## Common failure patterns and corrections

Pattern: Vague prompt
- Fix: Add measurable acceptance criteria

Pattern: Too much context noise
- Fix: Start a fresh session and provide only relevant files

Pattern: Scope drift
- Fix: Re-state constraints and ask for minimal patch only

Pattern: “Looks right” but not verified
- Fix: Require checklist with explicit pass/fail results

Pattern: Overengineering
- Fix: Reassert project constraints (static app, vanilla JS, minimal changes)

---

## Maintenance cadence

Weekly or bi-weekly:
- Prune instruction rules that are no longer needed
- Add new recurring prompt patterns to prompts/
- Update reviewer checklist if new risk areas appear

After major incidents:
- Add a new acceptance criterion pattern
- Add a regression test/checklist item to prevent recurrence

---

## One-page mental model

- Be specific
- Give context
- Plan when non-trivial
- Implement minimally
- Verify explicitly
- Review before deploy
- Keep sessions clean

If you follow those seven points consistently, quality and speed both improve.
