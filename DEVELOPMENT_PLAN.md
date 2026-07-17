# MMA Development Plan & Handover Guide

This document acts as the master developer guide and sitemap for continuing development of the **Material Management Agent (MMA)** on any machine.

---

## 1. Project Status & Roadmap

All components built so far compile successfully, and the complete test suite (14 test files, 142 test cases) is green.

| Milestone | Status | Description | Files Developed / Target Files |
|---|---|---|---|
| **M1: Scaffolding & DB** | **DONE** | Scaffolding, TS compilation, and `LocalDb` memory cache persistence. | `server/db.ts`, `tsconfig.json` |
| **M2: Business Logic** | **DONE** | BOM parser, shortage calculation, and lead-time risk evaluation. | `server/bomParser.ts`, `server/calcEngine.ts`, `server/riskEvaluator.ts` |
| **M3: Frontend UI** | **DONE** | Glassmorphic 3-column UI layout, filters, search, and state synchronization. | `src/App.tsx`, `src/index.css`, `src/context/ProjectContext.tsx` |
| **M4: Conversational Agent** | **PLANNED** | Integration of Vercel AI SDK, local LLM routing, onboarding flows. | *Next Task:* `server/agentEngine.ts`, `/api/chat` endpoint |
| **M5: E2E Integration** | **PLANNED** | Fully integrated E2E verification tests and final Forensic Audit. | *Verification:* `tests/e2e.test.ts` |

---

## 2. Environment Setup (For the New Machine)

To restore and run this project on a new machine:
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/MarcusLu-999/mymaterial.git
   cd mymaterial
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the intranet model gateway endpoints:
   ```bash
   copy .env.example .env
   ```
   *Edit `.env` to supply the correct `OPENAI_API_BASE_URL` and `OPENAI_API_KEY` for your corporate network LLM gateway.*
4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   *This starts the Express backend on port `3001` and the Vite/React frontend on port `3000` concurrently.*
5. **Run the Test Suite**:
   ```bash
   npm test
   ```

---

## 3. Next Steps: What to Develop Next

### M4. Conversational Agent & Vercel AI SDK Integration
The React client in `src/context/ProjectContext.tsx` is already configured to make calls to `/api/chat`. The next task is to write the backend handler:

1. **Create `server/agentEngine.ts`**:
   - Initialize the Vercel AI SDK or OpenAI SDK client using the environment variables (`OPENAI_API_BASE_URL`, etc.).
   - Define a robust **System Prompt** covering the two phases of the agent:
     - **Onboarding Mode**: If `db.getProject()` is empty, guide the user to input the Project ID, Cost Center, Target Qty, and a BOM text paste. Parse user inputs using regular expressions or structured JSON output.
     - **Copilot Mode**: Once setup is active, answer questions about item stock levels, calculate shortages, flag risk elements, and output email drafts.
   - Implement **Fallback Extraction**: If the company's internal gateway doesn't support structured tool calling parameters, instruct the LLM to output custom XML tags (e.g. `<setup_project>`, `<generate_email>`) and parse them inside the agent handler.
2. **Expose `/api/chat` in `server/index.ts`**:
   - Handle the `POST /api/chat` route.
   - Pass messages to `agentEngine.ts`.
   - Update the local DB if onboarding triggers a setup command.
   - Return `{ chatHistory: Message[], reply: string }`.

---

## 4. Next Steps: What to Test Next

### M5. E2E Integration & Verification
Once the conversational agent API is registered, write the following test suites to verify integration:

1. **Unit Tests (`tests/agentEngine.test.ts`)**:
   - Verify prompt injection and parsing under mock LLM outputs.
   - Verify that setup parameters (ID, cost center, target quantity) are extracted correctly from conversational inputs.
2. **Integration Tests (`tests/api.chat.test.ts`)**:
   - Mock the LLM endpoint responses.
   - Test that calling `/api/chat` with setup instructions actually initializes the SQLite/JSON database correctly.
   - Test that calling `/api/chat` for email generation triggers a response with populated email draft metadata.
3. **E2E verification (`tests/e2e.test.ts`)**:
   - Write a complete integration flow test that runs the entire sequence:
     1. Client sends onboarding setup commands.
     2. Server parses and initializes empty database.
     3. Client pastes BOM text; server parses and populates items.
     4. Client triggers MASS sync; server queries inventory and sets risk levels.
     5. Client requests email draft; agent generates copyable draft.
     6. Client triggers OA spreadsheet export; server marks items as `OA Submitted` and generates CSV.
