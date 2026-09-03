# Flow Minute-Synchronized Funding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Flow funding cards and bars follow the same current-minute funding data, refresh the market series every minute, and preserve the existing line-chart behavior.

**Architecture:** Keep the shared `loadDailyFlow` default unchanged for `/am`, `/pm`, and `/all`; only `RotationPage` requests 28 sectors. Replace the Flow-only market request from a single latest row to a minute series, map the Flow playback index to that series, and derive both card values and bar values from the active minute. Failed refreshes keep the previous valid series.

**Tech Stack:** React, TypeScript, Vite proxy, Vitest, CSS.

## Global Constraints

- The three line-chart routes `/am`, `/pm`, and `/all` must remain unchanged.
- Flow routes `/flow/am` and `/flow/today` continue to display 28 sectors.
- Market funding values must come from the remote API; no fallback mock values.
- A failed refresh must not clear the last valid market series.

---

### Task 1: Add minute-series parsing tests

**Files:**
- Create: `src/flow/marketFlow.test.ts`
- Modify: `src/flow/RotationPage.tsx`

**Interfaces:**
- Produce: a parser that converts API `klines` rows into typed minute summaries.

- [ ] **Step 1: Write the failing test**

Add tests for parsing ordered rows and ignoring malformed rows. The expected fields are `main`, `small`, `medium`, `large`, and `superLarge` from the API columns after the timestamp.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/flow/marketFlow.test.ts`
Expected: FAIL because the parser is not exported yet.

- [ ] **Step 3: Implement the minimal parser**

Export a pure parser from `RotationPage.tsx` or a focused module used by the page. Preserve API order and reject rows without five finite numeric funding values.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/flow/marketFlow.test.ts`
Expected: PASS.

### Task 2: Connect Flow cards to the active minute series

**Files:**
- Modify: `src/flow/RotationPage.tsx`

**Interfaces:**
- Consume: parsed market minute series from Task 1.
- Produce: `marketFlowSeries` state and an active summary derived from the same playback index as the bars.

- [ ] **Step 1: Request the full intraday series**

Use `lmt=240` and parse all valid rows for both `1.000001` and `0.399001`, summing matching minute positions across the two indices.

- [ ] **Step 2: Preserve the previous valid series on refresh failure**

Only call `setMarketFlowSeries` after a successful non-empty response. In the refresh catch path, leave state unchanged.

- [ ] **Step 3: Map the current Flow playback index to the market series**

Use the current `pointIndex` and sector `pointCount` to select the proportional market-series index, clamped to valid bounds. Derive the five cards from that active summary.

- [ ] **Step 4: Run all unit tests**

Run: `npm test`
Expected: PASS.

### Task 3: Verify visual sizing behavior and regression safety

**Files:**
- Modify: `src/flow/rotationModel.ts` only if needed for current-minute ranking.
- Verify: `src/flow/rotation.css`, `src/App.tsx`

**Interfaces:**
- The existing `getRotationFrame` continues to rank bars by active `pointIndex` value.
- Existing line-chart routes continue to use the default 24-sector data load.

- [ ] **Step 1: Run lint diagnostics**

Run workspace diagnostics for the edited Flow files.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: TypeScript compilation and Vite build succeed; only the existing chunk-size warning may remain.

- [ ] **Step 3: Review the final diff**

Confirm no changes to `src/App.tsx` and no changes to the line-chart rendering components.
