# Day 27 · Windows: packaging and auto-update

**Done when:** a signed installer from CI installs on Windows, enrols, and updates itself from the feed, without
ever interrupting a shift.

## Slices

| Slice | What                                                                                                                                                           | Tests first                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| S1    | Version gate: `minTillVersion` and `updateChannel` in the sync handshake; a till below the minimum finishes its shift but opens no new one (`UPDATE_REQUIRED`) | `tests/integration/sync/version.test.ts`, `handshake.test.ts`                                       |
| S2    | `org.update_channel` (migration `0035_updates`), `POST /platform/tenants/:orgId/channel` (`platform.tenant.update`, audited), the admin Till updates column    | `tests/integration/platform/channel.test.ts`, `tests/e2e/admin/channel.spec.ts`                     |
| S3    | electron-updater in main: feed per channel, download in the background, install on quit, or at once when required with no shift open                           | `tests/integration/till/updates.test.ts`                                                            |
| S4    | NSIS x64 installer config, Azure Trusted Signing, first run writes `register.json` and opens enrolment                                                         | `tests/integration/tooling/till/package.test.ts`, `tests/integration/till/electron/package.test.ts` |
| S5    | `till:release` (pilot) and `till:promote` (pilot to stable plus the download alias) against R2/RustFS                                                          | `tests/integration/tooling/till/release.test.ts`                                                    |
| S6    | Sentry in main with scrubbed events                                                                                                                            | `tests/integration/till/crash.test.ts`                                                              |
| S7    | Update required screen, shell banner, Retry (`register.update.check`), channel in About                                                                        | `tests/e2e/till/ui/update/screen.spec.ts`                                                           |
| S8    | `till-windows` CI job (build, silent install, first start, uninstall), `Release till` workflow, docs                                                           | CI                                                                                                  |

## Decisions

- **x64 only.** `better-sqlite3-multiple-ciphers@13.0.3` has no win32-ia32 prebuild, and adding a native rebuild
  needs the owner's say.
- **Policy at the handshake.** The till reads the minimum and channel once per connection (`ponytail` note in
  `packages/adapters/box/src/till/host/updates.ts`). A raised minimum reaches a running till at its next handshake.
- **The handshake schema is no longer strict**, so later fields do not break older tills. Tills built before this
  change reject the new fields; none is installed in a shop yet.
- **The update screen comes after sign-in**, because Restart now needs a signed-in user with `register.settings`.
  Before sign-in, main still installs a required update by itself.
- **No icon.** There is no brand mark yet; the designer supplies it.

## Owner actions

1. Create the R2 bucket `shopper-till-releases`, its custom domain and an Object Read & Write token; set the
   `till-release` environment's `SHOPPER_TILL_RELEASE_*` secrets and `SHOPPER_TILL_UPDATE_URL` variable.
2. Azure Trusted Signing: the three `AZURE_*` secrets and four `AZURE_TRUSTED_SIGNING_*` variables.
3. A Sentry project; set `SHOPPER_SENTRY_DSN` on the environment.
4. Set `SHOPPER_MIN_TILL_VERSION` per environment (empty until the first release).
5. Move the pilot org to `pilot` on the admin Tenants list.
6. The app icon from the designer.
7. The manual milestone: install the signed build on a real Windows till, enrol it, release a higher pilot build and
   watch it update after the shift closes.
