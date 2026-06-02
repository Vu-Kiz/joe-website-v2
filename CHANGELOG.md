# Changelog

## [2.1.3] — 2026-06-02

### 🐛 Bug Fixes

#### Astrogation Upload — Cursor Wipe
- Fixed a bug where the upload cursor (`last_uploaded_timestamp`) was silently dropped every time the galaxy map camera moved
- The preferences save endpoint was normalising universe preferences and only preserving 4 known keys, discarding `system_updater` entirely
- This caused every subsequent upload after any map interaction to re-process all SWC events from the beginning and find them all unchanged
- Cursor is now preserved correctly through preference saves

#### Astrogation Upload — SWC Authorization Context
- Fixed priority order for SWC `PAYMENTS` context in token lookups — was incorrectly falling through to the member tools auth before checking the dedicated payments auth

### ✨ New Features

#### Entity Stats — CSV Export
- Members, subscribers, and admins can now export entity stats to CSV directly from the Entity Stats pages
- Supports all entity types: stations, ships, vehicles, facilities, items, weapons, droids, creatures, NPCs, races, terrain, materials, planets
- Exports all fields including linked weapons, raw materials, skills, terrain restrictions, shield arcs, and images with human-readable column headers
- Member/subscriber export available via `/universe/entity-stats/{type}/export.csv` (public tool access)
- Admin export available via `/admin/entity-stats/{type}/export.csv` (sysadmin) with full field set

#### Admin — Astrogation Upload Logs Panel (Sysadmin → Audit)
- New sysadmin panel showing all members' astrogation upload history across the site
- Columns: handle, events seen, events matched, new grids, updated, unchanged
- Server-side pagination (25/page) with date range and handle search filters
- Expandable detail per upload showing rewarded grids (rule, coords, square name, asteroid marker, credit amount) and imported grids that did not qualify for reward with reason (previous record date shown for updated grids subject to the 1-year rule)
- Pre-migration logs (no reward data stored) fall back to showing the raw imported areas

#### Admin — Pull Events for Member
- Sysadmin can trigger a full SWC event pull for any member directly from the Astrogation Uploads panel
- Bypasses the upload cursor — fetches all events from the beginning so stuck or missing data can be recovered
- Runs the full import and reward payment logic identically to a member's own upload
- Result card shows events seen/matched, pages fetched, new/updated/unchanged/skipped counts, rewarded grids with rule breakdown, and grids imported without reward
- Admin action logged as `admin_pull_personal_events`

#### Admin — Action Log & Member Access Log Improvements
- Added Refresh button to Action Log and Member Access Log panels (previously required a full page reload to see new entries)
- Action Log now has a "Load" selector (100 / 250 / 500) to fetch more entries from the server
- Both panels' table containers now always support horizontal scroll — previously `overflow-hidden` clipped content on wider tables

### ♻️ Refactors

#### AstrogationImportService
- Extracted all shared import logic (event collection, parsing, grid import, cursor read/write, sector lookup) from `SearchRecordController` into a dedicated `AstrogationImportService`
- Both the member-facing upload and the new admin pull share the same service, ensuring consistent behaviour

#### Reward Breakdown Stored on Import Log
- `swc_member_import_logs` now stores a `reward_breakdown` JSON column populated at import time
- Each entry records which grids triggered a reward, the rule that applied, and the credit amount — no longer requires cross-referencing `PaymentItem` records

---

## [2.1.2] — 2026-05-25

### ✨ New Features

#### Support Ticket System
- JOE members and active subscribers can now submit bug reports directly from the site
- Tickets include tool, severity level (Tool Breaking / Major Bug / Minor Bug / Visual/UI), title and description
- Full threaded reply system — members and admins can exchange messages on a ticket
- Ticket status tracking: Open → In Progress → Resolved
- Discord PM notification sent to the configured support recipient when a ticket is created or replied to
- Admin panel for reviewing, replying to, and resolving all tickets
- Configurable support recipient (admin/sysadmin with a linked Discord account) via admin settings

#### Job Pay Rates & Claims
- Admins can define pay rate tables per job type
- Members can submit pay claims against completed jobs
- Admin panel to review and approve or reject pay claims
- Pay claim panel in the members area showing claim history and status

#### Internal Market — Stock Listings
- Sellers can now create stock-based listings backed by a quantity pool
- Buyers purchase from the stock; quantity decrements automatically
- Supports multi-unit purchases from a single listing

#### RM Browser
- New admin-granted privilege for accessing the RM Browser tool
- Members with access can view and filter JOE raw materials inventory
- Faction picker, filter bar and results table
- Replaces the legacy Jawanet workflow

#### Tool Subscription Platform (foundation)
- Full subscription plan infrastructure: plans, seat tiers, faction deals
- Subscriber cell record tracking
- Subscription revocation system with audit trail
- Force-subscriber and lock-JOE-flags controls per user

### 🔧 Improvements

#### Discord Bot
- Support ticket DMs now correctly delivered to the configured recipient (previously `support_ticket` key was not included in the direct outbox claim — fixed)
- "Raised by" in ticket notifications now shows the member's SWC handle or Discord name instead of their raw Discord user ID
- Outbox worker now supports a `delete` action — can remove previously sent Discord messages
- `delete` action type added to backend type definitions

#### Internal Market
- Market listing cards refreshed
- Bundle item support on listings
- Entity snapshot stored at listing time
- Custom fields and watermarked image support
- Audience scoping (who can see a listing)
- Fulfillment and reservation service improvements

#### Admin Panel
- Admin nav preferences — admins can customise and reorder their navigation
- Admin nav favourites support
- New panels: Job Pay Claims, Job Pay Rates, Support Tickets

#### DroidBrain
- Upload queue system for background processing
- Index status tracking
- Payment status tracking on uploaded files
- DroidBrain upload panel improvements

#### Members Area
- Member skill snapshots with skill plan support
- Fleet Commander access flag per user
- Public tool preferences stored per user
- Cell annotation ownership now tracked per user and per faction

#### Combat & Rewards
- Modified-too-recent count tracking on reward logs

### ♻️ Refactors

#### Frontend API Layer
- All API files reorganised from a flat `src/api/` directory into logical subdirectories:
  - `api/admin/` — admin-only endpoints
  - `api/core/` — auth, client, health, time, upload
  - `api/content/` — blog, loading tips, tenets, EOTM
  - `api/jobs/` — jobs, pay rates
  - `api/market/` — market, extensions, tool store
  - `api/members/` — members, payments, DroidBrain, fleet commander, etc.
  - `api/payments/` — payments
  - `api/support/` — support tickets
  - `api/universe/` — universe, factions

#### Styling
- Migrated all component styles from SASS to Tailwind CSS
- Removed: all `src/styles/_*.sass` partials and module files
- Added: `src/styles/tailwind.css`

#### Common Components
- New `Btn` component — unified button with variants
- New `CreditInput` component — credit amount input with formatting
- New `SlideTabNav` component — animated tab navigation
- Removed: `HealthStatus` component (health endpoints retired)

### 🗑️ Removed
- `HealthController`, `HealthPageController`, `MetaController` — health and meta endpoints retired
- Legacy flat API files replaced by the new organised structure

---

## [2.1.1] — 2026-05-21

- Worker stuck issue fix
- Minor stability improvements

## [2.1.0] — 2026-05-14

- Full mobile responsive implementation (SCSS-only, desktop unaffected)
- 13-step mobile plan delivered across navbar, panels, maps and all major views

## [2.0.9] — prior

- See git history
