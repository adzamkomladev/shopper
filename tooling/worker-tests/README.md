# Worker integration runner

Cloudflare's legacy `@cloudflare/vitest-pool-workers@0.22.0` uses an August workerd
binary that rejects the October compatibility date. Its replacement,
`@cloudflare/vitest-plugin@1.3.6`, runs the current date but supports Vitest 4.1.
The direct Vite+ / Vitest 5 probe failed during Worker startup because
`@vitest/utils/display` no longer exports `objDisplay`, which the plugin runner
requires.

This workspace pins Vitest 4.1.9 and the current Cloudflare plugin. The root
`vp test` suite invokes it directly and fails if the Worker suite fails.
Run it on its own with `vp -C tooling/worker-tests exec vitest run`.
Recheck Vitest 5 compatibility before removing this fallback.

Day 3 adds D1/R2/StoreSequencer conformance against real local PG18. Run through
root `vp test --run tests/worker.test.ts`: the harness migrates a fresh database,
passes its URL as `CF_TEST_DATABASE_URL` to Miniflare's Hyperdrive binding, and
always drops it afterwards. Direct runner use requires an already migrated test
database via `CF_TEST_DATABASE_URL`.

Vite 8's Rolldown optimizer eagerly lifts pg's optional `pg-native` dependency.
The config prebundles the installed pg ESM entry with esbuild, which preserves
that lazy require. This uses the real pg driver and real TCP; no database mock or
native driver replacement is involved. The generated bundle is in ignored `.vite`.
