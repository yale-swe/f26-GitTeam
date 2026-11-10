# Onboarding Hierarchy UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/projects/new` so Features are separate product scope and Deliverables nest under Milestones (with drag-between-milestones), matching the approved hierarchy UI spec.

**Architecture:** Keep `PlanDraft` with top-level `deliverables[]` + `milestoneId`. Replace the sibling Deliverables card with a nested timeline card. Pure helpers in `projectDraft.ts` own example plans, orphan hydrate, remove-with-deliverables, and move/reorder. UI uses native HTML5 DnD plus a “Move to…” `<select>` fallback. No backend changes.

**Tech Stack:** Next.js App Router, React client components, Vitest + Testing Library, existing CreateProject CSS module (no new DnD library).

**Spec:** [`docs/superpowers/specs/2026-11-10-onboarding-hierarchy-ui-design.md`](../specs/2026-11-10-onboarding-hierarchy-ui-design.md)

## Global Constraints

- Features = what · Milestones = when · Deliverables = concrete work under a milestone
- No standalone Deliverables card; no “No milestone” option
- Native HTML5 drag-and-drop preferred; no heavy DnD dependency
- Delete milestone: immediate if zero deliverables; confirm if N > 0, then delete milestone + its deliverables (no re-home)
- Do not change Review create timing, integrations, or backend schemas
- Commits: only when the user explicitly asks (otherwise skip commit steps)

---

### Task 1: Draft helpers (example plan, hydrate orphans, remove, move)

**Files:**
- Modify: `frontend/src/lib/projectDraft.ts`
- Modify: `frontend/tests/project-draft.test.ts`

**Interfaces:**
- Consumes: existing `PlanDraft`, `emptyFeature`, `emptyMilestone`, `createId`
- Produces:
  - `emptyDeliverable(milestoneId: string): DraftDeliverable`
  - `exampleCampusCartDraft(): PlanDraft`
  - `normalizeDraft(draft: PlanDraft): PlanDraft` — merge defaults; attach `milestoneId: null` titled deliverables to first milestone
  - `removeMilestoneFromDraft(draft, milestoneId): PlanDraft`
  - `moveDeliverable(draft, deliverableId, targetMilestoneId, index?: number): PlanDraft`

- [ ] **Step 1: Write failing tests in `project-draft.test.ts`**

```ts
test("emptyDeliverable requires a milestone id", () => {
  const d = emptyDeliverable("m1");
  expect(d.milestoneId).toBe("m1");
});

test("normalizeDraft attaches orphan deliverables to the first milestone", () => {
  const draft = completePlan();
  draft.deliverables = [{ id: "d1", title: "Loose", owner: "", milestoneId: null }];
  const next = normalizeDraft(draft);
  expect(next.deliverables[0].milestoneId).toBe("m1");
});

test("removeMilestoneFromDraft removes the milestone and its deliverables", () => {
  const draft = completePlan(); // d1 linked to m1
  const next = removeMilestoneFromDraft(draft, "m1");
  expect(next.milestones.find((m) => m.id === "m1")).toBeUndefined();
  expect(next.deliverables.find((d) => d.id === "d1")).toBeUndefined();
});

test("moveDeliverable updates milestoneId", () => {
  const draft = completePlan();
  const next = moveDeliverable(draft, "d1", "m2");
  expect(next.deliverables.find((d) => d.id === "d1")?.milestoneId).toBe("m2");
});

test("exampleCampusCartDraft is a continuable nested plan", () => {
  const draft = exampleCampusCartDraft();
  expect(canContinue(draft)).toBe(true);
  expect(draft.deliverables.every((d) => d.milestoneId)).toBe(true);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npm test -- project-draft`

- [ ] **Step 3: Implement helpers in `projectDraft.ts`**

Change signature:

```ts
export function emptyDeliverable(milestoneId: string): DraftDeliverable {
  return { id: createId("deliverable"), title: "", owner: "", milestoneId };
}
```

Update all call sites later in Task 2/3. Implement `normalizeDraft`, `removeMilestoneFromDraft`, `moveDeliverable`, `exampleCampusCartDraft` (use the Campus Cart example from the team chat: 4 features, 3 milestones, nested deliverables). Keep `toProjectCreate` as-is.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npm test -- project-draft`

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add frontend/src/lib/projectDraft.ts frontend/tests/project-draft.test.ts
git commit -m "feat(onboarding): add draft helpers for nested milestones"
```

---

### Task 2: Nested milestones UI (replace sibling deliverables card)

**Files:**
- Create: `frontend/src/components/CreateProject/MilestonesDeliverablesCard.tsx` (or heavily rewrite `MilestonesCard.tsx` — prefer rewrite in place + delete `DeliverablesCard.tsx`)
- Modify: `frontend/src/components/CreateProject/CreateProject.tsx`
- Modify: `frontend/src/components/CreateProject/FeaturesCard.tsx` (copy + empty state)
- Modify: `frontend/src/components/CreateProject/CreateProject.module.css`
- Delete usage of: `frontend/src/components/CreateProject/DeliverablesCard.tsx` (delete file when unused)
- Modify: `frontend/src/lib/useProjectDraft.ts` — hydrate via `normalizeDraft`
- Test: `frontend/tests/project-onboarding.test.tsx`

**Interfaces:**
- Consumes: `emptyDeliverable(milestoneId)`, `removeMilestoneFromDraft`, draft mutators
- Produces: nested UI; `onAddDeliverable(milestoneId)`, `onRemoveMilestone(milestoneId)` with confirm gated in parent or card

- [ ] **Step 1: Update onboarding tests for nesting**

Replace “adds, edits, and removes deliverables” so “+ Add deliverable” is scoped inside a milestone (e.g. after naming Milestone 1, click add deliverable within that block). Assert there is no standalone “Linked milestone” select / no page-level lone “+ Add deliverable” outside a milestone.

Add:

```ts
test("nests deliverables under a milestone and has no orphan link dropdown", async () => {
  const user = userEvent.setup();
  render(<CreateProject />);
  fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "Core" } });
  await user.click(screen.getByRole("button", { name: "+ Add deliverable" }));
  expect(screen.getByLabelText("Deliverable")).toBeInTheDocument();
  expect(screen.queryByLabelText(/linked milestone/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npm test -- project-onboarding`

- [ ] **Step 3: Implement nested card + wire CreateProject**

`MilestonesCard` (or new component) for each milestone renders:
- title, date, detail
- progress chip: `{n} deliverable(s)` + formatted date when present
- nested deliverable rows (title, owner, remove) filtered by `milestoneId`
- empty teaching copy when zero deliverables
- `+ Add deliverable` calling `emptyDeliverable(milestone.id)`
- remove milestone button (confirm logic in Task 4)

`FeaturesCard` description: “Product scope — separate from the timeline. High-level capabilities. Not dated. Not nested under milestones.” Empty: “Add the product areas DevSync will map activity to.”

`CreateProject`: remove `DeliverablesCard`; pass deliverables into milestones card; use `normalizeDraft` in `useProjectDraft` hydrate:

```ts
setDraftState(normalizeDraft({ ...emptyDraft(), ...parsed.draft }));
```

- [ ] **Step 4: Run onboarding + draft tests — expect PASS**

Run: `cd frontend && npm test -- project-onboarding project-draft`

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 3: Drag-and-drop + Move-to fallback

**Files:**
- Modify: nested milestones component + CSS
- Modify: `frontend/tests/project-onboarding.test.tsx` (and/or unit-test `moveDeliverable` already covered)

**Interfaces:**
- Consumes: `moveDeliverable(draft, id, targetMilestoneId)`
- Produces: drag handle on each deliverable; droppable deliverables region per milestone; `<select aria-label="Move to milestone">` on each row

- [ ] **Step 1: Add test for Move-to select (reliable vs DnD)**

```ts
test("moves a deliverable to another milestone via Move to", async () => {
  const user = userEvent.setup();
  render(<CreateProject />);
  // seed two milestones + one deliverable under first via UI or example fill from Task 5
  // then change Move-to select to second milestone
  // assert deliverable appears under second milestone region
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement DnD + select**

- `draggable` on handle only (`draggable` element or handle with `dragstart` setting `dataTransfer` deliverable id)
- milestone deliverables region: `onDragOver` preventDefault + `data-drop-active` class; `onDrop` → `moveDeliverable`
- same-milestone drop: optional reorder by splicing within `draft.deliverables` filtered subset (nice-to-have; cross-milestone reassignment is required)
- “Move to…” `<select>` listing other milestones by title

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 4: Milestone delete confirm + focus-on-add

**Files:**
- Modify: nested milestones component, `FeaturesCard`, `CreateProject.tsx`
- Modify: `frontend/src/components/Field/Field.tsx` — add optional `autoFocus?: boolean`
- Test: onboarding tests for confirm

- [ ] **Step 1: Tests**

```ts
test("deletes an empty milestone immediately", async () => { /* add second empty milestone, remove, no dialog */ });
test("confirms before deleting a milestone that has deliverables", async () => {
  // window.confirm mock returning false keeps milestone; true removes milestone + deliverable
});
```

- [ ] **Step 2: FAIL then implement**

```ts
function handleRemoveMilestone(id: string) {
  const count = draft.deliverables.filter((d) => d.milestoneId === id && d.title.trim()).length;
  // count all linked rows, titled or not — prefer all with milestoneId === id
  const linked = draft.deliverables.filter((d) => d.milestoneId === id).length;
  if (linked > 0) {
    const ok = window.confirm(
      `Remove this milestone and its ${linked} deliverable${linked === 1 ? "" : "s"}? Move deliverables to another milestone first if you want to keep them.`,
    );
    if (!ok) return;
  }
  setDraft(removeMilestoneFromDraft(draft, id));
}
```

Focus: after add feature/milestone/deliverable, set a `pendingFocusId` state and pass `autoFocus` to the matching Field (or `useEffect` + `document.querySelector`).

- [ ] **Step 3: PASS + commit if asked**

---

### Task 5: UX extras (legend, example plan)

**Files:**
- Modify: `HowItWorksCard.tsx`, page description in `CreateProject.tsx`
- Modify: `ImportCard.tsx` or `DraftStatusCard.tsx` — add “Fill example plan” button
- Modify: `CreateProject.tsx` — wire `exampleCampusCartDraft` with confirm if draft has content
- Test: onboarding

- [ ] **Step 1: Tests**

```ts
test("shows hierarchy legend copy", () => {
  render(<CreateProject />);
  expect(screen.getByText(/features = what/i)).toBeInTheDocument();
});

test("fills an example Campus Cart plan", async () => {
  const user = userEvent.setup();
  render(<CreateProject />);
  await user.click(screen.getByRole("button", { name: /fill example plan/i }));
  expect(screen.getByDisplayValue("Campus Cart")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /continue to integrations/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement legend + example fill**

Confirm when `hasSavedDraft || draft.name.trim() || named features/milestones exist`:

```ts
if (draftHasContent && !window.confirm("Replace your current draft with the example Campus Cart plan?")) return;
setDraft(exampleCampusCartDraft());
```

Milestone chips already in Task 2; verify formatting.

- [ ] **Step 3: Full frontend test suite**

Run: `cd frontend && npm test`  
Also: `npm run lint`

- [ ] **Step 4: Commit** (only if user asked)

```bash
git add frontend/src frontend/tests docs/superpowers
git commit -m "feat(onboarding): nest deliverables under milestones with drag and UX extras"
```

---

## Self-review vs spec

| Spec item | Task |
|---|---|
| Nested milestones UI / remove sibling deliverables | 2 |
| Features separate copy | 2 |
| Drag + Move to | 3 |
| Delete confirm when has deliverables | 4 |
| Focus new rows | 4 |
| Legend | 5 |
| Milestone chip | 2 |
| Teaching empty states | 2 |
| Example plan | 5 |
| Hydrate orphans | 1 + useProjectDraft in 2 |
| No backend / no review timing change | Global |

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-11-10-onboarding-hierarchy-ui.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
