# Implementation Plan: Logistics AI Dashboard

Spec: [`docs/FSD.md`](../docs/FSD.md) · Requirements: [`docs/REQUIREMENTS.md`](../docs/REQUIREMENTS.md)

## Overview

Build a Next.js 16 (App Router) dashboard over the 400-row `docs/data/mock_logistics_data.csv`, seeded into Prisma Postgres. Two vertical paths: a deterministic descriptive dashboard, and an AI-orchestrated "Ask AI" page (OpenAI tool-calling → two deterministic tools: query + forecast). Tailwind v4 for styling, Recharts for charts.

## Architecture Decisions

- **One denormalized `Order` table**, no lookup tables — matches the CSV 1:1, keeps every aggregation a single Prisma call. See FSD §3.2.
- **`status` is the delay signal** (no SLA column in source data) — FSD §3.3(1).
- **Forecasting is category-level**, not raw SKU — per-SKU history is too sparse (355 SKUs / 400 rows) — FSD §3.3(2).
- **Relative dates anchor to `MAX(orderDate)` in the dataset**, not wall-clock `now()` — the dataset is a fixed 2025 snapshot — FSD §3.3(3). This is a correctness-critical detail; get it right in the DSL resolver, not per-caller.
- **AI never queries the DB or emits SQL.** It emits zod-validated tool args; plain TS executes them via Prisma's query builder. Chart type is chosen by a pure function, not the model. FSD §4, §6.
- **OpenAI via Vercel AI SDK**, `toolChoice: "required"` so every question either resolves to a tool call or an explicit clarify response — never a freeform ungrounded answer.
- **Dashboard summary route has zero AI dependency** — it must work even if the AI provider is down/unconfigured.

## Dependency Graph

```
Prisma schema + seed (from CSV)
    │
    ├── Dashboard summary aggregation logic ──► /api/dashboard/summary ──► Dashboard page + charts
    │
    └── Structured Query DSL (zod) ──┬──► queryAnalytics tool ──┐
                                      │                          ├──► AI orchestrator ──► /api/query ──► Ask AI page
        Forecast math (regression) ──┴──► forecastDemand tool ──┘
```

Dashboard and Ask-AI paths only share the Prisma schema — they can be built and verified independently once Phase 0 lands.

## Task List

### Phase 0: Foundation

- [ ] Task 1: Prisma schema, migration, CSV seed script
- [ ] Task 2: App shell — layout, nav, Tailwind base, env scaffolding

### Checkpoint 0: Foundation
- [ ] `npx prisma migrate dev` runs clean; `npx prisma db seed` loads exactly 400 orders
- [ ] `npm run dev` boots; empty shell renders with nav between `/` and `/ask`
- [ ] `npm run build` succeeds

### Phase 1: Descriptive Dashboard

- [ ] Task 3: `GET /api/dashboard/summary` — KPI + chart-data aggregation
- [ ] Task 4: Dashboard page — KPI cards + 3 charts + date-range control

### Checkpoint 1: Dashboard
- [ ] KPI numbers hand-verified against a manual CSV calc (spot-check 2 KPIs)
- [ ] All 3 charts render with real data, no console errors
- [ ] Changing the date range updates KPIs and charts together

### Phase 2: AI Query Orchestration

- [ ] Task 5: Structured Query DSL (zod) + `queryAnalytics` tool (pure, unit-tested)
- [ ] Task 6: `POST /api/query` — OpenAI tool-calling orchestrator
- [ ] Task 7: Ask AI page — input, answer, chart, explainability panel

### Checkpoint 2: Ask AI (query path)
- [ ] All 3 example questions from REQUIREMENTS §4.2 return correct, grounded answers
- [ ] Explainability panel shows filters/metric/query plan/underlying data for each
- [ ] A nonsense question triggers `clarify`, not a hallucinated answer

### Phase 3: Forecasting

- [ ] Task 8: Forecast math — monthly aggregation + linear regression + inventory recommendation (unit-tested)
- [ ] Task 9: `forecastDemand` tool wired into the orchestrator + forecast chart (historical + projected)

### Checkpoint 3: Forecasting
- [ ] "Predict demand for CRAYON for the next 4 months" returns a sane trend, recommendation, and methodology string
- [ ] Forecast for a second category also looks sane (not flat/negative/nonsensical)

### Phase 4: Explainability polish + bonus

- [ ] Task 10: Underlying-data table/drawer shared by dashboard charts and Ask AI answers
- [ ] Task 11 *(bonus, optional)*: `QueryLog` persistence + "recent questions" list on `/ask`

### Checkpoint 4: Polish
- [ ] Every chart (dashboard + Ask AI) can show its underlying rows on demand
- [ ] Loading and error states exist for both API routes (no raw stack traces reach the UI)

### Phase 5: Deployment & Docs

- [ ] Task 12: Build/deploy wiring — `postinstall` (`prisma generate`), `.env.example`, migrate-deploy instructions
- [ ] Task 13: `README.md` — Setup, Architecture, AI Approach, Assumptions, Limitations, Future Improvements (per REQUIREMENTS §11)
- [ ] Task 14: Verify the live Vercel URL end-to-end with seeded prod DB (once user supplies `DATABASE_URL`/`OPENAI_API_KEY` in Vercel)

### Checkpoint 5: Ship
- [ ] Live URL loads dashboard with real data
- [ ] Live URL answers an Ask AI question end-to-end
- [ ] README complete per REQUIREMENTS §11
- [ ] Human review — go/no-go

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No `DATABASE_URL`/`OPENAI_API_KEY` available locally | Blocks seeding + AI testing | Scaffold with `.env.example` + placeholders now (per user's choice); ask for real values right before Task 1's seed step and Task 6's AI wiring |
| Sparse per-SKU history breaks naive forecasting | Wrong/misleading forecasts | Forecast at `productCategory` granularity (FSD §3.3.2), documented, not silently degraded |
| Relative date phrases anchored to real `now()` | Silently empty results (dataset is 2025-only) | Anchor resolver uses `MAX(orderDate)`, unit-tested explicitly for this case |
| Model returns freeform answer without calling a tool | Violates "AI must not generate answers without computation" | `toolChoice: "required"` + explicit `clarify` path instead of a bare text fallback |
| OpenAI API down/rate-limited | Ask AI page breaks | Dashboard has zero AI dependency (Phase 1 ships independently); `/api/query` returns a clean 502 message, not a crash |

## Open Questions

- Confirm target OpenAI model (default proposal: `gpt-4o-mini` for cost; upgrade to `gpt-4o` if tool-selection accuracy is poor in testing).
- Confirm whether Task 11 (query history bonus) is worth the time before Phase 5, or should be dropped to protect the deployment/docs checkpoint.
