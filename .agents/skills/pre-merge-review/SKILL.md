---
name: pre-merge-review
description: Review Shopper changes before commit or PR using Codex (gpt-6.1-sol) plus a rules checklist, and the ui-reviewer for UI changes. Use before every commit, PR, or when the user asks for a review.
---

# Pre-merge review

1. Run `vp check`, `vp run guard`, and `vp test --run`. Fix failures first; review a red build only
   if the user asks.
2. Spawn the `reviewer` agent (or follow `.agents/roles/reviewer.md` inline). It runs
   `codex review` on `gpt-6.1-sol` and verifies each finding.
3. If any `.tsx`, CSS, or UI package changed, also spawn `ui-reviewer`.
4. Fix every confirmed finding, rerun the checks, and rerun the review if the fixes were not trivial.
5. Report: the findings fixed, the findings rejected with reasons, and the final check results.
