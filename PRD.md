# Product Requirements Document (PRD) — Material Management Agent (MMA)

## 1. Introduction
The Material Management Agent (MMA) is designed to help hardware and system engineering teams manage material availability, verify warehouse stock, calculate shortages, and generate purchase orders for prototype builds.

## 2. Target Audience & Environment
- **Audience**: Hardware Engineers, Project Managers, Procurement Coordinators.
- **Environment**: Company Intranet (air-gapped/no outbound internet access).
- **LLM Provider**: Internal company LLM gateway (OpenAI API-compatible).

## 3. Functional Requirements

### FR1. Conversational Onboarding & Setup
- **Onboarding Trigger**: If the local database has no project set up, the Agent must initiate a guided setup flow in the chat interface.
- **Onboarding Inputs**:
  - Project ID (e.g. `PRJ-2026-X1`)
  - Cost Center (e.g. `CC-RD-HW-03`)
  - Target Build Quantity (Integer, e.g. `5` machines)
  - BOM Import (Supports copying and pasting plain text BOM or uploading a CSV/Excel file).
- **BOM Fields**: The BOM must contain at least:
  - `物料号` (Material Code)
  - `物料名称` (Material Name)
  - `单机用量` (Qty per Build)
  - `负责人` (Default Owner)
- **Data Initialization**: The system parses the BOM and saves the target list to the local database, setting the initial state of all items to `Pending`.

### FR2. 3-Column User Interface
- **Left Column: Project Metadata Panel**
  - Displays Project ID, Cost Center, Target Qty, and current timestamp.
  - Overall status cards:
    - **BOM Coverage**: Percentage of items with sufficient stock.
    - **Estimated Buildable Machines**: Math: `Min(Available Stock / Qty per Build)` across all BOM items.
    - **Shortage Items Count**: Count of items with positive shortage.
- **Middle Column: Agent Conversational Chat Window**
  - Text-based interactive chat with the AI Agent.
  - Proactive notification area inside the chat flow for warnings.
  - Action cards: Single-click copy or action trigger cards for email generation.
- **Right Column: Kanban & Inventory Dashboard**
  - High-end visual dashboard displaying the main BOM and inventory status list.
  - **Material Table Columns**: Material Code, Name, Qty per Machine, Required Qty, Current Stock, Shortage, Owner, Lead Time (Days), Delivery Status, Risk Level (High, Medium, Low).
  - Search, Filter (All / Shortage Only / High Risk Only), and Sort functions.
  - Action Controls:
    - **Sync MASS Inventory**: Manually triggers a mock query to the warehouse system database.
    - **Export OA Purchase Sheet**: Generates and downloads a spreadsheet containing the shortage requirements.

### FR3. Read-Only "MASS" Warehouse Synchronization
- **MASS Data Model**: The warehouse system contains inventory levels for all material codes, along with a flag indicating whether the stock is "allocated to Project X".
- **Query Mechanism**: The MMA queries MASS using the material codes from the parsed BOM.
- **Read-Only Constraint**: Under no circumstances should MMA write, alter, or delete records in MASS. It only queries current stock.
- **Mock Implementation**: For PoC/deployment demonstration, the system must include a mock MASS API or database containing pre-defined warehouse stock data, which changes periodically or can be queried.

### FR4. OA System Spreadsheet Export
- **Requisition Formula**: `Shortage = Max(0, (Target Build Qty * Qty per Machine) - MASS Available Stock)`.
- **Export File Format**: Standard CSV or Excel (`.xlsx`) file.
- **Excel Columns**:
  - `物料号` (Material Code)
  - `数量` (Shortage Quantity)
  - `负责人` (Owner)
  - `成本中心` (Cost Center)
  - `项目号` (Project Number)
- **State Transition**: Upon successful export, the item's purchase status on the dashboard transitions from `Pending` to `OA Submitted`.

### FR5. Proactive Risk Alerting & Follow-up Drafts
- **Risk Rules**:
  - **High Risk**: Shortage > 0 AND Lead Time > 15 days, OR mock shipping date is missing/delayed beyond project deadline.
  - **Medium Risk**: Shortage > 0 AND Lead Time <= 15 days.
  - **Low Risk**: Shortage == 0.
- **Proactive Chat Alerts**: The Agent must periodically scan the material list and post warning messages in the chat panel if new high-risk items are identified.
- **Draft Generator**: Support automated drafting of supplier inquiry emails (in Chinese/English) containing the specific material code, shortage quantity, and expected delivery dates, with a copy-to-clipboard button.

## 4. Non-Functional Requirements
- **Privacy & Security**: All user data, BOM files, and conversation logs must reside locally in the client/server database. No telemetry or analytics sending back to internet servers.
- **Local Assets**: All styles, icons (e.g. Lucide), fonts (e.g. Inter/Roboto), and JS libraries must be bundled at build time. No loading of assets from public CDNs.
- **Performance**: Inventory calculations and table filtering must handle up to 1,000 BOM rows with zero lag (< 100ms response).
