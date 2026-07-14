# Testing Plan Document — Material Management Agent (MMA)

This document describes the testing strategy, testing modules, and test specifications for the Material Management Agent (MMA) project to ensure correctness and stability.

---

## 1. Unit Testing Specifications

### UT1. BOM Parser Module
- **Target**: `src/utils/bomParser.ts`
- **Inputs to Test**:
  - Valid CSV strings containing columns like `物料号`, `物料名称`, `单机用量`, `负责人`.
  - Valid tab-separated or whitespace-separated pasted text.
  - Malformed strings (missing columns, invalid numeric values for qty).
- **Expected Outputs**:
  - Array of structured JSON objects containing clean string values and parsed integers for quantities.
  - Throw explicit errors or return error logs for malformed data.

### UT2. Inventory Calculation Engine
- **Target**: `src/utils/calcEngine.ts`
- **Logic to Test**:
  - `Required Qty = Target Build Qty * Qty per Machine`
  - `Shortage = Max(0, Required Qty - Current Stock)`
  - `Estimated Buildable Machines = Min(Floor(Current Stock / Qty per Machine))` across all components.
- **Edge Cases**:
  - `Current Stock` is greater than `Required Qty` (shortage should be 0).
  - `Current Stock` is negative or null (default to 0).
  - `Qty per Machine` is 0 (should handle division-by-zero safely).

### UT3. Risk Evaluation Logic
- **Target**: `src/utils/riskEvaluator.ts`
- **Logic to Test**:
  - Shortage == 0: **Low Risk**.
  - Shortage > 0 AND Lead Time > 15 days: **High Risk**.
  - Shortage > 0 AND Lead Time <= 15 days: **Medium Risk**.
  - Shipping delay beyond build target date: **High Risk**.

---

## 2. Integration & End-to-End (E2E) Testing Specifications

### IT1. Read-Only "MASS" API Sync Integration
- **Target**: `/api/mass/sync` endpoint
- **Tests**:
  - Confirm HTTP GET fetches correct material stock levels from the mock database without mutating any stock levels in the mock source.
  - Verify state updates correctly in the local sqlite project DB.

### IT2. Purchase Requisition Spreadsheet Generation
- **Target**: `/api/purchase/export` or frontend export utility
- **Tests**:
  - Verify exported file has headers: `物料号`, `数量`, `负责人`, `成本中心`, `项目号`.
  - Check that only items with `Shortage > 0` are exported.
  - Ensure status transitions from `Pending` to `OA Submitted` upon trigger.

### E2E1. Conversational Onboarding Flow
- **Scenario**: User lands on interface for the first time.
- **Steps to Verify**:
  1. Chat starts by asking for project info.
  2. User inputs project number, cost center, target build.
  3. User pastes BOM text.
  4. System parses BOM and initialises the project database.
  5. UI updates: Left panel shows project info; Right panel shows BOM table with stock levels.

---

## 3. Automation Framework & Running Tests
- **Frontend / Utility Tests**: We will use **Vitest** for running unit tests in TypeScript.
- **E2E/Integration Tests**: We will use **Playwright** or simple integration scripts to verify end-to-end user journeys in the 3-column UI.
