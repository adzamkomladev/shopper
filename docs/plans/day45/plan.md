# Day 45: release Shopper v1.0

Notion row "45 · Release Shopper v1.0". Done when Shopper v1.0 is live.

## Slices

- **S1 Regression**: every CI command locally on a reset database (check, guard, typecheck, build, all integration
  including both adapters' conformance, `machine`, chaos, e2e, public e2e). Fix anything that fails at its cause.
- **S2 Guides**: `docs/guides/{cloud,box,admin,migration}.md`, labels checked against the app.
  `tests/integration/release/guides.test.ts` (written first) keeps their links and `vp run` scripts real.
  `docs/pilot/manager.md` points to the owner guide; AGENTS.md lists the guides.
- **S3 Version**: `package.json` 1.0.0 (the only product version), `docs/releases/1.0.0.md`, release checklist step 7.
- **S4 Retro**: [retro.md](retro.md) with the next-phase backlog; [verification.md](verification.md).

## After merge

Tag `v1.0.0` on the merge commit, publish the GitHub release from `docs/releases/1.0.0.md`, cancel the stale
`Release cloud` runs, dispatch `Release cloud` (promote) and `Release till`. Both wait for the owner's approval in
GitHub. Till pilot → stable (`vp run till:promote`) once the pilot shop has run the build.

## Not doing

No screens (the Figma file has no release frame and the day adds none), no till-promotion workflow, no app package
version bumps.
