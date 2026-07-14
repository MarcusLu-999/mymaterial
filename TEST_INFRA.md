# End-to-End (E2E) Testing Infrastructure Document

This document defines the E2E testing infrastructure, methodology, and the 71 specific test cases required to verify the Material Management Agent (MMA). The MMA is a full-stack, intranet-based, air-gapped application designed to manage material availability, verify stock against warehouse records, calculate shortages, export purchase sheets, and provide proactive risk alerting via an AI agent.

---

## 1. Executive Summary & Test Goals

The goal of the MMA E2E testing infrastructure is to ensure that:
1. All client-server interactions are stable, robust, and performant.
2. The AI Agent correctly guides the user through onboarding, performs calculations, triggers risk evaluation rules, and generates supplier communication.
3. The UI state is perfectly synchronized across the three columns in real-time.
4. The system operates correctly in an offline environment without loading external assets.
5. All calculations, state transitions, and file exports are mathematically correct and conform to schema requirements.

---

## 2. Infrastructure & Test Runner Configuration

### 2.1 Technology Selection
*   **Test Runner**: **Playwright** is utilized for E2E user-flow testing. It provides cross-browser execution (Chromium, Firefox, WebKit), fast execution, and native network interception capabilities.
*   **Mock Services**: Playwright's `page.route` intercepts external calls (like the internal LLM gateway) to guarantee predictable test runs.
*   **Database Isolation**: Prior to each test suite execution, the local SQLite database (`mma.db` or local JSON store) is wiped and seeded with a clean database schema and initial test records to prevent test pollution.

### 2.2 Intranet Walled Garden Enforcement
The E2E tests run with network isolation flags enabled:
*   No external script or stylesheet loads are permitted.
*   Playwright intercepts and blocks any requests containing public CDN hosts (e.g. unpkg.com, cdnjs.cloudflare.com, fonts.googleapis.com).
*   Any such request triggers an immediate test failure, validating compliance with local asset bundling constraints.

---

## 3. Core Features Under Test (F1 - F6)

*   **F1: Conversational Onboarding & Setup**: Chat-based guided setup to collect Project ID, Cost Center, and Target Quantity, and parse pasted BOM text or CSV uploads to initialize the database.
*   **F2: 3-Column Glassmorphic UI & Interactive Dashboard**: UI Layout showing Project Metadata/KPI cards on the left, AI chat in the middle, and inventory table/Kanban on the right.
*   **F3: Read-Only "MASS" Warehouse Synchronization**: Materials queried in MASS warehouse to calculate shortages, without mutating the source MASS records.
*   **F4: OA System Purchase Spreadsheet Export**: Requisition list exported to CSV with mandatory columns, transitioning status of exported items from `Pending` to `OA Submitted`.
*   **F5: Proactive Risk Evaluation & Alerts**: Automatic calculation of High/Medium/Low risk based on shortage and lead time, displaying warning cards in chat.
*   **F6: Supplier Follow-up Draft Generator**: Context-aware email drafting (English/Chinese) for delayed items, featuring a copy-to-clipboard button.

---

## 4. The 4-Tier Test Plan

*   **Tier 1: Feature Coverage (30 Cases)**: Verifies that each of the 6 features behaves correctly under standard operating conditions (5 cases per feature).
*   **Tier 2: Boundary & Corner Cases (30 Cases)**: Tests boundaries, empty values, malformed inputs, API timeouts, concurrent interactions, and large-scale datasets.
*   **Tier 3: Cross-Feature Integration (6 Cases)**: Validates complex multi-feature workflows and state synchronization across the UI and database.
*   **Tier 4: Real-World Scenarios (5 Cases)**: End-to-end user stories modeling real-world engineering tasks.

---

## 5. Detailed Test Specification (71 Cases)

### Tier 1: Feature Coverage (30 Cases)

#### Feature 1: Conversational Onboarding & Setup (TC-T1-01 to TC-T1-05)

*   **TC-T1-01: Guided Setup Prompting**
    *   **Description**: Verify the chatbot initiates the onboarding sequence if the database is uninitialized.
    *   **Preconditions**: Database contains no active project configurations.
    *   **Action Steps**:
        1. Navigate to the application home page.
        2. Observe the chat window in the middle column.
    *   **Expected Outcome**: The chat displays an onboarding welcome message asking the user for Project ID, Cost Center, and Target Qty.
    *   **Assertion**: `page.locator('.message-bubble.assistant').textContent()` contains "物料管理助手" and asks for setup info.

*   **TC-T1-02: Project Information Submission**
    *   **Description**: Verify user can submit Project ID, Cost Center, and Target Quantity via chat.
    *   **Preconditions**: Chatbot is waiting for project inputs.
    *   **Action Steps**:
        1. Type "项目号: PRJ-2026-X1, 成本中心: CC-RD-HW-03, 目标台数: 5" into the chat input.
        2. Click the "Send" button.
    *   **Expected Outcome**: System updates the left panel metadata.
    *   **Assertion**: `.left-panel` exhibits values "PRJ-2026-X1", "CC-RD-HW-03", and "5".

*   **TC-T1-03: Raw BOM Text Parse & Init**
    *   **Description**: Verify pasted CSV BOM text is parsed and initialized.
    *   **Preconditions**: Project details set up; waiting for BOM.
    *   **Action Steps**:
        1. Paste the following text in chat:
           `物料号,物料名称,单机用量,负责人`
           `M-001,MCU Board,2,张三`
           `M-002,12V Adapter,1,李四`
        2. Click "Send".
    *   **Expected Outcome**: The system parses the BOM and populates the database with 2 items.
    *   **Assertion**: Right column dashboard updates showing a table with "M-001" and "M-002" rows.

*   **TC-T1-04: BOM File Upload Parse & Init**
    *   **Description**: Verify importing BOM via CSV file input.
    *   **Preconditions**: Project details set up; waiting for BOM.
    *   **Action Steps**:
        1. Click file upload trigger.
        2. Select a mock `bom.csv` containing columns `物料号`, `物料名称`, `单机用量`, `负责人`.
    *   **Expected Outcome**: File is processed; materials table displays items from the file.
    *   **Assertion**: Table row count equals the number of material entries in `bom.csv`.

*   **TC-T1-05: Dashboard Activation after Setup**
    *   **Description**: Verify UI transition from unconfigured state to active dashboard.
    *   **Preconditions**: Application is in clean unconfigured state showing "No Project Alert".
    *   **Action Steps**:
        1. Complete conversational onboarding and submit BOM.
    *   **Expected Outcome**: "No Project Alert" disappears, revealing active Kanban and Material Table.
    *   **Assertion**: `.no-project-alert` is hidden, and `.dashboard-content` is visible.

#### Feature 2: 3-Column Glassmorphic UI & Interactive Dashboard (TC-T1-06 to TC-T1-10)

*   **TC-T1-06: Left Column Metadata Integrity**
    *   **Description**: Verify left panel renders all active project metadata and a timestamp.
    *   **Preconditions**: Project `PRJ-2026-X1` is active.
    *   **Action Steps**:
        1. Inspect the left panel columns.
    *   **Expected Outcome**: Displays Project ID, Cost Center, Target Qty, and current timestamp.
    *   **Assertion**: Left column contains matching labels and formatted non-empty text fields.

*   **TC-T1-07: Left Column KPI Calculations**
    *   **Description**: Verify correct computation of BOM Coverage, Buildable Machines, and Shortage Items.
    *   **Preconditions**: Project target build is 5. BOM has 2 items: M-001 (Req: 10, Stock: 15), M-002 (Req: 5, Stock: 3).
    *   **Action Steps**:
        1. Render left panel.
    *   **Expected Outcome**: BOM Coverage = 50%, Buildable Machines = 3, Shortage Items = 1.
    *   **Assertion**: Left column KPI values match calculations: coverage (50%), buildable (3), shortage count (1).

*   **TC-T1-08: Right Column Material Table Render**
    *   **Description**: Verify table displays all required headers and columns.
    *   **Preconditions**: BOM parsed and database populated.
    *   **Action Steps**:
        1. Render the Material Table.
    *   **Expected Outcome**: Headers: Material Code, Name, Qty per Machine, Required Qty, Current Stock, Shortage, Owner, Lead Time, Delivery Status, Risk Level are present.
    *   **Assertion**: Header elements in the right panel match the required lists.

*   **TC-T1-09: Table Filter Options**
    *   **Description**: Verify filtering by "Shortage Only" and "High Risk Only".
    *   **Preconditions**: Table contains items with/without shortages and high/low risks.
    *   **Action Steps**:
        1. Click "Shortage Only" tab.
        2. Observe table.
        3. Click "High Risk Only" tab.
    *   **Expected Outcome**: Only matching rows are rendered.
    *   **Assertion**: All visible rows under "Shortage Only" have `Shortage > 0`. All visible rows under "High Risk Only" have `Risk Level === "High"`.

*   **TC-T1-10: Table Search and Sort**
    *   **Description**: Verify searching by material name/code and sorting columns.
    *   **Preconditions**: Table contains multiple items.
    *   **Action Steps**:
        1. Enter "MCU" in search field.
        2. Click "Lead Time" header to sort.
    *   **Expected Outcome**: Table shows only rows containing "MCU", sorted by lead time.
    *   **Assertion**: Visible row names contain "MCU" (case-insensitive), sorted in ascending order of lead time.

#### Feature 3: Read-Only "MASS" Warehouse Synchronization (TC-T1-11 to TC-T1-15)

*   **TC-T1-11: Manual Sync Button Click**
    *   **Description**: Verify that clicking the sync button initiates stock querying.
    *   **Preconditions**: Project active and dashboard loaded.
    *   **Action Steps**:
        1. Click "Sync MASS Inventory" button in the right panel.
    *   **Expected Outcome**: An HTTP GET request to `/api/mass/sync` is sent.
    *   **Assertion**: Network log confirms a successful HTTP 200 GET to `/api/mass/sync`.

*   **TC-T1-12: Read-Only Query Integrity**
    *   **Description**: Verify MASS database queries do not mutate MASS data.
    *   **Preconditions**: Mock MASS database has initial stock values.
    *   **Action Steps**:
        1. Trigger sync.
        2. Fetch mock MASS database state directly.
    *   **Expected Outcome**: MASS stock numbers remain identical.
    *   **Assertion**: Mock MASS database records before and after sync are exactly identical.

*   **TC-T1-13: Local DB Update after Sync**
    *   **Description**: Verify fetched inventory levels update the local SQLite/JSON database.
    *   **Preconditions**: Local db has stock of M-001 as 0. MASS has it as 15.
    *   **Action Steps**:
        1. Trigger MASS sync.
    *   **Expected Outcome**: Local database record for M-001 stock updates to 15.
    *   **Assertion**: Database query `SELECT qtyStock FROM bom_items WHERE partNumber='M-001'` returns 15.

*   **TC-T1-14: Inventory Shortage Formula Assertion**
    *   **Description**: Verify shortage math: `Shortage = Max(0, Required Qty - Stock)`.
    *   **Preconditions**: Target build is 10. Item M-001 has Qty per Machine = 2 (Req = 20), Stock = 12.
    *   **Action Steps**:
        1. Trigger sync to load stock of 12.
    *   **Expected Outcome**: Shortage is calculated as 8.
    *   **Assertion**: Table row shortage column displays "8".

*   **TC-T1-15: Sync Status / Timestamp Update**
    *   **Description**: Verify sync timestamp in the UI updates upon completion.
    *   **Preconditions**: Project is synced.
    *   **Action Steps**:
        1. Record the current sync time shown in the UI.
        2. Wait 2 seconds.
        3. Click "Sync MASS Inventory" again.
    *   **Expected Outcome**: The timestamp updates to the new completion time.
    *   **Assertion**: The new timestamp text is greater (later) than the original recorded timestamp.

#### Feature 4: OA System Purchase Spreadsheet Export (TC-T1-16 to TC-T1-20)

*   **TC-T1-16: Export OA Purchase Sheet Trigger**
    *   **Description**: Verify clicking the export button returns a file download.
    *   **Preconditions**: Database contains items with shortages.
    *   **Action Steps**:
        1. Click "Export OA Purchase Sheet" button.
    *   **Expected Outcome**: API returns a successful CSV download stream.
    *   **Assertion**: Response headers contain `Content-Disposition` with attachment filename.

*   **TC-T1-17: Exported File Format and Headers**
    *   **Description**: Verify CSV headers are exactly `物料号`, `数量`, `负责人`, `成本中心`, `项目号`.
    *   **Preconditions**: CSV export triggered.
    *   **Action Steps**:
        1. Download and read the CSV.
    *   **Expected Outcome**: First line of the CSV matches the exact header columns.
    *   **Assertion**: First line string is exactly `物料号,数量,负责人,成本中心,项目号`.

*   **TC-T1-18: Export Content Reconcile**
    *   **Description**: Verify only shortage items are exported with correct shortage values.
    *   **Preconditions**: 1 item has shortage (Qty: 8), 1 item has no shortage.
    *   **Action Steps**:
        1. Download and parse CSV content.
    *   **Expected Outcome**: CSV contains exactly 1 data row with quantity 8.
    *   **Assertion**: Row count is 2 (header + 1 data row) and second column value is "8".

*   **TC-T1-19: State Transition to OA Submitted**
    *   **Description**: Verify status shifts from `Pending` to `OA Submitted` after export.
    *   **Preconditions**: Status of M-001 is `Pending` in DB.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: Status of M-001 updates to `OA Submitted`.
    *   **Assertion**: Database query returns status as `OA Submitted` and UI table shows "已提交 OA" or "OA Submitted".

*   **TC-T1-20: Export History Logging**
    *   **Description**: Verify export history is logged locally.
    *   **Preconditions**: Clean activity log table.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: System logs the event.
    *   **Assertion**: Query `SELECT * FROM logs WHERE action='export'` returns 1 row.

#### Feature 5: Proactive Risk Evaluation & Alerts (TC-T1-21 to TC-T1-25)

*   **TC-T1-21: High Risk Rule Evaluation**
    *   **Description**: Verify items with shortages and lead time > 15 days are marked High Risk.
    *   **Preconditions**: Shortage = 5, Lead Time = 20 days.
    *   **Action Steps**:
        1. Trigger risk assessment.
    *   **Expected Outcome**: Item is classified as High Risk.
    *   **Assertion**: Database record shows risk level is `High` and UI display has red badge.

*   **TC-T1-22: Medium Risk Rule Evaluation**
    *   **Description**: Verify items with shortages and lead time <= 15 days are marked Medium Risk.
    *   **Preconditions**: Shortage = 5, Lead Time = 10 days.
    *   **Action Steps**:
        1. Trigger risk assessment.
    *   **Expected Outcome**: Item is classified as Medium Risk.
    *   **Assertion**: Database record shows risk level is `Medium` and UI display has yellow badge.

*   **TC-T1-23: Low Risk Rule Evaluation**
    *   **Description**: Verify items with no shortages are marked Low Risk.
    *   **Preconditions**: Shortage = 0.
    *   **Action Steps**:
        1. Trigger risk assessment.
    *   **Expected Outcome**: Item is classified as Low Risk.
    *   **Assertion**: Database record shows risk level is `Low` and UI display has green badge.

*   **TC-T1-24: Proactive Alert Chat Message**
    *   **Description**: Verify agent post warning cards in chat for high risk items.
    *   **Preconditions**: High-risk items detected during sync.
    *   **Action Steps**:
        1. Wait for agent evaluation to finish.
    *   **Expected Outcome**: Agent prints alert card mentioning the material code and risk reason.
    *   **Assertion**: `.message-bubble.assistant` contains a `.risk-alert-card` with matching material code.

*   **TC-T1-25: Visual Risk Indicators in Table**
    *   **Description**: Verify risk labels exhibit glassmorphic color indicators.
    *   **Preconditions**: Table has High, Medium, Low risk rows.
    *   **Action Steps**:
        1. View the material table.
    *   **Expected Outcome**: High shows Red, Medium shows Yellow, Low shows Green.
    *   **Assertion**: CSS classes of the cells match `.risk-high`, `.risk-medium`, `.risk-low`.

#### Feature 6: Supplier Follow-up Draft Generator (TC-T1-26 to TC-T1-30)

*   **TC-T1-26: Email Draft Generation for Delayed Item**
    *   **Description**: Verify agent provides action button to generate supplier follow-up email.
    *   **Preconditions**: High-risk alert is displayed in chat.
    *   **Action Steps**:
        1. Click "Generate Email Draft" button on the warning card.
    *   **Expected Outcome**: Agent generates and streams the email template.
    *   **Assertion**: Chat log receives a new assistant message representing the email draft.

*   **TC-T1-27: English Draft Language Check**
    *   **Description**: Verify email draft in English contains correct material code and shortage values.
    *   **Preconditions**: English generation requested.
    *   **Action Steps**:
        1. Read generated draft.
    *   **Expected Outcome**: Template contains "Material Code: M-001" and "Shortage: 5".
    *   **Assertion**: Email content matches standard regex for material code and shortage.

*   **TC-T1-28: Chinese Draft Language Check**
    *   **Description**: Verify email draft in Chinese contains correct material code and shortage values.
    *   **Preconditions**: Chinese generation requested.
    *   **Action Steps**:
        1. Read generated draft.
    *   **Expected Outcome**: Template contains "物料编码：M-001" and "缺口：5".
    *   **Assertion**: Email content matches standard regex in Chinese.

*   **TC-T1-29: Copy-to-Clipboard Functionality**
    *   **Description**: Verify clicking the "Copy" button copies the draft.
    *   **Preconditions**: Email draft has copy button.
    *   **Action Steps**:
        1. Click "Copy to Clipboard" button.
        2. Read clipboard content.
    *   **Expected Outcome**: Clipboard contains the exact draft text.
    *   **Assertion**: `navigator.clipboard.readText()` matches the draft content.

*   **TC-T1-30: Draft Personalization**
    *   **Description**: Verify draft auto-populates the correct owner and project ID.
    *   **Preconditions**: Active project is `PRJ-2026-X1`, item owner is `张三`.
    *   **Action Steps**:
        1. Generate email draft.
    *   **Expected Outcome**: Draft includes Project ID `PRJ-2026-X1` and signature `张三`.
    *   **Assertion**: Draft text contains "PRJ-2026-X1" and "张三".

---

### Tier 2: Boundary & Corner Cases (30 Cases)

#### Conversational Onboarding Boundaries (TC-T2-01 to TC-T2-08)

*   **TC-T2-01: Empty Project ID Input**
    *   **Description**: Verify validation rejection for empty project ID.
    *   **Preconditions**: Onboarding flow active.
    *   **Action Steps**:
        1. Enter empty project ID or spaces in onboarding.
    *   **Expected Outcome**: System flags an input error and prompts again.
    *   **Assertion**: Error message "Project ID cannot be empty" is displayed.

*   **TC-T2-02: Numeric Target Qty Boundary - Zero**
    *   **Description**: Verify rejection of zero build quantity.
    *   **Preconditions**: Onboarding flow active.
    *   **Action Steps**:
        1. Input Target Build Qty as "0".
    *   **Expected Outcome**: Rejection message displayed.
    *   **Assertion**: UI displays "Quantity must be greater than 0" or equivalent error.

*   **TC-T2-03: Numeric Target Qty Boundary - Negative**
    *   **Description**: Verify rejection of negative build quantity.
    *   **Preconditions**: Onboarding flow active.
    *   **Action Steps**:
        1. Input Target Build Qty as "-5".
    *   **Expected Outcome**: Rejection message displayed.
    *   **Assertion**: UI displays validation error.

*   **TC-T2-04: Numeric Target Qty Boundary - Non-Integer**
    *   **Description**: Verify non-integers are rejected or parsed to integer safely.
    *   **Preconditions**: Onboarding flow active.
    *   **Action Steps**:
        1. Input Target Build Qty as "5.8".
    *   **Expected Outcome**: System validates and sanitizes input to integer (5) or throws error.
    *   **Assertion**: Active target quantity in left panel becomes 5 or system displays validation error.

*   **TC-T2-05: Malformed BOM Parsing - Missing Headers**
    *   **Description**: Verify error handling when pasted BOM has missing critical headers.
    *   **Preconditions**: Waiting for BOM text input.
    *   **Action Steps**:
        1. Paste text without headers:
           `M-001,MCU Board,2`
    *   **Expected Outcome**: System displays validation error identifying missing headers.
    *   **Assertion**: Agent message contains "Missing required column headers: 物料号, 单机用量".

*   **TC-T2-06: Malformed BOM Parsing - Invalid Numeric Qty**
    *   **Description**: Verify parsing error when Qty per Machine is not a number.
    *   **Preconditions**: Waiting for BOM text input.
    *   **Action Steps**:
        1. Paste text:
           `物料号,物料名称,单机用量,负责人`
           `M-001,MCU Board,two,张三`
    *   **Expected Outcome**: Rejection of row, parsed items not committed.
    *   **Assertion**: Agent flags "Invalid quantity 'two' for material M-001".

*   **TC-T2-07: Malformed BOM Parsing - Empty Rows**
    *   **Description**: Verify blank lines in pasted text are skipped safely.
    *   **Preconditions**: Waiting for BOM text input.
    *   **Action Steps**:
        1. Paste text:
           `物料号,物料名称,单机用量,负责人`
           
           `M-001,MCU Board,2,张三`
           
           `M-002,12V Adapter,1,李四`
    *   **Expected Outcome**: BOM parsed successfully with exactly 2 items.
    *   **Assertion**: Total items in table = 2.

*   **TC-T2-08: Extremely Large BOM Size**
    *   **Description**: Verify handling of a BOM with 1,000 entries.
    *   **Preconditions**: System in unconfigured state.
    *   **Action Steps**:
        1. Upload a BOM with 1,000 distinct items.
    *   **Expected Outcome**: Successful database insert within 3 seconds; UI renders smoothly.
    *   **Assertion**: Table row count = 1000; DOM rendering doesn't crash browser thread.

#### Warehouse Sync Boundaries (TC-T2-09 to TC-T2-15)

*   **TC-T2-09: Zero Stock in MASS**
    *   **Description**: Verify calculation when stock is exactly 0.
    *   **Preconditions**: Target build = 10, Qty per Machine = 2 (Req = 20), MASS Stock = 0.
    *   **Action Steps**:
        1. Sync stock.
    *   **Expected Outcome**: Shortage equals 20.
    *   **Assertion**: Table displays stock as 0 and shortage as 20.

*   **TC-T2-10: Excess Stock in MASS**
    *   **Description**: Verify stock exceeding requirements results in 0 shortage (no negative values).
    *   **Preconditions**: Required = 20, MASS Stock = 50.
    *   **Action Steps**:
        1. Sync stock.
    *   **Expected Outcome**: Shortage is exactly 0.
    *   **Assertion**: Table displays stock as 50 and shortage as 0.

*   **TC-T2-11: Negative Stock Value in MASS**
    *   **Description**: Verify negative stock in warehouse is sanitized to 0.
    *   **Preconditions**: Required = 20, MASS Stock = -5.
    *   **Action Steps**:
        1. Sync stock.
    *   **Expected Outcome**: Stock treated as 0; shortage calculated as 20.
    *   **Assertion**: Table displays stock as 0 (or original -5 but shortage remains 20).

*   **TC-T2-12: Non-existent Material Code in MASS**
    *   **Description**: Verify behavior when material code is missing from warehouse.
    *   **Preconditions**: Material `M-999` not in mock MASS database.
    *   **Action Steps**:
        1. Trigger sync.
    *   **Expected Outcome**: M-999 stock defaults to 0 and a warning flag is raised.
    *   **Assertion**: Stock is 0; warning indicator shows "Not found in MASS".

*   **TC-T2-13: MASS API Server Timeout**
    *   **Description**: Verify app handles server timeout gracefully.
    *   **Preconditions**: Backend endpoint `/api/mass/sync` is configured to time out.
    *   **Action Steps**:
        1. Click Sync.
    *   **Expected Outcome**: App displays error notification and doesn't crash.
    *   **Assertion**: UI shows error dialog/toast "Sync failed: Timeout" with a "Retry" button.

*   **TC-T2-14: MASS API Return Malformed JSON**
    *   **Description**: Verify error handling of invalid JSON response.
    *   **Preconditions**: API returns malformed string payload.
    *   **Action Steps**:
        1. Click Sync.
    *   **Expected Outcome**: Graceful UI error banner displayed.
    *   **Assertion**: UI shows error alert "Sync failed: Invalid response format".

*   **TC-T2-15: Null Stock Values in MASS**
    *   **Description**: Verify null values in stock parameters are evaluated as 0.
    *   **Preconditions**: MASS stock payload for M-001 has `"stock": null`.
    *   **Action Steps**:
        1. Trigger sync.
    *   **Expected Outcome**: M-001 stock treated as 0; shortage calculated accordingly.
    *   **Assertion**: UI displays stock as 0 and shortage matches requirement.

#### OA Export Boundaries (TC-T2-16 to TC-T2-22)

*   **TC-T2-16: Export with Zero Shortages**
    *   **Description**: Verify export behavior when no items have shortages.
    *   **Preconditions**: All items have 100% stock coverage.
    *   **Action Steps**:
        1. Click "Export OA Purchase Sheet".
    *   **Expected Outcome**: User is notified that there are no shortages to export, or downloads empty template.
    *   **Assertion**: Dialog message "No shortages found for export" appears, or download is empty with headers.

*   **TC-T2-17: Export with Already Submitted Status**
    *   **Description**: Verify items in `OA Submitted` state are excluded from subsequent exports.
    *   **Preconditions**: M-001 has status `OA Submitted`, M-002 has status `Pending` with shortage.
    *   **Action Steps**:
        1. Click Export.
    *   **Expected Outcome**: Exported CSV contains only M-002.
    *   **Assertion**: CSV has 1 data row corresponding to M-002; M-001 is omitted.

*   **TC-T2-18: Export File Write Access Error**
    *   **Description**: Verify backend error handling if write directory is locked.
    *   **Preconditions**: Server file system write permissions restricted.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: App displays export failure alert; DB status does not transition.
    *   **Assertion**: UI shows "Export failed: Permission denied"; item remains `Pending`.

*   **TC-T2-19: SQL/DB Transaction Failure on Export**
    *   **Description**: Verify database rollback if updating item status fails.
    *   **Preconditions**: Database transaction fails midway during state updates.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: No item statuses are updated; CSV download is cancelled or rolled back.
    *   **Assertion**: Status of all items remains `Pending`.

*   **TC-T2-20: Export with Special Characters in Project ID**
    *   **Description**: Verify file name sanitization during export.
    *   **Preconditions**: Project ID is `PRJ/2026*X1`.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: File downloads with sanitized name (e.g. `PRJ_2026_X1_purchase.csv`).
    *   **Assertion**: Filename matches regex avoiding illegal file characters.

*   **TC-T2-21: Simultaneous Export Requests**
    *   **Description**: Verify prevention of duplicate submission under rapid double clicks.
    *   **Preconditions**: Shortages exist.
    *   **Action Steps**:
        1. Rapidly double-click "Export OA Purchase Sheet".
    *   **Expected Outcome**: Only one file is downloaded; status transitions once.
    *   **Assertion**: Only one download network request completes successfully; log contains one entry.

*   **TC-T2-22: Exporting Massive Shortage Lists**
    *   **Description**: Verify exporting a list of 500 shortage items.
    *   **Preconditions**: 500 items are set to `Pending` with shortage.
    *   **Action Steps**:
        1. Trigger export.
    *   **Expected Outcome**: File is generated and downloaded within 2 seconds.
    *   **Assertion**: CSV contains exactly 500 data rows.

#### Risk Evaluation & Email Draft Boundaries (TC-T2-23 to TC-T2-30)

*   **TC-T2-23: Boundary Lead Time - Exactly 15 Days**
    *   **Description**: Verify that 15 days lead time is evaluated as Medium Risk.
    *   **Preconditions**: Shortage > 0, Lead Time = 15.
    *   **Action Steps**:
        1. Evaluate risk.
    *   **Expected Outcome**: Risk is Medium.
    *   **Assertion**: Risk level = `Medium` (Yellow).

*   **TC-T2-24: Boundary Lead Time - Exactly 16 Days**
    *   **Description**: Verify that 16 days lead time is evaluated as High Risk.
    *   **Preconditions**: Shortage > 0, Lead Time = 16.
    *   **Action Steps**:
        1. Evaluate risk.
    *   **Expected Outcome**: Risk is High.
    *   **Assertion**: Risk level = `High` (Red).

*   **TC-T2-25: Missing Lead Time Value in DB**
    *   **Description**: Verify default behavior when lead time is null/empty.
    *   **Preconditions**: Material item has lead time set to `null` or empty.
    *   **Action Steps**:
        1. Evaluate risk.
    *   **Expected Outcome**: Risk is set to High (failsafe default) or flagged.
    *   **Assertion**: Risk level displays as `High` (Red) or "Unknown Lead Time".

*   **TC-T2-26: Missing Shipping Date past Deadline**
    *   **Description**: Verify high risk trigger when estimated shipping date exceeds target build deadline.
    *   **Preconditions**: Project build deadline is 2026-08-01. Item has shipping date 2026-08-05.
    *   **Action Steps**:
        1. Trigger risk evaluation.
    *   **Expected Outcome**: Risk is evaluated as High Risk.
    *   **Assertion**: Database risk record is `High` due to "Delivery past deadline".

*   **TC-T2-27: Draft Generation with Missing Supplier Info**
    *   **Description**: Verify fallback placeholders in email template when supplier info is absent.
    *   **Preconditions**: Item has no default owner/supplier.
    *   **Action Steps**:
        1. Trigger follow-up email draft.
    *   **Expected Outcome**: Template generates with standard placeholders like "[Supplier Name]".
    *   **Assertion**: Draft contains string "[供应商/负责人]" or "[Supplier / Owner]".

*   **TC-T2-28: Draft Generation with Extremely Long Material Names**
    *   **Description**: Verify email formatting remains intact under long names.
    *   **Preconditions**: Material name is 150 characters.
    *   **Action Steps**:
        1. Generate email draft.
    *   **Expected Outcome**: Layout does not break; name is cleanly displayed.
    *   **Assertion**: Draft contains the complete long name without truncation in the email body.

*   **TC-T2-29: Alerting Throttling**
    *   **Description**: Verify that identical alerts are not duplicated in the chat feed.
    *   **Preconditions**: High-risk item is flagged. Sync is run twice.
    *   **Action Steps**:
        1. Run sync #1. Observe warning.
        2. Run sync #2. Observe chat.
    *   **Expected Outcome**: Chat shows only one warning card; doesn't print second identical card.
    *   **Assertion**: Number of active risk cards in chat remains 1.

*   **TC-T2-30: Custom LLM Gateway Timeout**
    *   **Description**: Verify chatbot displays offline error if LLM gateway times out.
    *   **Preconditions**: LLM gateway request fails or takes longer than 10 seconds.
    *   **Action Steps**:
        1. Send message to Agent.
    *   **Expected Outcome**: Chat window renders connection failure alert card.
    *   **Assertion**: Chat log displays "Gateway timeout. Please check your network configuration."

---

### Tier 3: Cross-Feature Integration (6 Cases)

*   **TC-T3-01: Onboarding to Sync Integration Flow**
    *   **Description**: Verify full initial flow from onboarding to warehouse sync.
    *   **Preconditions**: Application is unconfigured.
    *   **Action Steps**:
        1. Input project metadata and paste BOM.
        2. Verify table loads.
        3. Click "Sync MASS Inventory".
    *   **Expected Outcome**: System successfully links project setup, populates database, calls sync API, updates quantities, and calculates shortages.
    *   **Assertion**: Left panel displays project info, right panel contains populated rows, stock counts update from 0, and calculated shortages match expectations.

*   **TC-T3-02: Sync to Risk Alert Integration Flow**
    *   **Description**: Verify that a warehouse sync triggering new risk levels immediately pushes an alert to the chat.
    *   **Preconditions**: Project onboarding complete. Items are Pending.
    *   **Action Steps**:
        1. Click "Sync MASS Inventory".
    *   **Expected Outcome**: Sync completes -> Risk Evaluator triggers -> High risk identified -> Agent chat prints warning card.
    *   **Assertion**: `.risk-alert-card` is rendered in chat within 2 seconds of sync completion.

*   **TC-T3-03: Risk Alert to Draft Email Flow**
    *   **Description**: Verify clicking draft button on proactive card extracts accurate details.
    *   **Preconditions**: Proactive risk warning card for M-001 is active in chat.
    *   **Action Steps**:
        1. Click "Draft Follow-up Email" inside the card.
    *   **Expected Outcome**: Chat displays custom-generated email draft featuring item name, code, shortage qty, and supplier name sourced from DB.
    *   **Assertion**: Email draft text contains the matching material code (`M-001`) and shortage quantity.

*   **TC-T3-04: Sync to Export Transition Flow**
    *   **Description**: Verify sync leads to correct shortage calculations which are correctly exported, updating item states.
    *   **Preconditions**: Onboarding complete.
    *   **Action Steps**:
        1. Click "Sync MASS Inventory".
        2. Verify shortages calculated.
        3. Click "Export OA Purchase Sheet".
    *   **Expected Outcome**: Exported CSV reflects the exact shortages calculated, and table rows update to `OA Submitted` (disabling further exports).
    *   **Assertion**: CSV quantities match table shortages; table columns display `OA Submitted`.

*   **TC-T3-05: Full Re-onboarding State Wipe**
    *   **Description**: Verify setup of a new project completely wipes prior project states.
    *   **Preconditions**: Project `PRJ-2026-X1` is active with inventory and chat history.
    *   **Action Steps**:
        1. Send message "Reset project and setup new project".
        2. Provide new details: `PRJ-2026-Y2`, `CC-RD-HW-05`, `10`.
        3. Paste new BOM.
    *   **Expected Outcome**: Prior database records are cleared; dashboard and left panel update with new project info.
    *   **Assertion**: Left panel shows `PRJ-2026-Y2`; old material codes are absent from the table.

*   **TC-T3-06: LLM Context Sync Flow**
    *   **Description**: Verify Agent's conversational replies match updated database state.
    *   **Preconditions**: Sync changes M-001 stock from 0 to 10 (shortage resolved).
    *   **Action Steps**:
        1. Sync MASS inventory.
        2. Ask Agent "Does M-001 have a shortage?".
    *   **Expected Outcome**: Agent answers that M-001 shortage is resolved.
    *   **Assertion**: Chat response text contains "no shortage" or "resolved".

---

### Tier 4: Real-World Scenarios (5 Cases)

*   **TC-T4-01: "New Project Launch" Full Journey**
    *   **Description**: Model a complete initial setup for a new engineer.
    *   **Preconditions**: Fresh database.
    *   **Action Steps**:
        1. Open UI.
        2. Follow onboarding, setting up project `PRJ-NEW-01`, cost center `CC-RD-01`, and target qty `10`.
        3. Paste a 5-item BOM.
        4. Trigger warehouse sync.
        5. Verify table updates and click "Export OA Purchase Sheet".
    *   **Expected Outcome**: End-to-end flow succeeds, resulting in a valid CSV and status transitioning to `OA Submitted` on the board.
    *   **Assertion**: Left panel displays active metadata; CSV downloaded containing 5 entries; database records set to `OA Submitted`.

*   **TC-T4-02: "Warehouse Shortage Fire Drill" Scenario**
    *   **Description**: Model handling a critical late-delivery item.
    *   **Preconditions**: Onboarding completed.
    *   **Action Steps**:
        1. Trigger sync. M-003 is matched with stock=0, leadTime=35 days.
        2. Agent posts a warning in chat.
        3. Click "Generate Email Draft" on the alert card.
        4. Click "Copy to Clipboard".
    *   **Expected Outcome**: High-risk flag raised; email generated and successfully copied with accurate info.
    *   **Assertion**: Risk level for M-003 is High (Red); copied text contains "M-003" and "lead time of 35 days".

*   **TC-T4-03: "Stock Replenishment & Verification" Scenario**
    *   **Description**: Model stock replenishment in MASS resolving shortages.
    *   **Preconditions**: Project has shortage on M-002 (Req: 10, Stock: 2, Shortage: 8).
    *   **Action Steps**:
        1. Mock MASS database updates M-002 stock to 15.
        2. Click "Sync MASS Inventory".
    *   **Expected Outcome**: Shortage updates to 0; Risk level drops from High to Low; active alert card is cleared.
    *   **Assertion**: UI displays stock=15, shortage=0, risk=Low; no active warning cards remain.

*   **TC-T4-04: "Procurement Officer Audit" Scenario**
    *   **Description**: Model audit validation of project progress KPIs.
    *   **Preconditions**: Onboarding complete, sync performed.
    *   **Action Steps**:
        1. Verify left panel KPIs (BOM coverage, buildable machines) match right panel values.
        2. Click export.
        3. Reconcile exported spreadsheet with table.
    *   **Expected Outcome**: Left panel calculations match table values; CSV contents correspond exactly to table.
    *   **Assertion**: Left column buildable machine count equals the minimum of `Floor(Stock / Qty per Machine)` across all rows.

*   **TC-T4-05: "Multi-item Lead Time Conflict" Scenario**
    *   **Description**: Model multiple concurrent shortages with different risk classes.
    *   **Preconditions**: 3 items have shortages: M-001 (Lead time: 5 days), M-002 (Lead time: 15 days), M-003 (Lead time: 30 days).
    *   **Action Steps**:
        1. Trigger risk evaluation.
    *   **Expected Outcome**: Risk levels evaluated as: M-001 (Medium), M-002 (Medium), M-003 (High). Chat displays warnings grouped by owner.
    *   **Assertion**: Table displays risk tags matching the rules; chat window contains distinct alerts for high-risk items.

---

## 6. Automation & Execution Verification

To verify that the testing infrastructure itself is operational and compile-safe:
1. Ensure all packages are installed:
   ```bash
   npm install
   ```
2. Run Vite frontend build check:
   ```bash
   npm run build:frontend
   ```
3. Run backend TypeScript type compilation check:
   ```bash
   npm run build:backend
   ```
4. Run Playwright E2E tests:
   ```bash
   npx playwright test
   ```
