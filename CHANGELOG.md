# Changelog

## [2.2.0] — 2026-06-17

### ✨ New Features

#### Terms of Service System
- Admins can now create, edit, and publish versioned Terms of Service documents via the new Admin TOS panel
- Publishing a new version increments the version number and sets it as the active document
- Any member with an accepted version lower than the current active version is prompted to re-accept on next login
- TOS modal blocks the app until accepted — members who decline are logged out immediately
- The SSE session stream now pushes a `tos_version_changed` event so the modal appears in real time without requiring a page reload
- Members can view the current Terms of Service at any time from the About Me page via the "View Terms of Service" button

#### Error Monitoring — GlitchTip
- Self-hosted GlitchTip is now part of the production stack (`glitchtip`, `glitchtip-db`, `glitchtip-redis`, `glitchtip-worker` containers)
- Backend integrates via `sentry/sentry-laravel` — unhandled exceptions and slow queries are captured automatically
- Frontend integrates via `@sentry/react` — JavaScript errors, unhandled rejections, and frontend traces are reported
- All error traffic is routed through `www.swc-joe.com/errors` (proxied in NPM) to bypass adblockers
- Discord DM alert: when GlitchTip fires its alert webhook, the backend parses the payload and sends a formatted DM to the configured Discord user ID with the error title, culprit, occurrence count, environment label, and a direct link to the issue

#### Session Replay — OpenReplay
- `@openreplay/tracker` and `@openreplay/tracker-assist` integrated into the frontend
- All inputs masked by default; email fields and text obscured; sensitive keys (`password`, `token`, `access_token`, `refresh_token`, `secret`) stripped from captured network payloads; `X-XSRF-TOKEN` and `Cookie` headers never sent to the replay service
- Session replay traffic is routed through `www.swc-joe.com/ingest` (proxied in NPM) to bypass adblockers
- Logged-in user identity (handle + user ID) is set on the tracker after every auth refresh and cleared on logout

#### Free Tool Access for Logged-In Users
- Any authenticated user (not just JOE members or subscribers) can now access the Hauler, Production Calculator, and Recycling Calculator from the Members toolkit
- DroidBrain now shows an upload-only view for logged-in users without full DroidBrain access, allowing them to contribute scan reports — search and browse remain subscriber/member only
- XP Tracker remains member-only (requires SWC OAuth event access)
- "Pull from SWC" skill buttons in the Production Calculator and Recycling Calculator are hidden when the user does not have SWC OAuth linked (previously always visible but would fail)

#### Admin — Kick from JOE
- New sysadmin-only action on the Users panel: "Kick from JOE" strips `is_joe_member`, revokes all SWC authorizations, and invalidates all active sessions in a single operation
- Action is logged under `kick_from_joe` in the admin action log

### 🐛 Bug Fixes

#### Astrogation Reward — Grids Lost When Pending Reward Already Exists
- Fixed a bug where a second astrogation upload in the same session that earned new grids would silently discard them if a `pending` payment item already existed for that user
- The service now detects an existing pending reward and merges the new grid counts and credit amounts into it rather than creating a duplicate (which was previously rejected by the unique constraint)
- The merged communication prefix, grid counts, and breakdown are all recalculated correctly on merge

### 🔧 Infrastructure

#### Monitoring Stack (docker-compose)
- `docker-compose.prod.yml` and `docker-compose.dev.yml` now include GlitchTip (web + worker + Postgres + Redis) and OpenReplay containers
- NPM ingestion proxy configuration documented in `docs/npm-ingestion-proxy.md` — `www.swc-joe.com/ingest` → OpenReplay, `www.swc-joe.com/errors` → GlitchTip
- New proxy hosts required: `glitchtip.swc-joe.com` and `openreplay.swc-joe.com`
- New env vars: `SENTRY_LARAVEL_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `GLITCHTIP_WEBHOOK_TOKEN`, `GLITCHTIP_ALERT_DISCORD_USER_ID` (backend); `VITE_GLITCHTIP_DSN`, `VITE_GLITCHTIP_TUNNEL`, `VITE_OPENREPLAY_KEY`, `VITE_OPENREPLAY_INGEST_URL` (frontend); `GLITCHTIP_DB_PASSWORD`, `GLITCHTIP_SECRET_KEY`, `GLITCHTIP_EMAIL_URL`, `GLITCHTIP_FROM_EMAIL`, `OPENREPLAY_DB_PASSWORD`, `OPENREPLAY_MINIO_USER`, `OPENREPLAY_MINIO_PASSWORD`, `OPENREPLAY_JWT_SECRET` (root compose)

---

## [2.1.4] — 2026-06-05

### ✨ New Features

#### Member Tools — RM Hauler
- New tool that calculates how many trips each ship or vehicle would need to haul a given cargo manifest
- Build a manifest by searching for raw materials and entering quantities — total weight (tonnes) and volume (m³) are calculated automatically
- Results table shows every hauler in the database ranked by trip count, with the limiting factor (weight or volume) highlighted per hauler
- Filterable by hauler type (all / ships / vehicles) and by a maximum trip count
- Manifests can be saved locally by name and reloaded in future sessions
- Export a haul plan for a specific hauler as a formatted Discord-ready message

#### Member Tools — Production Calculator
- New tool for planning production runs across ships, vehicles, facilities, stations, droids, weapons, items, and creature/NPC types
- Multi-row planner — add any number of entity types and quantities in a single session
- Per-entity and total material requirements aggregated across all rows with material prices applied
- Time estimates (min/max range) based on production modifier, management skill, civilisation level, and location modifier
- XP estimate per entity type
- Configurable settings: management level, civilisation level, location modifier, morale, crime, and tax rate
- Cost estimate ranges (min/max) including production cost factor and tax
- Aggregated materials list showing total quantities and credit costs across all rows

#### Member Tools — XP Tracker
- New tool that pulls a member's personal XP event history from SWC (up to 4 months)
- Displays total XP gained, breakdown by category (production, recycling, combat, skill upgrades, etc.), and a daily chart
- Average XP per active day calculated across the selected date range
- Date range filter to narrow the history window

#### Member Tools — Recycling Calculator
- New tool for JOE members that estimates recycling time, materials returned, and cost for any ship, vehicle, facility, or station
- Entity picker with typeahead search across all four categories
- Condition selector (Non-Wreck / Wreck) and recycler type (Vehicle / Ship / Station & Facility) with time multipliers matching SWC rules (×1.00 / ×0.60 / ×0.40)
- Pull repair skill directly from SWC profile via Chain Code with one click
- Per-material breakdown table showing required quantity, returned quantity, and lost quantity for each material
- Cost estimate based on 50% of RMP
- Time displayed in days, hours, minutes, and seconds
- Recycler type auto-sets based on selected entity category

#### Astrogation Location Page — In-System Grid
- Location pages (`/tools/universe/location/{x}/{y}`) now automatically load and display the full in-system grid for any system present at that chart coordinate
- Shows planets (with images), stations, and DroidBrain ships on the same interactive 20×20 zoom/pan grid as the system page
- DroidBrain Ships toggle in the system section toolbar works independently from the location grid's DroidBrain Intel toggle
- Cell selection opens a panel showing planets, stations, and ship cards with IFF badges and expandable type stats

#### Astrogation Location Page — DroidBrain Intel (Ship Grid Parity)
- Location page DroidBrain ship panel now matches the system page: expandable ship cards with IFF colour coding, IFF filter pills (Friend / Enemy / Neutral / Unknown), class filter dropdown, and ship type stat expansion (hull, shield, armour, hyperdrive, speed, etc.)
- Grid cell ship icon now picks the most significant ship class in each cell (same `biggestShip` logic as the system page)
- Hover tooltip shows IFF breakdown by status instead of a plain ship count
- Cell deselect works by clicking the active cell again, matching system page behaviour

#### Admin — Material Prices Panel
- New admin panel for managing raw material prices used by the Production Calculator
- Admins can set a credit price per unit for each material type
- Prices are applied automatically in the production calculator's cost breakdowns

#### Admin — Worker Health — DroidBrain Search Reindex
- New "Reindex DroidBrain Search" button in the Worker Health panel that manually queues a full search index rebuild for all DroidBrain tabs (ships, stations, planets, cities, vehicles, NPCs)
- Clears the unique job lock before dispatching so it always fires even if a previous run stalled or failed
- The `DroidBrainReindexJob` now processes records in chunks of 500 instead of calling `makeAllSearchable()` on the entire table at once, preventing the 504/timeout that caused the job to hit `MaxAttemptsExceededException` on large datasets
- Job timeout raised from 5 minutes to 1 hour to accommodate large index rebuilds

### 🐛 Bug Fixes

#### Payments — Communication Column Truncation
- Widened `payment_transfers.communication` from `VARCHAR(255)` to `TEXT` — long payment communication messages were silently failing with a data truncation error when the message exceeded 255 characters

#### Astrogation Upload — Auth Mode Retried on Every Page
- Fixed an issue where the upload renegotiated its SWC auth mode (`oauth` vs `bearer`) on every page of travel history fetched
- Once the first page succeeds, the confirmed auth mode is now locked in for the rest of the upload

#### Astrogation Reward — Duplicate Payment on Re-upload
- Fixed a `UniqueConstraintViolationException` crash where uploading astrogation data more than once in a session attempted to create a second `pending` payment record for the same user
- `PaymentItem::create()` replaced with `updateOrCreate()` matching on `source_type + source_id + status=pending`, so re-uploads update the existing reward in place rather than failing

#### Astrogation Location Page — Page Crash (`snapshotShips is not defined`)
- Fixed a runtime crash on `/tools/universe/location/` caused by references to `snapshotShips` and `snapshotTime` variables that were never declared
- Added missing `public_status` and `placementX`/`placementY` fields to the `StoredLocationDetail` ships type definition

#### Astrogation Location Page — Back Button Not Returning to Astrogation
- The manual "Back To Tools Overview" link at the top of the page navigated to `/tools` without passing route state, landing users on the overview instead of the Astrogation panel
- Removed the duplicate button — the `UniverseDetailHero` back button correctly passes `{ membersView: "universe" }` state

#### Astrogation Location Page — API 504 Timeout
- `/api/universe/locations/{x}/{y}` was timing out with a 504 on coordinates that have large DroidBrain scan archives
- The two `LIKE '%fieldstring%'` queries on raw XML/JSON blob columns now run inside a `MAX_EXECUTION_TIME=8000` guard — if either query exceeds 8 seconds it fails fast and returns `null` for the asteroid field rather than hanging the whole request

#### Galaxy Viewer — System Link UID Format
- Clicking a system on the galaxy map now uses the system UID directly (e.g. `9:178` → URL `/tools/universe/system/178`) by stripping the entity-type prefix
- Backend system lookup now falls back to `uid LIKE '%:{id}'` when a bare numeric ID is passed, so both formats resolve correctly

### ♻️ Refactors

#### Astrogation Location Page — Removed Unused Panels
- Removed the "Location Intel" and "Sector / Primary Label" info panels from the location page selection sidebar — data already visible in the hero header
- Cleaned up all unused imports and constants (`BBCodeView`, `META_CLS`, `LOCATION_STACK_CLS`, `LOCATION_LINE_CLS`, `LOCATION_NOTE_CLS`, `formatTimestamp`, `isSysadmin`)

---

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

### 🐛 Bug Fixes (Galaxy Map)

#### Galaxy Snapshot Meta — `$isFullTier` Undefined (Critical)
- Fixed an `ErrorException: Undefined variable $isFullTier` crash inside the `galaxySnapshotMeta` closure that was returning 500 on every `/universe/galaxy-snapshot/meta` request and breaking the map entirely for all users
- `$isFullTier` was only defined in `galaxySnapshotLayer()` and never passed into the `galaxySnapshotMeta` closure

#### Galaxy Map — Infinite Retry Loop on Server Error
- Fixed a frontend infinite retry loop: when the galaxy snapshot worker returned a server error it set `globalMapDataLoading = false` but never set `globalMapDataLoaded = true`, leaving both false and causing the load effect to fire endlessly
- Load attempts are now capped at 3 before stopping

#### Galaxy Map — Cache Version Never Bumped for DroidBrain / Unchanged Imports
- The cache version key `universe:search-records:version` was only bumped in `SearchRecordController` when `created + updated > 0`
- DroidBrain syncs, admin pulls, and astrogation imports where all records were unchanged never busted the cache — 654 modified records were invisible to the map
- Added `SwcSectorSearchRecordObserver` that sets a flag on any `saved()` event across all write paths; a single cache bump fires at request/job termination via `app()->terminating()`
- Reduced search records layer cache TTL from 120s to 30s as a safety net for any raw `DB::table()` paths that bypass Eloquent

#### Galaxy Map — `rescan_due_at` Never Updated After Fresh Visit
- When `importMatchedEvents` updated a record's `legacy_recorded_at` it never recalculated `rescan_due_at`, so old records (e.g. 3-year-old legacy imports) permanently showed the "rescan due" flag on the map even after a member visited them
- `rescan_due_at` is now recalculated as `legacy_recorded_at + 6 months` in the import payload and included in the `isChanged` check so stale values trigger a proper update

#### Galaxy Map — Stale IndexedDB Cache Applied Without Revision Check
- The IndexedDB snapshot was applied immediately on load without checking whether it matched the current server revision, meaning stale data could persist indefinitely if a user never triggered a reload
- `loadGalaxySnapshotData` now fetches the meta revision in parallel with the IndexedDB read and only applies the cached snapshot if revisions match
- Added a 60-second polling interval after first successful load to detect revision changes in the background

#### Galaxy Map — Layer Fetches Not Cache-Busted on Revision Change
- Layer fetch URLs had no version parameter, allowing the browser HTTP cache to serve stale layer data even after the server revision changed
- All layer fetches now include `?v={revision}` so the browser cache is bypassed whenever the server has fresh content

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
