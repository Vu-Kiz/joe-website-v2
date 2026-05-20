# Changelog – v2.1.1 (Working Draft)

Next ID starts at: **85**
Release date: TBD

---

## Entries

### 1 — Stat Planner: save & load plan
- **Tool:** Biometrics
- **Audiences:** members, admin, sysadmin
- **Details:** The Stat Planner now lets you save your skill build server-side so it persists across devices. If you have a saved plan, a Load Plan button appears when you open the planner. Once loaded, the button becomes Overwrite Plan to update it with your current build.
<!-- Fields: title, details, tools, audiences (all / members / admin / sysadmin), sort_order -->

---

### 2 — Astrogation: mobile cell selection fix
- **Tool:** Astrogation
- **Audiences:** all
- **Details:** On mobile, tapping a grid cell no longer hides it behind the info panel. The map now offsets the selected cell toward the top of the screen so it sits above the bottom drawer. The drawer also slides up smoothly and has slightly more height for easier reading.

### 3 — Astrogation: preferences save loop fix
- **Tool:** Astrogation
- **Audiences:** sysadmin
- **Details:** Fixed a bug where opening Astrogation triggered repeated calls to the preferences save endpoint on load. The universe preferences effect was re-firing every time a save completed because `swcAuth` was in the dependency array and the save itself updated `swcAuth`. Moved to a ref pattern to break the loop.

### 4 — RM Browser
- **Tool:** RM Browser
- **Audiences:** admin, sysadmin (+ members granted `can_access_rm_browser`)
- **Details:** New tool to browse raw materials across all three JOE faction inventories — Jawa Offworld Enterprises, GARRY, and RAID. Filter by sector, system, and material name. Results are fetched from the SWC API using a designated service account and paginated client-side. Access is controlled via a new `can_access_rm_browser` privilege granted by admins in the user management panel.

---

### 5 — Rounding error
- **Tool:** Website
- **Audiences:** all
- **Details:** A member was paid 999,999.9999999999 credits instead of 1,000,000. We have rounded this up to 1,000,000. We have also rounded their complaints down to 0.

---

### 6 — Astrogation: updated grid reward fix
- **Tool:** Astrogation
- **Audiences:** members, admin, sysadmin
- **Details:** Fixed a bug where re-scanning a grid that hadn't been updated in over a year never triggered the update reward. The previous scan timestamp was being captured after the database record was saved, so it always matched the new timestamp and the 365-day age check always failed. The old timestamp is now captured before saving, so qualifying updates correctly generate a payment.

---

### 7 — Payments: merged communication message
- **Tool:** Payments
- **Audiences:** admin, sysadmin
- **Details:** When multiple pending payment items for the same recipient are paid together in one transfer, the SWC credit communication message now combines all individual reason prefixes into a single message separated by " | " (e.g. "Astrogation search reward: 2 new DS = 200,000 credits | Job reward: Pilot run | Monthly stipend [JOE-XFER-...]"). Previously only the first item's reason was used.

---

### 8 — Payments: select all items for a recipient
- **Tool:** Payments
- **Audiences:** admin, sysadmin
- **Details:** Each pending payment recipient card now has a "Select all" checkbox in the header. Checking it selects all items in that group at once; unchecking deselects them all. The checkbox is disabled when selection is already locked to a different payer.

---

## Notes / Reminders

- Keep `sort_order` sequential starting from 1
- Audiences: `all`, `members`, `admin`, `sysadmin`
- Tools examples: Members Tools, Fleet Command, DroidBrain, Admin, Tools Store, Astrogation, Hyper Planner, Entity Stats, Targeting Heatmap
