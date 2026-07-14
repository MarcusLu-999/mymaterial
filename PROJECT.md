# Project: AI Material Management Agent (MMA)

## Architecture
The system follows a TypeScript Full-stack architecture (Vite + React frontend and Express backend) running inside a single intranet server environment. A local database (JSON-based or SQLite) persists the state of the project, BOM items, and conversational logs.

```mermaid
graph TD
    subgraph Client (Vite + React)
        LeftPane[Left Column: Project Meta]
        MidPane[Middle Column: AI Agent Chat]
        RightPane[Right Column: Kanban & Dash]
        State[React Context / State Store]
    end

    subgraph Server (Node.js + Express)
        API[Express Router]
        AgentEngine[AI Agent Engine]
        DB[(Local JSON / SQLite DB)]
    end

    subgraph Corporate Network
        LLM[Internal LLM Gateway]
        MASS[MASS Warehouse System - Read Only]
    end

    LeftPane --> State
    MidPane --> State
    RightPane --> State
    State <-->|HTTP / SSE / JSON| API
    API <--> AgentEngine
    API <--> DB
    AgentEngine <-->|OpenAI SDK / HTTP| LLM
    API -->|Read-Only Queries| MASS
```

## Code Layout
- `server/`: Backend code.
  - `server/index.ts`: Express entrypoint and API routes.
  - `server/db.ts`: Local JSON/SQLite database store.
  - `server/bomParser.ts`: Utilities to parse CSV/TSV/pasted text.
  - `server/calcEngine.ts`: Qty shortage and buildable calculation engine.
  - `server/riskEvaluator.ts`: Lead time and delay risk check.
- `src/`: Frontend React code.
  - `src/main.tsx`: Entry file.
  - `src/index.css`: Glassmorphic styling definitions.
  - `src/App.tsx`: Main React component coordinating Left, Middle (Chat), and Right columns.
- `tests/`: Unit & integration tests.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|---|---|---|---|---|
| 1 | Scaffolding & DB Setup | Complete package dependencies, TS configurations, and local JSON database schema & migrations. | None | IN_PROGRESS | 043ec946-c1b6-421d-a72a-00beddfac3f8 |
| 2 | Backend APIs & Business Logic | Implement BOM parser, MASS sync logic, and OA export logic in backend with unit tests. | M1 | PLANNED | |
| 3 | Frontend UI (3 Columns) | Construct glassmorphic dark-theme UI with Left Panel, Chat Window, and Kanban. | M1 | PLANNED | |
| 4 | Conversational Agent & Vercel AI SDK | Integrate Vercel AI SDK, setup chat streaming, and implement Agent tools on backend. | M2, M3 | PLANNED | |
| 5 | E2E Integration & Verification | E2E Testing Track integration, passing all tests, adversarial coverage hardening, and Forensic Audit. | M4, TEST_READY.md | PLANNED | |

## Interface Contracts
### Client ↔ Server APIs
- `GET /api/project`: Fetch current project state and metadata (Project ID, Cost Center, Target Qty, BOM coverage, estimated buildable machines).
- `POST /api/project/setup`: Input project ID, cost center, target qty, and raw BOM text/file. Returns success and parsed BOM items.
- `POST /api/chat`: Send chat message history. Streams response (text/tools) using Vercel AI SDK.
- `GET /api/mass/sync`: Sync stock with mock MASS warehouse. Updates SQLite database. Returns synced inventory.
- `POST /api/purchase/export`: Mark items as `OA Submitted` and export CSV. Returns download stream.
- `GET /api/health`: Verify server health.
