# Onboarding hierarchy UI design

**Date:** 2026-11-10  
**Status:** Approved  
**Page:** `/projects/new` (plan details step)

## Problem

The current plan page shows Features, Milestones, and Deliverables as three sibling cards. Deliverables use an optional “Linked milestone” dropdown (including “No milestone”). That implies features/milestones/deliverables are peers and that deliverables can exist without a milestone — which conflicts with the product model and the backend create contract (deliverables nest under milestones). Features are a separate project-level scope list, not part of the milestone tree.

## Hierarchy (source of truth)

```
Project
├── Features[]          # product scope — flat strings on create; not dated; not nested
└── Milestones[]        # dated checkpoints (health dashboard progress)
    └── Deliverables[]  # concrete work owned by exactly one milestone
```

- **Features ≠ deliverables.** Features are high-level capabilities used for scope / later activity interpretation.
- **Deliverables belong to milestones.** Multiple deliverables make up progress toward one milestone — never the reverse nesting of features under deliverables.

## Chosen layout: Option A (nested under milestones)

Single-page plan details (existing stepper step 2). Main column order:

1. **Project summary** — unchanged (name, summary, deadline, owner, team).
2. **Major features** — labeled as product scope; visually separate from the timeline; fields remain title / owner / detail. Copy must state features are not dated and not nested under milestones.
3. **Milestones & deliverables** — one card. Each milestone is a block containing:
   - Milestone fields (title, target date, detail)
   - Nested “Deliverables for this milestone” list (title, owner, drag handle)
   - “+ Add deliverable” scoped to that milestone
   - “+ Add milestone” at the card footer
   - Drop target: the whole deliverables region of a milestone (highlight on drag-over)

Sidebar (import, warnings, plan quality, continue, draft status, how-it-works) stays structurally the same; how-it-works / quality copy should reinforce the hierarchy.

### Removed

- Standalone `DeliverablesCard`
- “Linked milestone” / “No milestone” select

### Alternatives considered (not chosen)

- **B · Split columns:** Features left, timeline right — stronger separation, busier on narrow screens.
- **C · Sub-steps:** Scope then Timeline as separate steps — clearer teaching, more clicks; deferred.

## Interaction rules

| Action | Behavior |
|---|---|
| Add deliverable | Always attaches to the enclosing milestone (`milestoneId` set automatically). |
| Remove deliverable | Removes that row only. |
| Move deliverable | **Drag and drop** a deliverable from one milestone’s list onto another milestone’s deliverables region. Updates `milestoneId` to the target milestone. Dropping onto the same milestone may reorder within that list if order is preserved in the draft array; cross-milestone drop always reassigns ownership. Pointer/keyboard: drag handle is the grab affordance so text fields stay editable; provide a small “Move to…” fallback control (or milestone select on the row menu) for accessibility when drag is unavailable. |
| Remove milestone | **Confirm first.** Confirm copy explains that its deliverables will also be removed. On confirm, delete the milestone and all deliverables with that `milestoneId`. No automatic re-homing — users who want to keep deliverables must drag them to another milestone first. |
| Empty deliverables under a milestone | Allowed (soft warning via existing plan-quality checks). |
| Continue / create | Existing validation; `toProjectCreate` already nests deliverables under milestones — keep that mapping. Unlinked deliverables should no longer appear in normal UI flow; mapper fallback to first milestone remains as a safety net for old drafts. |

## Draft / data model

- Keep `PlanDraft` with top-level `features`, `milestones`, `deliverables` where each deliverable still has `milestoneId` (now always set when created from the nested UI).
- Hydration of older drafts that have `milestoneId: null` may still show those rows until edited; prefer migrating on hydrate by attaching null-linked titled deliverables to the first milestone, or hiding them with a one-time cleanup — **prefer hydrate attach to first milestone** so users don’t silently lose draft text.
- `discordChannels` and review/integrations flows unchanged.

## Copy guidelines

- Features section eyebrow/description: “Product scope — separate from the timeline.”
- Timeline section eyebrow/description: “Each deliverable lives inside one milestone.”
- Milestone delete confirm: e.g. “Remove this milestone and its N deliverables? This can’t be undone in the draft.” (Optionally hint: “Move deliverables to another milestone first if you want to keep them.”)
- Drag affordance: visible handle on each deliverable row; drop target ring/tint on the destination milestone’s deliverables region while dragging.

## Implementation note (drag)

Prefer native HTML5 drag-and-drop (or the existing draft list patterns) over adding a heavy DnD library unless keyboard reorder proves hard. Persist moves only by updating `deliverable.milestoneId` (and optional relative order in `draft.deliverables`). No backend change.

## UX extras (in scope for this pass)

These ship with the hierarchy rewrite; they are intentionally small and teach the model without a second redesign.

1. **Hierarchy legend** — Short line in How it works and/or under the page description: *Features = what · Milestones = when · Deliverables = concrete work under a milestone.*
2. **Milestone progress chip** — On each milestone header, show a compact summary such as `2 deliverables · Oct 10` so nesting is scannable when the list is long.
3. **Teaching empty states**
   - No features: “Add the product areas DevSync will map activity to.”
   - Milestone with zero deliverables: “Add concrete outputs for this checkpoint (optional but recommended).”
4. **Focus new rows** — After “+ Add feature / milestone / deliverable”, move focus into the new title field.
5. **Confirm delete only when needed** — Empty milestone deletes immediately; milestone with N deliverables shows confirm (including the “move first if you want to keep them” hint).
6. **Fill example plan** — A secondary action (e.g. on Import or Draft status) that loads a complete Campus Cart-style draft (features, milestones, nested deliverables) so teammates can demo and review the hierarchy quickly. Overwrites the current draft only after a lightweight confirm if the draft already has content.

### Explicitly not in this pass

- Sticky continue / bottom error bar
- Collapse milestones
- Section count badges in headers
- Auto-sort milestones by date
- Visually demoting owner fields to chips
- Feature ↔ deliverable linking

## Out of scope

- Backend schema changes
- Health dashboard UI
- Spec import page (beyond optional example-plan affordance on this page)
- Changing when `POST /api/projects` runs (still on Review)
- Dragging milestones or features (deliverables only)

## Success criteria

- A new user can tell at a glance that features are not milestones/deliverables.
- It is impossible to create a deliverable without a parent milestone in the new UI.
- A deliverable can be dragged from one milestone and dropped under a different milestone; ownership updates in the draft.
- Deleting a milestone requires confirm when it has deliverables, and removes those deliverables on confirm.
- Hierarchy legend, milestone chips, teaching empty states, focus-on-add, and example-plan fill are present.
- Existing draft/create tests updated; plan page still continues to integrations when valid.
