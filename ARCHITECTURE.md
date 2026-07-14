# System Architecture Document — Material Management Agent (MMA)

This document details the architectural decisions, framework comparisons, and final technology selection for the Material Management Agent (MMA) to be deployed on the company's intranet.

---

## 1. Technical Stack Comparison & Selection (CTO Perspective)

Deploying an AI-agent system to an air-gapped corporate intranet server poses three key constraints:
1. **Network Walled Garden**: Cannot download packages at runtime or call external public endpoints (e.g. OpenAI, Claude, Gemini, public CDNs).
2. **Local LLM Integration**: Must connect to an internal corporate LLM gateway via custom base URLs/keys (using OpenAI API format).
3. **Operational Overhead**: Deploying and maintaining multiple runtimes (e.g., Python + Node) in a corporate server environment requires twice the coordination, patching, and resource allocation.

We evaluated two main paths:

### Route A: TypeScript Full-stack (React + Node.js + Vercel AI SDK)
*   **Architecture**: A single Node.js runtime hosting a Vite-built React frontend and an Express/Fastify API backend.
*   **AI Framework**: Vercel AI SDK (`@ai-sdk/openai`) to communicate with the internal LLM gateway, paired with a custom structured state manager or LangGraph.js.
*   **Pros**:
    - **Single Runtime**: Only Node.js is required on the server, simplifying Docker packaging and corporate deployment compliance.
    - **Vercel AI SDK Integration**: Built-in support for streaming text, tool calling, and structured state synchronization back to the React UI out-of-the-box.
    - **Generative UI & State Synchronization**: Extremely easy to update the dashboard's right column in real time when the agent processes commands in the middle column.
*   **Cons**:
    - Smaller ecosystem of pre-built ML/agent libraries compared to Python.

### Route B: Hybrid Stack (React Frontend + Python FastAPI Backend + CrewAI/LangGraph)
*   **Architecture**: Vite/React frontend communicating via HTTP/WebSockets with a Python FastAPI server running the agent logic.
*   **AI Framework**: LangGraph Python, CrewAI, or AutoGen.
*   **Pros**:
    - **Ecosystem**: Python possesses the absolute richest library of agentic architectures, local OCR/parsing engines (for Excel/PDF BOMs), and local embedding indexes.
*   **Cons**:
    - **High Deployment Footprint**: Requires maintaining both Node.js (build-time) and Python (runtime) environments. Python package installations (wheels, binary deps) can be notoriously brittle to set up behind offline enterprise proxies.
    - **Streaming Complexity**: Streaming intermediate tool logs and chatbot tokens from Python to React requires writing custom SSE (Server-Sent Events) or WebSocket wrappers, increasing boilerplate.

### CTO Decision: Route A (TypeScript Full-stack)
For a robust, high-performance, and easily maintainable PoC/Production application on an intranet server, we select **Route A**.
- **Reasoning**: The core complexity of this system is **not** local deep learning model training, but rather **real-time state synchronization between the chat conversational flow, project metadata, and the inventory dashboard**. The Node.js ecosystem with the Vercel AI SDK provides the cleanest model for streaming tool calls and state updates to React.
- **Intranet Readiness**: Node.js has a tiny footprint. We will configure the backend to use `@ai-sdk/openai` with custom `baseURL` pointing to the internal company LLM endpoint, guaranteeing offline compatibility. All styling, fonts, and icons will be bundled locally at compile time.

---

## 2. System Architecture Design

MMA is structured as a client-server architecture running inside a single container or server process:

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
        DB[(Local SQLite / JSON DB)]
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

### Component Details
1. **Frontend UI**: Built with React and structured as a three-column layout. Uses Vanilla CSS/CSS Modules for styling. React Context manages overall state (project setup, BOM details, inventory lists, and chat messages).
2. **Backend API (Express)**:
   - Handles static file serving for React.
   - Standard REST endpoints:
     - `POST /api/project/setup`: Sets up project variables and parses BOM data.
     - `GET /api/mass/sync`: Connects to MASS mock to fetch stock and matches it against current BOM requirements.
     - `POST /api/purchase/export`: Generates the downloadable CSV/Excel spreadsheet.
   - `POST /api/chat`: Agent route using Vercel AI SDK. It streams agent completions and triggers local tools.
3. **Agent Engine & Tools**:
   - Built using Vercel AI SDK's `streamText` or `generateText`.
   - Equipped with local tools:
     - `checkInventory()`: Calls the local MASS sync.
     - `generateDraftEmail(supplierInfo, shortageDetails)`: Returns a pre-formatted message.
     - `exportPurchaseOrder()`: Prepares the CSV download.
4. **Data Persistence**:
   - Uses a local **SQLite** database (`mma.db`) or localized JSON files in the working directory for storing project setup, BOM items, history logs, and simulated MASS stock levels.
5. **Intranet/Offline Isolation**:
   - Font loading: System fonts or locally saved font files (no Google Font links).
   - Icons: Lucide React (imported locally, no CDN scripts).
   - Local LLM Connector: Node backend reads environment variables `LLM_API_BASE_URL` and `LLM_API_KEY` to initialize the model.
