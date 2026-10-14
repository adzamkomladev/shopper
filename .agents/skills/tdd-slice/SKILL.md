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

## Architecture cleanup rules

Follow current `layout.md` and `code-quality.md`: no hyphens in authored paths (explicit stable/framework/generated/published exceptions); backoffice screens/components/queries/stores/hooks have separate homes nested by context; schemas and exported reusable types have owning modules; workflow modules each implement one responsibility. Reuse `@shopper/utils` SHA-256 without changing domain hash contracts. Assets use `@shopper/assets` for policy/tracking/grants and Blobs for provider transport; browser bytes upload directly to R2/RustFS and are bounded/verified immediately before processing. Never add an API byte-upload fallback. Verify both storage adapters and preserve public routes/subpaths.
