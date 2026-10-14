# Organization management authority

Approved by the owner on 14 October 2026. This cleanup records the architecture; implementation of new hosts and commercial services stays in the scheduled feature work.

| Responsibility                           | Cloud organization                                        | On-prem organization                                                  |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Stores, branches, products, staff        | Cloud PostgreSQL through shared Hono API                  | Box PostgreSQL through the same API                                   |
| Management UI                            | Portal SPA and Electron using `@shopper/backoffice`       | Local box SPA and Electron using the same components                  |
| No WAN                                   | Explicit supported offline till operations                | LAN management and tills continue against box                         |
| No connection to authoritative API       | No implicit permission to mutate cached organization data | Same; losing LAN differs from losing WAN                              |
| Subscription and payments                | Cloud control plane                                       | Cloud licence/support/payment services when online                    |
| Storage, backup and account provisioning | Cloud control plane                                       | Local installation settings; optional cloud services when online      |
| Optional cloud sync                      | Scoped versioned contracts                                | Box remains operational authority; no implicit two-writer replication |

The local portal retains TanStack Router SPA. The box serves its built assets and shared Hono API; SSR adds no needed capability to this authenticated LAN management flow. TanStack Start remains the customer shop. Electron is a host for shared management components and till functionality, not a separate organization-management implementation.

Cloud control-plane availability must not become a prerequisite for local trading. Changes to authority, optional synchronization and supported disconnected desktop mutations require explicit product contracts and tests. Existing versioned till synchronization remains its own defined flow.

Current implementation: portal mounts `createBackofficeRoutes(rootRoute)` and owns its router/query client; Electron is still a metadata placeholder. The box serves Hono API but production embedded portal delivery remains scheduled box work. Do not describe either future host as implemented by this cleanup.
