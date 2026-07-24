# Logistics AI Dashboard

An AI-powered analytics dashboard for a logistics client: a traditional KPI/chart dashboard plus a natural-language query interface backed by OpenAI tool-calling and a demand-forecasting tool. Built against [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md); full design rationale lives in [`docs/FSD.md`](docs/FSD.md).

**Live URL:** [logistics-ai-dashboard.robbywh.com](https://logistics-ai-dashboard.robbywh.com)

## Setup

### Requirements

- Node.js 20.19+
- A Prisma Postgres database (already provisioned via Prisma Compute, connected to this repo's GitHub `main` branch)
- An OpenAI API key

### Environment variables

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma Postgres (Accelerate) connection string, `prisma+postgres://...`. From the Prisma Console. |
| `OPENAI_API_KEY` | Yes (for Ask AI) | The dashboard (`/`) works without it — only `/api/query` depends on it. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |

### Local setup

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate    # applies prisma/migrations to your DATABASE_URL
npm run db:seed        # loads docs/data/mock_logistics_data.csv (400 orders)
npm run dev
```

`/` is the descriptive dashboard (no AI dependency); `/ask` is the natural-language interface.

### Tests

```bash
npm test                    # unit — 48 tests, no DB required
npm run test:coverage       # unit tests + coverage report
npm run test:integration    # 8 tests — real DB required (see Testing below)
npm run test:e2e            # 8 tests — Playwright; `npx playwright install chromium` once first
```

### Deployment

Deployed on [Prisma Compute](https://www.prisma.io/compute) (also hosts the database), wired to `main` — pushes auto-deploy. `next.config.ts` sets `output: "standalone"`, which Compute requires. Migrations are **not** run on every build (a bigger risk than the convenience is worth against a shared prod database); run these once manually against prod:

```bash
npm run db:deploy   # applies prisma/migrations to prod
npm run db:seed      # loads the CSV into prod
```

No authentication — the dataset is read-only, which the assignment's deployment notes treat as acceptable for a demo.

## Architecture

```
Browser
  ├─ / (Dashboard)   Client Component → React Query → GET /api/dashboard/summary
  ├─ /ask (Ask AI)   Client Component → React Query → POST /api/query, GET /api/query/history
  ▼
Next.js Route Handlers
  ├─ /api/dashboard/summary  ── deterministic Prisma fetch + aggregation (no AI)
  ├─ /api/query/history      ── reads recent QueryLog rows (no AI)
  └─ /api/query
        ▼
     AI Orchestrator (Vercel AI SDK + OpenAI)
        Call 1: model picks exactly one tool (toolChoice: "required")
                → queryAnalytics | forecastDemand | clarify
        (plain TypeScript executes the tool — no AI, no SQL from the model)
        Call 2: model restates ONLY the numbers in the tool's result
        ▼
     answer + chart + explainability → persisted to QueryLog → UI
                ▼
     Prisma Postgres: Order (read-only) · QueryLog (write-once per question)
```

**Key decisions:**

- **One denormalized `Order` table**, no lookup tables — matches the source CSV 1:1, appropriate for 400 rows and a 6–10 hour time-box.
- **Aggregation happens in TypeScript over an in-memory array, not DB-side `groupBy`.** `getAllOrders()` fetches all 400 rows once; every metric (`lib/dashboard.ts`, `lib/query-dsl.ts`, `lib/forecast.ts`) is a pure function over that array — unit-testable with no DB connection. Would move to DB-side aggregation if the dataset grew significantly.
- **The AI never touches SQL or the database.** It emits a zod-validated argument object; plain TypeScript executes it via array filtering. Chart type is a deterministic function of the query shape, never the model's choice. This keeps "AI interpretation," "computation," and "business logic" independently testable.
- **The dashboard has zero AI dependency** — `GET /api/dashboard/summary` never calls OpenAI.
- **Prisma 7 + Accelerate.** `prisma@7` removed the bundled query engine binary; the client connects via `accelerateUrl` (`@prisma/extension-accelerate`, `lib/prisma.ts`) since the database is Prisma Postgres. Connection config lives in `prisma.config.ts`, not the schema.
- **Accelerate caches the one read path that's safe to cache.** `getAllOrders()` sets `cacheStrategy: { ttl: 300, swr: 600 }` — the dataset only changes via manual reseed. `QueryLog` reads deliberately aren't cached (that table changes on every question; caching it would show a stale recent-questions list).
- **React Query for client-side state**, replacing manual `useEffect`/`useState` fetch plumbing. Dashboard keys on `["dashboard-summary", from, to]`; Ask AI's history list (`["query-history"]`) is invalidated after every successful mutation.
- **Query history is persisted, not computed** — `QueryLog` stores `{ question, toolUsed, response }`, written by the route handler after the orchestrator returns. Clicking a history entry re-submits the question through the normal mutation (a real, fresh AI call — not a replay). The list renders below the answer and is height-capped (`max-h-56 overflow-y-auto`), so it never pushes the answer down as history grows.

## Testing

A pyramid — most coverage at the bottom, fewest slower tests at the top. Full rationale in [`docs/FSD.md` §11](docs/FSD.md#11-testing-strategy).

| Layer | Tool | Where | Count | Covers |
|---|---|---|---|---|
| Unit | Vitest | `lib/*.test.ts` | 48 | Pure functions — aggregation, query DSL, date-anchor, forecasting, chart selection. No DB, no network. 100% coverage. |
| Integration | Vitest | `tests/integration/*.test.ts` | 8 | Real route handlers against the real database. Only the OpenAI call is mocked — the computation after it is real. |
| E2E | Playwright | `tests/e2e/*.test.ts` | 8 | Real browser + server. Dashboard specs hit the real DB; Ask AI specs mock `/api/query` at the network layer and verify rendering. |

AI is never called for real in any automated test — slow, costs money, non-deterministic. Whether the model *itself* picks the right tool for a question was verified manually during development, not by CI — a deliberate scope cut.

**⚠️ Integration tests write to whatever `DATABASE_URL` points at** (cleaned up in `afterEach`). Use a local/dev database, never production.

## AI Approach

**Provider:** OpenAI via the [Vercel AI SDK](https://ai-sdk.dev), model configurable via `OPENAI_MODEL` (default `gpt-4o-mini`).

**Flow** (`lib/ai/orchestrator.ts`): a routing call with `toolChoice: "required"` picks exactly one of `queryAnalytics` / `forecastDemand` / `clarify` — the model can never skip straight to a freeform answer. The route then runs the matching plain-TypeScript function (no AI-generated SQL or code). A second, short call restates only the numbers in the tool's result.

**Tool selection** is the model's job, but the *shape* it can express is a closed, zod-validated schema (metric enum, groupBy, filters) — not open-ended text or SQL.

**A lesson from building this:** OpenAI's tool-calling forces every schema property into the model's output regardless of Zod's `.optional()` — this caused the model to fabricate filter values (a random carrier, a wrong date) for fields the question never mentioned. Fixing it required making every optional field `.nullable()` too, giving the model a schema-legitimate way to say "not applicable."

**Relative dates** ("last month") resolve server-side against the *dataset's own* latest order date, not the real clock — the dataset is a static 2025 snapshot.

## Assumptions

- **No SLA/expected-delivery-date column exists**, so `status` is the delay signal: `DELIVERED` = on-time, `DELAYED`/`EXCEPTION` = late, `IN_TRANSIT`/`CANCELED` excluded (no completed outcome yet).
- **Forecasting runs at product-category level, not per-SKU** — 355 of 400 rows have a distinct SKU, nowhere near enough history to fit a trend per SKU.
- **Relative date phrases anchor to the dataset's `MAX(orderDate)`**, not wall-clock time.
- **"Last month" and similar are trailing windows**, not calendar-aligned months.
- **No authentication** — single shared, read-only dataset, acceptable per the assignment's deployment notes for a demo.

## Limitations

- Forecasting is category-level only.
- No multi-turn conversation memory in Ask AI.
- Chart types are limited to line/bar/stat by design.
- When a user names a specific SKU, the model *usually* but not always states in prose that it substituted the category level (the query plan always shows it regardless).
- AI responses take ~3–12 seconds (two sequential model calls). No streaming yet.
- Query history capped at the last 10 questions, no pagination.
- Underlying-data tables show aggregated rows, not a raw drill-down into all 400 orders.

## Future Improvements

- Exponential smoothing as a second forecasting method.
- Multi-turn chat context for follow-up questions.
- Stream the routing/answer generation instead of one long wait.
- Move aggregation to DB-side `groupBy` if the dataset grows significantly.
- Pagination on the query-history list.
- Cache-tag-based Accelerate invalidation wired into `db:seed`.
- A dedicated test database for integration tests.
- CI (GitHub Actions) to run all three test layers on push/PR.
