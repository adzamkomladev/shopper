# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Cashiers** at the till: high-volume checkout in busy Ghanaian supermarkets, keyboard-first, often with unreliable connectivity.
- **Store managers and owners**: back office work such as catalogue, prices, stock, reports and books (ledger).
- **Online shoppers**: customers using the storefront (`apps/shop`), likely on phones.
- **Platform operators**: staff running tenant onboarding, KYB and billing through `apps/admin` and the cloud portal.

## Product Purpose

Shopper is an offline-first supermarket POS for Ghana. The till keeps selling when the network is down; stores sync to the cloud when it returns. Success is a cashier who never waits on the system, and a manager whose reports match the ledger.

## Positioning

Offline-first and Ghana-native. One codebase runs on Cloudflare Workers (cloud) and as a sealed on-prem Bun box. Ghana tax rules (VAT, NHIL, GETFund, COVID levy), GHS money, mobile money and Ghana Card identity are built in, not bolted on.

## Operating Context

- Tills render their own receipts and PDFs from receipt JSON, and drive thermal printers and other hardware.
- The back office (`@shopper/backoffice`) runs in the cloud portal, the local box SPA and Electron.
- The box is authoritative for on-prem operations; cloud control-plane management and sync are separate.
- Surfaces are checked at desktop, laptop, tablet, mobile and till sizes.

## Capabilities and Constraints

- Money is integer (1 GHS = 10000); quantities are thousandths; rates are basis points.
- Permissions are data, not role checks. Every mutation is audited.
- UI uses `@shopper/ui` (shadcn/ui, Tailwind v4, Figma tokens). No React effects. Every action on the till has a keyboard shortcut. Every state is designed (loading, empty, error, offline).
- Skeletons must not shift layout when data arrives.

## Brand Commitments

Figma is the design source of truth, with tokens in `@shopper/ui`. No other brand assets, logo or voice rules are recorded yet.

## Evidence on Hand

Engineering docs in `docs/engineering/` (notably `frontend.md`) and the pilot docs in `docs/pilot/`. No customer testimonials, benchmarks or pricing exist in the repo; do not fabricate them.

## Product Principles

1. The till never blocks: offline is a normal state, not an error.
2. Speed and keyboard flow beat decoration on operator surfaces.
3. Numbers are trustworthy: reports read the ledger, never a second derivation.
4. Built for Ghana first: local tax, currency, payments and identity are first-class.
5. Every screen is designed, with every state considered. No slop.

## Accessibility & Inclusion

WCAG AA. English only for now. Keyboard operability is required on the till and back office.
