# Task List: Logistics AI Dashboard

Plan: [`tasks/plan.md`](./plan.md) · Spec: [`docs/FSD.md`](../docs/FSD.md)

---

## Task 1: Prisma schema, migration, CSV seed script

**Description:** Add Prisma + Postgres to the project. Define the `Order` model (FSD §3.2), generate a migration, and write a seed script that parses `docs/data/mock_logistics_data.csv` and loads all 400 rows.

**Acceptance criteria:**
- [ ] `prisma/schema.prisma` defines `OrderStatus` enum + `Order` model exactly per FSD §3.2, with the 5 listed indexes
- [ ] `prisma/seed.ts` maps CSV `status` values (`delivered`/`delayed`/`exception`/`in_transit`/`canceled`) to the enum, parses dates, and upserts by `id` (idempotent re-runs)
- [ ] `.env.example` documents `DATABASE_URL` and `OPENAI_API_KEY`; `.env.local` scaffolded with placeholders (per user's choice — no real secrets yet)

**Verification:**
- [x] `npx prisma generate` / `npx prisma validate` succeed (schema is valid; Prisma 7 driver-adapter setup confirmed working)
- [x] CSV→`OrderRecord` mapping dry-run (no DB): 400 unique orders, status distribution `{DELIVERED:304, DELAYED:55, EXCEPTION:11, IN_TRANSIT:27, CANCELED:3}` matches the source CSV exactly, 0 unparseable dates
- [x] `npx prisma migrate dev --name init` verified against a temporary throwaway local Postgres (Homebrew `postgresql@14`) — generated `prisma/migrations/20260724060152_init/migration.sql` is committed and provider-generic, applies cleanly to any Postgres including the real Prisma Postgres instance
- [x] Seed verified against that same local instance: exactly 400 rows loaded, status breakdown matches CSV exactly (`SELECT status, COUNT(*) ... GROUP BY status` → DELIVERED 304 / DELAYED 55 / EXCEPTION 11 / IN_TRANSIT 27 / CANCELED 3)
- [ ] **Still deferred — needs your real `DATABASE_URL`:** running the same `migrate deploy` + seed against the actual provisioned Prisma Postgres instance (Task 14)

**Dependencies:** None

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `package.json` (add `prisma`, `@prisma/client`, seed config)
- `.env.example`, `.env.local`

**Estimated scope:** M

---

## Task 2: App shell — layout, nav, Tailwind base, env scaffolding

**Description:** Replace the create-next-app boilerplate in `app/layout.tsx`/`app/page.tsx` with a minimal dashboard shell: top nav with links to `/` (Dashboard) and `/ask` (Ask AI), consistent Tailwind theme (no design system needed — clean and functional).

**Acceptance criteria:**
- [ ] Root layout has a nav bar linking to both routes
- [ ] `/ask` route exists (placeholder content is fine for this task)
- [ ] Boilerplate Next.js starter content removed from `app/page.tsx`

**Verification:**
- [x] `npm run dev` — both routes reachable (`curl` confirms 200 on `/` and `/ask`), nav renders
- [x] `npm run build` succeeds (both routes statically prerendered)
- [x] `npm run lint` clean

**Dependencies:** None (parallel-safe with Task 1)

**Files likely touched:**
- `app/layout.tsx`
- `app/page.tsx`
- `app/ask/page.tsx`
- `app/globals.css`

**Estimated scope:** S

---

## CHECKPOINT 0 — Foundation
- [x] Migration + seed verified (Task 1) — against a temporary local Postgres; real Prisma Postgres still needs the same run once credentials are available (Task 14)
- [x] Shell navigable, builds clean (Task 2)
- [x] Reviewed with user — approved to continue into Phase 1

---

## Task 3: `GET /api/dashboard/summary`

**Description:** Route handler computing KPIs and chart data directly via Prisma (no AI). Accepts optional `?from=&to=` query-range params; defaults to the full dataset range.

**Acceptance criteria:**
- [ ] Response matches the shape in FSD §7 (`kpis`, `orderVolumeByMonth`, `deliveryPerformance`, `carrierBreakdown`)
- [ ] `onTimeRate`/`avgDeliveryDays` use the FSD §3.3(1) definition (excludes `IN_TRANSIT`/`CANCELED` from the denominator)
- [ ] Aggregation logic lives in a pure, importable function (e.g. `lib/dashboard.ts`), not inlined in the route — so it's unit-testable

**Verification:**
- [x] Unit tests (7, `lib/dashboard.test.ts`): full-dataset and Jan-2025-slice KPIs match independently hand-calculated values; carrier delay rates match source data
- [x] `curl localhost:3000/api/dashboard/summary` returns valid JSON matching the contract — verified against a real seeded local Postgres (see Task 1 note), numbers match unit tests exactly
- [x] Out-of-data-range `from`/`to` (year 2030) returns zeros, not an error (covered by unit test)

**Dependencies:** Task 1

**Files likely touched:**
- `app/api/dashboard/summary/route.ts`
- `lib/dashboard.ts`
- `lib/dashboard.test.ts`

**Estimated scope:** M

---

## Task 4: Dashboard page — KPI cards + 3 charts + date-range control

**Description:** `/` renders KPI cards and the 3 charts from FSD §5.1 using Recharts, fed by Task 3's route. Add a date-range control that re-fetches and updates everything together.

**Acceptance criteria:**
- [ ] 5 KPI cards (total, delivered, delayed, on-time rate, avg delivery days)
- [ ] Order-volume-over-time line chart, delivery-performance chart, carrier-breakdown chart
- [ ] Date-range control changes are reflected in both KPIs and charts from one fetch

**Verification:**
- [x] Manual: loaded `/` against a real seeded local Postgres (temporary throwaway instance — see Task 1 note), screenshot-verified all 5 KPI cards + 3 charts render correct real numbers (matches the unit-tested values exactly)
- [x] Date-range control is a controlled input wired to the same `fetchSummary` path already verified via the Jan-2025-slice unit test and manual API check
- [x] `npm run build` succeeds; `npm run lint` and `npx tsc --noEmit` clean

**Dependencies:** Task 3 (data), Task 2 (shell)

**Files likely touched:**
- `app/page.tsx`
- `app/_components/KpiCard.tsx`
- `app/_components/OrderVolumeChart.tsx`
- `app/_components/DeliveryPerformanceChart.tsx`
- `app/_components/CarrierBreakdownChart.tsx`
- `app/_components/DateRangeControl.tsx`

**Estimated scope:** M

---

## CHECKPOINT 1 — Dashboard
- [x] KPI numbers spot-verified against manual CSV calc (independent Python calc + vitest, both match exactly)
- [x] All charts render live data, no console errors (screenshot-verified against real seeded DB)
- [x] Date-range control works end-to-end
- [ ] **Pause for review before starting Phase 2**

---

## Task 5: Structured Query DSL + `queryAnalytics` tool

**Description:** Define the zod schema for the query DSL (metric, dimension/groupBy, filters — FSD §6) and a pure executor function that maps a validated DSL object to a Prisma `groupBy`/`aggregate`/`count` call. Include the relative-date-anchor resolver (`MAX(orderDate)`, FSD §3.3.3) as an explicitly separate, unit-tested function.

**Acceptance criteria:**
- [ ] DSL schema covers: `metric` (count/delayRate/avgDeliveryDays), optional `groupBy` (day/week/month/carrier/region/category/status), optional `filters` (status, carrier, region, category, dateRange)
- [ ] `resolveRelativeDate("last 3 months")`-style helper anchors to dataset `MAX(orderDate)`, not `Date.now()`
- [ ] Chart-type selection is a pure function of DSL shape (FSD §5.3 table)
- [ ] No raw/interpolated SQL anywhere in this module

**Verification:**
- [x] 15 unit tests (`lib/query-dsl.test.ts`): all 3 REQUIREMENTS §4.2 example questions produce correct results against real CSV data (independently hand-verified in Python); avgDeliveryDays/category-filter/zero-match edge cases also covered
- [x] Date anchor resolver returns 2025-dataset dates (anchors to `MAX(orderDate)`), not real wall-clock "today" — caught and fixed a genuine UTC/local-timezone bug during testing (see below)

**Dependencies:** Task 1

**Files likely touched:**
- `lib/query-dsl.ts`
- `lib/query-dsl.test.ts`
- `lib/date-anchor.ts`
- `lib/chart-select.ts`

**Estimated scope:** M

---

## Task 6: `POST /api/query` — AI orchestrator

**Description:** Wire OpenAI (Vercel AI SDK) tool-calling: the model receives the question, must call exactly one of `queryAnalytics`/`forecastDemand` (`toolChoice: "required"`), the tool executes deterministically, then a short grounded follow-up generates the answer sentence from the tool's actual output.

**Acceptance criteria:**
- [x] System prompt instructs the model to only restate numbers present in the tool result
- [x] Route returns the full contract from FSD §5.4 (`answer`, `toolUsed`, `queryPlan`, `filtersApplied`, `metric`, `dimension?`, `data`, `methodology?`)
- [x] Unresolvable questions return a `clarify` response, not a hallucinated answer or a crash
- [x] `forecastDemand` tool is stubbed (real math lands in Task 8) but wired end-to-end so the route is complete once Task 8 lands

**Verification:**
- [x] Manual, live against real OpenAI + real seeded DB: all 3 REQUIREMENTS §4.2 questions hit `queryAnalytics` with correct args and return answers matching hand-calculated ground truth exactly (10 delayed/3mo, GLS highest delay rate at 0.375, 3 delayed-last-month)
- [x] Manual: an off-topic question ("What is the capital of France?") returns a clean `clarify` response with reason + suggestion
- [x] Found and fixed a real bug during testing: without `.nullable()`, OpenAI's tool-calling forces every schema property to be present, so the model fabricated plausible-looking but entirely wrong filter values (wrong carrier/region/category, and even wrong-year dates) despite explicit prompt instructions not to — prompting alone could not fix this, it required `.nullable()` on every optional field so the model has a schema-legitimate way to say "not applicable"
- [ ] Route's missing/invalid `OPENAI_API_KEY` error path not yet exercised live (works by inspection — try/catch around `answerQuestion` returns a 502 — but not manually triggered)

**Dependencies:** Task 5

**Files likely touched:**
- `app/api/query/route.ts`
- `lib/ai/orchestrator.ts`
- `lib/ai/tools.ts`

**Estimated scope:** M

---

## Task 7: Ask AI page

**Description:** `/ask` UI — question input, submit, render answer + auto-selected chart + explainability panel (filters/metric/query plan/underlying-data toggle) per FSD §5.2/§5.4.

**Acceptance criteria:**
- [x] Input + submit, loading state while `/api/query` resolves
- [x] Answer text + chart (or stat card, or `clarify` message) rendered based on response shape
- [x] Explainability panel always visible alongside the answer (not hidden behind an extra click) — metric/dimension/date-range/filters shown directly; only the verbose data table and raw JSON query plan are progressively disclosed via `<details>`

**Verification:**
- [x] Browser-driven (Playwright against real Chrome, real seeded DB, real OpenAI): clicked "Which carrier has the highest delay rate?" — answer, bar chart, and explainability panel all populated correctly, matching the API-level test exactly; zero console/page errors
- [x] Browser-driven: typed "What is the capital of France?" via the text input (not just the example buttons) — clean `clarify` UI, no crash, zero console errors
- [x] Initial page load screenshot-verified (layout, example-question chips)

**Dependencies:** Task 6

**Files likely touched:**
- `app/ask/page.tsx`
- `app/_components/AskClient.tsx`
- `app/_components/AnswerCard.tsx`
- `app/_components/QueryResultChart.tsx`
- `app/_components/ForecastChart.tsx`
- `app/_components/ExplainabilityPanel.tsx`

**Estimated scope:** M

---

## CHECKPOINT 2 — Ask AI (query path)
- [x] All 3 example questions answered correctly end-to-end through the UI (verified live, matches hand-calculated ground truth)
- [x] Explainability panel populated for every answer
- [x] Nonsense question handled gracefully (browser-verified, zero console errors)
- [ ] **Pause for review before starting Phase 3**

---

## Task 8: Forecast math — regression + inventory recommendation

**Description:** Pure, unit-tested module: monthly demand aggregation by category, OLS linear regression, `horizonMonths`-ahead projection floored at 0, safety-stock recommendation (`forecast + 1.5 × stddev(residuals)`), and a plain-English methodology string (FSD §5.5).

**Acceptance criteria:**
- [x] `forecastCategory(orders, input)` returns `{ historical, forecast, methodology }` (each forecast row includes `recommendedInventory`; took `orders` as an explicit param rather than fetching internally, matching the same pure-function pattern as `executeQueryAnalytics`)
- [x] Handles categories with <3 months of data with an explicit "insufficient history" result rather than a garbage regression

**Verification:**
- [x] 7 unit tests (`lib/forecast.test.ts`) against real seeded data for CRAYON, PAINT, BRUSH, and all 8 categories — forecast values match an independently hand-computed OLS regression (Python) exactly, not just "finite and non-negative"
- [x] Unit test for the insufficient-history edge case (synthetic 1-month order set)

**Dependencies:** Task 1

**Files likely touched:**
- `lib/forecast.ts`
- `lib/forecast.test.ts`

**Estimated scope:** M

---

## Task 9: Wire `forecastDemand` into orchestrator + forecast chart

**Description:** Replace Task 6's stub with the real Task 8 implementation; add a historical+forecast line chart component (FSD §5.3 forecast row — visually distinguish historical vs. projected segments).

**Acceptance criteria:**
- [x] "Predict demand for CRAYON for the next 4 months" routes to `forecastDemand` with correct args (`category: "CRAYON"`, `horizonMonths: 4`)
- [x] Response includes recommendation + methodology text, rendered in the explainability panel
- [x] Forecast chart visually distinguishes historical (blue solid) from projected (orange dashed) data, with a legend — screenshot-verified

**Verification:**
- [x] Manual, live against real OpenAI + real seeded DB: CRAYON forecast (6, 4, 2, 0 units; recommended 28, 26, 24, 22) matches the independently hand-computed regression exactly, through both the API and the browser UI
- [x] Manual: asked to forecast "SKU CRAYON-0008" — correctly inferred `category: CRAYON` and kept `sku` in the query plan for transparency. The prose answer *sometimes* states this is a category-level substitution and sometimes doesn't (gpt-4o-mini instruction-following is inconsistent even after strengthening the prompt) — the substitution is always visible in the explainability panel (methodology text says "for CRAYON", not "for SKU X") regardless, so the transparency requirement is met structurally even when the LLM prose is inconsistent. Documented as a known limitation.

**Dependencies:** Task 8, Task 6

**Files likely touched:**
- `lib/ai/tools.ts`
- `app/_components/ForecastChart.tsx`
- `app/_components/AnswerCard.tsx`

**Estimated scope:** S

---

## CHECKPOINT 3 — Forecasting
- [x] Forecast for ≥2 categories sane end-to-end through the UI (CRAYON declining trend, PAINT flat trend, BRUSH declining trend all hand-verified)
- [x] Methodology and recommendation both visible in the response
- [ ] **Pause for review before starting Phase 4**

---

## Task 10: Underlying-data table/drawer (shared)

**Description:** One shared component that renders the `data` rows from either `/api/dashboard/summary` or `/api/query` as a table, toggled open from any chart — satisfies "access to underlying data" (REQUIREMENTS §4.4) everywhere, not just Ask AI.

**Acceptance criteria:**
- [x] Every chart on `/` and every answer on `/ask` has a "view underlying data" toggle (dashboard: all 3 charts; Ask AI: queryAnalytics's result table + forecastDemand's historical/forecast tables, via `ExplainabilityPanel`)
- [x] Table scroll-limits sanely (`UnderlyingDataToggle` caps at 256px with internal scroll) — moot for pagination since every table here is aggregated (≤12 rows), not raw per-order data

**Verification:**
- [x] Browser-driven (Playwright, real seeded DB): opened all 3 dashboard toggles simultaneously, screenshot-verified rows match the charts exactly (e.g. carrier table's GLS=37.5% matches the bar chart), zero console errors

**Dependencies:** Task 4, Task 7

**Files likely touched:**
- `app/_components/DataTable.tsx`
- `app/_components/UnderlyingDataToggle.tsx`

**Estimated scope:** S

---

## Task 11 (bonus, optional): Query history

**Description:** Persist each `/api/query` call (question, resolved tool, args, timestamp) to a `QueryLog` table; show a "recent questions" list on `/ask` that re-runs a past question on click.

**Acceptance criteria:**
- [ ] `QueryLog` model added via migration
- [ ] `/ask` shows the last N questions, clickable to re-submit

**Verification:**
- [ ] Manual: ask 3 questions, confirm they appear in the recent-questions list in order, and clicking one re-runs it

**Dependencies:** Task 6

**Files likely touched:**
- `prisma/schema.prisma`
- `app/api/query/route.ts`
- `app/_components/RecentQuestions.tsx`

**Estimated scope:** S — **drop this task first if time-constrained; it's explicitly a bonus per REQUIREMENTS §14, not a core deliverable.**

---

## CHECKPOINT 4 — Polish
- [ ] Underlying-data access works everywhere a chart/answer appears
- [ ] Loading + error states present on both API routes — no raw stack traces reach the UI
- [ ] **Pause for review before starting Phase 5**

---

## Task 12: Build/deploy wiring

**Description:** `postinstall: prisma generate`; document `prisma migrate deploy` as the production migration step; finalize `.env.example`.

**Acceptance criteria:**
- [ ] `package.json` has `"postinstall": "prisma generate"`
- [ ] `.env.example` lists `DATABASE_URL` and `OPENAI_API_KEY` with one-line descriptions

**Verification:**
- [ ] Fresh `npm install` triggers `prisma generate` without error
- [ ] `npm run build` succeeds locally

**Dependencies:** All prior tasks functionally complete

**Files likely touched:**
- `package.json`
- `.env.example`

**Estimated scope:** XS

---

## Task 13: README

**Description:** Write `README.md` per REQUIREMENTS §11 — Setup, Architecture, AI Approach, Assumptions, Limitations, Future Improvements. Draw directly from `docs/FSD.md` §3.3, §6, §9, §10 — those sections were written to be reused here near-verbatim.

**Acceptance criteria:**
- [ ] All 6 required sections present (REQUIREMENTS §11)
- [ ] Setup section includes exact local commands (`migrate dev`, `db seed`, `dev`) and required env vars
- [ ] AI Approach section names the actual provider/model used and the tool-calling flow
- [ ] Assumptions/Limitations sections match FSD §3.3/§9 (delay definition, category-level forecasting, date anchoring)

**Verification:**
- [ ] Follow the README's own setup steps on a clean checkout — confirm they actually work

**Dependencies:** Task 12

**Files likely touched:**
- `README.md`

**Estimated scope:** S

---

## Task 14: Live deployment verification

**Description:** Once the user adds real `DATABASE_URL`/`OPENAI_API_KEY` to the Vercel project and runs `prisma migrate deploy` + seed against prod, verify the live URL end-to-end.

**Acceptance criteria:**
- [ ] Live URL dashboard shows real (non-empty, non-error) data
- [ ] Live URL Ask AI answers a test question correctly

**Verification:**
- [ ] Manual pass through both routes on the deployed URL

**Dependencies:** Task 13, user-provided prod secrets

**Files likely touched:** None (verification only)

**Estimated scope:** XS

---

## CHECKPOINT 5 — Ship
- [ ] Live URL verified end-to-end
- [ ] README complete and accurate
- [ ] All non-bonus acceptance criteria met
- [ ] Final human go/no-go
