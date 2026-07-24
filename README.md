# Logistics AI Dashboard

An AI-powered analytics dashboard for a logistics client: a traditional KPI/chart dashboard plus a natural-language query interface backed by OpenAI tool-calling and a demand-forecasting tool. Built against [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md); full design rationale lives in [`docs/FSD.md`](docs/FSD.md).

**Live URL:** [logistics-ai-dashboard.robbywh.com](https://logistics-ai-dashboard.robbywh.com)

## Setup

### Requirements

- Node.js 20.19+
- A Prisma Postgres database (this project already has one provisioned via Prisma Compute, connected to this repo's GitHub `main` branch)
- An OpenAI API key

### Environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma Postgres (Accelerate) connection string, `prisma+postgres://...`. Copy it from the Prisma Console (Database → Connection strings). |
| `OPENAI_API_KEY` | Yes (for Ask AI) | The dashboard (`/`) works without it — only `/api/query` depends on it. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |

### Local setup

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate    # applies prisma/migrations to your DATABASE_URL
npm run db:seed        # loads docs/data/mock_logistics_data.csv (400 orders)
npm run dev
```

Then open `http://localhost:3000`. `/` is the descriptive dashboard (no AI dependency); `/ask` is the natural-language interface.

### Tests

```bash
npm test    # vitest — 22 unit tests over the aggregation, query DSL, date-anchor, and forecast logic
```

### Deployment

Deployed on [Prisma Compute](https://www.prisma.io/compute), which also hosts the Prisma Postgres database — wired to this repo's GitHub `main` branch, so pushes auto-deploy. `next.config.ts` sets `output: "standalone"`, which Compute requires for Next.js apps. Two things are **not** automatic and need to be run once against the production database:

```bash
npm run db:deploy   # npx prisma migrate deploy — applies prisma/migrations to prod
npm run db:seed      # loads the CSV into prod (needs DATABASE_URL pointed at prod)
```

Migrations are deliberately **not** run on every build (no `prisma migrate deploy` in the build command) — for a small project like this, auto-running migrations on preview deploys against a shared production database is a bigger risk than the convenience is worth. Also set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as environment variables on the Prisma Compute app.

No authentication — the dataset is read-only and the assignment's deployment notes treat that as acceptable for a demo.

## Architecture

```
Browser
  │
  ├─ / (Dashboard)         Client Component → React Query → GET /api/dashboard/summary
  ├─ /ask (Ask AI)         Client Component → React Query → POST /api/query, GET /api/query/history
  │
  ▼
Next.js App Router (Route Handlers)
  │
  ├─ /api/dashboard/summary  ── deterministic Prisma fetch + pure aggregation (no AI)
  ├─ /api/query/history      ── reads recent QueryLog rows (no AI)
  │
  └─ /api/query
        │
        ▼
     AI Orchestrator (Vercel AI SDK + OpenAI)
        │  Call 1: model must pick exactly one tool (toolChoice: "required")
        │           → queryAnalytics | forecastDemand | clarify
        │  (plain TypeScript executes the tool — no AI, no SQL from the model)
        │  Call 2: model restates ONLY the numbers in the tool's result
        ▼
     { answer, explanation, chartType, data } → persisted to QueryLog → UI (chart + explainability panel)
                                                      ▼
                                            Prisma Postgres
                                              ├─ Order (read-only, 400 seeded rows, Accelerate-cached reads)
                                              └─ QueryLog (write-once per question, powers recent-questions list)
```

**Key design decisions:**

- **One denormalized `Order` table**, no lookup tables. Matches the source CSV 1:1 — simplicity over normalization, appropriate for a 400-row dataset and a 6–10 hour time-box.
- **Aggregation happens in TypeScript over an in-memory array, not DB-side `groupBy`.** `getAllOrders()` fetches all 400 rows once (`lib/orders.ts`); every metric — dashboard KPIs, the query DSL, and forecasting — is a pure function over that array (`lib/dashboard.ts`, `lib/query-dsl.ts`, `lib/forecast.ts`). This keeps every computation unit-testable against the real seed data with **no database connection required**, at a scale (400 rows) where the performance tradeoff is irrelevant. Would move to DB-side aggregation if the dataset grew significantly.
- **The AI never touches SQL or the database.** It emits a small, zod-validated argument object; a plain TypeScript function executes it via array filtering/grouping. Chart type (`line`/`bar`/`stat`) is chosen by a deterministic pure function of the query shape, never by the model. This is what makes "AI interpretation," "data computation," and "business logic" independently testable, three separate layers rather than one AI call that does everything.
- **The dashboard has zero AI dependency.** `GET /api/dashboard/summary` never calls OpenAI — it works even if the AI provider is down or the key is missing.
- **Prisma 7 + Accelerate.** This project pins `prisma@7`, which removed the bundled query engine binary in favor of either a driver adapter or Prisma Accelerate. Since the database is Prisma Postgres (accessed through Accelerate's connection pool), the client is constructed with `accelerateUrl` (`@prisma/extension-accelerate`) rather than a driver adapter — see `lib/prisma.ts`. Connection config lives in `prisma.config.ts`, not the schema's `datasource` block; the generated client (`generated/prisma/`) is gitignored and regenerated via `postinstall`.
- **Accelerate query caching, scoped to the one read path that's safe to cache.** `getAllOrders()` (`lib/orders.ts`) is the single `findMany()` behind every dashboard request and every AI query — same no-arg call every time, against a dataset that only changes via a manual `db:seed` re-run. The client is wrapped with `withAccelerate()` and that query sets `cacheStrategy: { ttl: 300, swr: 600 }`, so repeat requests hit Accelerate's edge cache instead of the database. One cache entry covers all date ranges, since filtering happens in-memory after the fetch. `QueryLog` reads deliberately do **not** use `cacheStrategy` — that table changes on every question, and an Accelerate cache would show a stale "recent questions" list until the TTL expired (a real bug I hit and fixed while building this: the history list didn't show the question I'd just asked). After a production `Order` reseed, call `prisma.$accelerate.invalidateAll()` (or just wait out the `ttl`) to drop the stale entry.
- **React Query for client-side state.** Both pages replaced manual `useEffect`/`useState` fetch plumbing with `@tanstack/react-query`. The dashboard keys its query on `["dashboard-summary", from, to]`, so re-selecting a previously-viewed date range in the same session is a cache hit. Ask AI keys history on `["query-history"]` and invalidates it in the `POST /api/query` mutation's `onSuccess`, so a newly-asked question shows up in the list immediately. This is a session-local complement to the Accelerate cache above, not a replacement — it doesn't share state across users/tabs.
- **Query history persisted, not computed.** `QueryLog` (new Prisma model) stores `{ question, toolUsed, response }` per `/api/query` call, written by the route handler after the orchestrator returns — not inside the orchestrator, keeping "call the AI" and "log the result" as separate steps. `GET /api/query/history` returns the last 10. Clicking an entry in the UI re-submits that question through the normal `POST /api/query` mutation — it's a shortcut for "ask this again," not a replay of the stored answer, so it always reflects a real, current AI response rather than a cached one. Only the *read* endpoints (`/api/dashboard/summary`, `/api/query/history`) are cached (Accelerate server-side, React Query client-side) — the AI call itself is never served from a cache.

## AI Approach

**Provider:** OpenAI via the [Vercel AI SDK](https://ai-sdk.dev) (`ai` + `@ai-sdk/openai`), model configurable via `OPENAI_MODEL` (default `gpt-4o-mini`).

**Flow** (`lib/ai/orchestrator.ts`):

1. **Routing call** — `generateText` with three tools (`queryAnalytics`, `forecastDemand`, `clarify`) and `toolChoice: "required"`. The model must call exactly one — it can never skip straight to a freeform answer. `clarify` is itself a tool, used for off-topic or too-ambiguous questions, so "I can't answer that" is a legitimate, schema-sanctioned outcome rather than the model breaking the "must call a tool" rule.
2. **Deterministic execution** — the route reads which tool was called and its validated arguments, then runs the matching plain-TypeScript function (`executeQueryAnalytics` or `forecastCategory`). No AI-generated SQL or code ever executes.
3. **Grounded answer call** — a second, short `generateText` call receives the tool's actual computed result (as JSON) and is instructed to restate *only* the numbers present in it, never introduce new ones.

**Tool selection logic** is entirely the model's job (that's the point of tool-calling), but the *shape* of what it can express is a closed, zod-validated schema — a metric enum, an optional groupBy dimension, and a small set of filter fields — not open-ended text or SQL. This is the "structured query generation, not raw AI SQL" principle from the assignment's architecture guidelines.

**A concrete lesson from building this:** OpenAI's tool-calling forces every schema property to be present in the model's output, regardless of Zod's `.optional()`. Early on this caused the model to fabricate plausible-but-wrong filter values (a random carrier, a random region, even a wrong-decade date) for fields the user's question never mentioned — no amount of prompt engineering fixed it. The actual fix was making every optional field `.nullable()` too, so the model has a schema-legitimate way to say "not applicable" instead of inventing a value. Worth knowing if you extend the tool schemas.

**Relative dates** ("last month", "last 3 months") are resolved server-side against the *dataset's own* latest order date (`lib/date-anchor.ts`), not the server's real clock — the dataset is a static 2025 snapshot, so anchoring to real "today" would silently return empty results for every relative-date question.

## Assumptions

- **No SLA/expected-delivery-date column exists in the source data**, so `status` is treated as the authoritative delay signal: `DELIVERED` = on-time, `DELAYED`/`EXCEPTION` = late, `IN_TRANSIT`/`CANCELED` are excluded from on-time-rate and avg-delivery-time calculations (no completed outcome yet).
- **Forecasting runs at the product-category level, not per-SKU.** 355 of the CSV's 400 rows have a distinct SKU — nowhere near enough history to fit a trend per SKU. The 8 product categories have ~10–12 months of data each, which is forecastable. If a user asks to forecast a specific SKU, the tool substitutes the category and (usually) says so in its answer — see Limitations.
- **Relative date phrases anchor to the dataset's `MAX(orderDate)`**, not wall-clock time (see AI Approach above).
- **"Last month" and similar phrases are trailing windows** (e.g. the 30-ish days immediately before the anchor date), not calendar-aligned months. Simpler and consistent across every relative-range option; the resolved date range is always shown in the explainability panel regardless.
- **No authentication.** Single shared, read-only dataset — acceptable per the assignment's deployment notes for a demo.

## Limitations

- Forecasting is category-level only (see Assumptions).
- No multi-turn conversation memory in Ask AI — each question is answered independently; there's no "and what about last month?" follow-up context.
- Chart types are limited to line/bar/stat by design — a deterministic rule, not the model choosing arbitrary visualizations.
- When a user names a specific SKU to forecast, the model *usually but not always* states in its prose answer that it substituted the category level (a smaller/faster model like `gpt-4o-mini` isn't perfectly consistent about this even with explicit prompting). The substitution itself is never hidden — the query plan and methodology text in the explainability panel always show the actual category used — but the natural-language sentence alone isn't 100% reliable on this point.
- AI responses take roughly 3–12 seconds (two sequential model calls: routing, then grounded-answer generation). No streaming yet.
- Query history is capped at the last 10 questions, no pagination.
- Underlying-data tables show aggregated rows (the same rows behind each chart/answer — up to ~12), not a raw drill-down into all 400 orders.

## Future Improvements

- Exponential smoothing as a second forecasting method, auto-selected by whichever has lower in-sample error.
- Multi-turn chat context for follow-up questions.
- Stream the routing/answer generation so the UI can show partial progress instead of one long wait.
- Move aggregation to DB-side `groupBy` queries if the dataset ever grows past a size where fetch-then-aggregate-in-memory stops being the right tradeoff.
- Pagination or a "load more" affordance on the query-history list.
- Cache-tag-based Accelerate invalidation wired into `db:seed`, instead of relying on the `Order` cache's `ttl` to expire naturally after a manual reseed.
