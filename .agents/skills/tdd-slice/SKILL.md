---
name: tdd-slice
description: Implement one planned slice test-first in Shopper - write failing integration or e2e tests, make them pass with the smallest change, then run every check. Use for any implementation or bug fix.
---

# Test-first slice

1. **Tests.** Write the slice's tests (or spawn `test-author`) following `docs/engineering/testing.md`.
   A bug fix starts with a test that reproduces it.
2. **Red.** Run `vp test --run <path>`. Every new test must fail for the expected reason. Fix the test
   setup if it fails for any other reason.
3. **Green.** Implement the smallest change (inline, or spawn `implementer`, or `ui-builder` for UI).
   Follow `code-quality.md`: reuse first, main export first, size limits, shared function + thin
   platform shells.
4. **Checks.** `vp check`, `vp run guard`, then the full `vp test --run` (or spawn `checker`).
   Repeat until clean.
5. **Tidy.** Reread the diff once as a reviewer would. Remove dead code, narrating comments, unused
   exports and duplicated helpers.
6. Next slice, or `pre-merge-review` when the plan is done.
