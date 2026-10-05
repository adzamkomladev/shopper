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
