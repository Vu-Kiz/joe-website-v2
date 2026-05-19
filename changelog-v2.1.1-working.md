# Changelog – v2.1.1 (Working Draft)

Next ID starts at: **81**
Release date: TBD

---

## Entries

### 1 — Stat Planner: save & load plan
- **Tool:** Fleet Command
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

## Notes / Reminders

- Keep `sort_order` sequential starting from 1
- Audiences: `all`, `members`, `admin`, `sysadmin`
- Tools examples: Members Tools, Fleet Command, DroidBrain, Admin, Tools Store, Astrogation, Hyper Planner, Entity Stats, Targeting Heatmap
