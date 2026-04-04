# JOE Website V2

Jawa Offworld Enterprises website and member tools.

## Current Version

- Production release: `v2.0.1`
- Active development branch: `v2.0.3`

## Branch Status

- `dev` is the working branch for `v2.0.3` updates
- production should only receive pulled, tested changes from `dev`

## Notes

- `v2.0.1` is now the live production patch release
- `v2.0.2` is the completed release/update cycle
- `v2.0.3` is the next active update cycle
- larger new work should be planned deliberately instead of being folded into patch updates

## v2.0.1 Status

- `v2.0.1` is complete and live in production
- this section reflects the released patch scope

Included updates:

- Members tools
  Small auth/access and UI cleanup around members tools, plus Entity Stats relationship linking and per-tab compare tools.
- Payments and content
  Payment transfer builder cleanup, SWC credit-log sync fixes for recent transfers, and GIF upload support for JEN images.
- DroidBrain
  Import fixes, duplicate reprocessing support, and general polish.
- Astrogation
  Map legend usability improvements, asteroid UID backfill, map note marker improvements, and sector-view loading by grid coordinates instead of sector ownership.
- Hyper Planner
  Route-finding improvements and faster-route selection polish.

## v2.0.2 Release Notes

- `v2.0.2` is the current active release/update cycle
- this section reflects the shipped and release-facing scope for the update

Included updates:

- Discord bot
  New Discord bot app built with Sapphire + TypeScript, backend bot auth and outbox delivery, Discord channel setup commands, guild sync, admin bot visibility, JEN/Jobs announcement delivery through the site instead of standalone webhook logic, and cleaned example env/ignore rules so the bot setup is safer to ship and document.
- Admin and access control
  Forced logout support, realtime session invalidation, friendlier permission error messaging, sysadmin controls for bot management, and frontend tools to boot active users when access changes.
- Backend resilience
  Higher API throttle headroom, cached heavy read endpoints, restored dev worker support, queue retry timing fixes for long-running sync jobs, and dev worker permission fixes to keep background refreshes stable.
- Universe and hyperlane tooling
  Stored system refresh fixes, safer system UID fallback handling, corrected system ownership persistence so child entities do not overwrite system owners, continued Hyper Planner / system pull reliability work, and a fix so JOE members can use Hyper Planner without hitting sysadmin-only refresh endpoints.
- Members and content
  Galactic Archive first pass remains sysadmin-gated while it is refined, and JEN Discord delivery now supports richer formatting, image handling, and update-in-place behavior.

## v2.0.3 Patch Notes

- `v2.0.3` is the current active release/update cycle
- this section tracks current patch-facing changes being prepared for release

Included updates:

- Admin health and ops visibility
  Added a sysadmin-only Website Health panel with backend runtime checks, queue freshness reporting, Discord bot health visibility, browser-side frontend path checks, and clearer release/version display using the webapp package version.
- Members navigation and overview flow
  Simplified the main navbar so `Tools` opens the members tools area directly, kept payment alert styling on the button, and added an admin-first members overview card so admin and sysadmin users can jump straight into admin controls from the tools page.
- DroidBrain browsing
  Changed DroidBrain search to explicit submit instead of live refetching on every keystroke, allowed bare numeric UID matching without requiring the stored SWC prefix form, and hid per-entity history from regular JOE member view while keeping full history for intel/sysadmin access.
- Discord bot presence
  Added an explicit Discord bot presence/status on startup so the bot shows a deliberate activity in Discord instead of the default connection state.
- Frontend polish and auth responsiveness
  Improved navbar logout responsiveness so auth-dependent navigation clears immediately when the user signs out or their session changes.
