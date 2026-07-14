# Context: Material Management Agent (MMA)

## Project Overview
The Material Management Agent (MMA) is an AI-driven, self-hosted web application deployed on the company's intranet. It is designed to automate the tracking, verification, allocation, and purchase requisition of engineering prototype materials.

## Domain Glossary
- **BOM (Bill of Materials)**: The product recipe listing all material items, quantity per build, and owners.
- **MASS System**: The internal warehouse inventory management system. Used as a read-only data source to query stock levels and project allocation status.
- **OA System**: The corporate administrative approval system. MMA generates an exportable spreadsheet (box table) for bulk upload to automate purchasing.
- **Cost Center (成本中心)**: The corporate department code responsible for funding the purchase.
- **Project Code (项目号)**: The unique ID associated with the prototype build program.
- **Shortage (物料缺口)**: `Required Qty - Current Stock` (where `Required Qty = Target Build Qty * Qty per Machine`).
- **Owner (负责人)**: The engineer assigned to review the purchase requirement and submit/trigger the purchase order in the OA system.
- **High-Risk Items**: Materials that have shortages AND have long shipping lead times or shipping dates past the target build date.

## User Interface Design (3-Column Layout)
1. **Left Column (Project Metadata Panel)**:
   - Displays basic project information (Project ID, Cost Center, Target Build Qty).
   - Display overall progress metrics (BOM coverage, estimated buildable machines with current stock, total purchase cost estimation).
2. **Middle Column (Agent Conversational Chat)**:
   - Chat interface for user interactions (BOM uploading/pasting, setup flow, general queries).
   - Real-time proactive alerts from the Agent regarding shortage warnings or delivery delays.
   - Text generation panels (e.g. copying email/message drafts to suppliers).
3. **Right Column (Visual Dashboard & Tools)**:
   - Graphical charts (build progress, stock status).
   - Complete material allocation table with search, filter, and sorting options.
   - Action buttons (e.g. "Export OA Excel/CSV", "Sync MASS Inventory").

## Deployment Architecture Constraints
- **Intranet Walled Garden**: The application must run completely self-hosted on internal servers without calling internet APIs.
- **Internal LLM Gateway**: The Agent framework must use internal company LLM endpoints (via customizable OpenAI-compatible API base URL and key).
- **Asset Localization**: No external runtime CDN assets (JS/CSS libraries, Google fonts, icons). All assets must be bundled locally.
