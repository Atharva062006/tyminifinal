# APNILEAP Project Rules

## Core Directives
1. **No External Databases**: This project implements a custom DBMS engine from scratch in JSON. Do NOT install MongoDB, PostgreSQL, SQLite, Prisma, Sequelize, etc. Data persistence is strictly handled by `services/team-c-placement` manipulating JSON files.
2. **From-Scratch Data Structures**: All algorithms must use from-scratch implementations (B-Trees, hash indexes, AVL trees, Tries, heaps, queues, decision trees, graphs, merge sort). Do not import `lodash` or external algorithm packages.
3. **Strict Team Boundaries**:
   - **Team A (Eligibility, port 3001)**: rule chaining (decision tree / sequential AND / weighted priority), request queues (FIFO / circular / priority / heap + aging), slot lease manager + wait-for graph, telemetry. Holds **no** master data: it receives student/criteria snapshots in requests.
   - **Team B (Ranking, port 3002)**: skill/requirement graph (adjacency list + matrix), ranking (weighted score / heap Top-K / merge sort), AVL + hash shortlist index, ranking cache, Trie, cohort analytics. Profiles are pushed to it by Team C (or inline in a request).
   - **Team C (Placement/DB, port 3003)**: authoritative DB engine and **the only service that writes data files**. Owns accounts, the application state machine, the orchestration of A and B, seats, interviews, offers, notifications, audit.
   - **Team D (Portal, port 3000)**: BFF + SPA. Consumes Team C's REST API, calls A/B only for read-style computations (eligibility check, ranking preview, metrics, benchmarks). Never mutates application state itself.
4. **Shared Module**: Always use the `shared/` package for the `X-Correlation-ID` middleware, standardized error handling, `sendSuccess` envelopes, `constants.js` (state machine) and `token.js` (signed sessions).
5. **Idempotency**: Cross-service mutating POST/PUT requests carry an `Idempotency-Key`. Team C enforces it for applications (`idempotencyService.js` + per-key/per-pair logical locks).
6. **Living Documentation**: Agents MUST update `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` whenever significant architectural changes, new services, or structural modifications are made.
7. **Honest degradation**: The BFF must never present fallback/mock data as live. Team A/B fallbacks set `meta.degraded` (shown as a banner); Team C failures are explicit 503s. Mock adapters are used only when `MOCK_TEAM_*=true` (unit tests / offline demo).
8. **Provenance tags**: UI pages show a tiny `Team X · capability` tag (`window.components.teamTag`). Keep tags accurate when adding screens.

## Team C — Implemented API Surface (Port 3003)
All routes are under `/api/v1` (internal ones under `/api/v1/internal`). Everything except `auth/register`, `auth/login`, `stream` and `/health` requires either a signed session token (`Authorization: Bearer …`) or the trusted-service headers (`X-Internal-Secret` + optional `X-Actor-Id` / `X-Actor-Role` / `X-Actor-Name`).

- **Auth & users**: `POST auth/register` (student self-registration) · `POST auth/login` · `GET auth/me` · `POST auth/change-password` · `GET|POST users`, `PATCH users/:id` (admin)
- **Master data (C1)**: `companies` (POST, GET, GET/:id, PATCH/:id) · `students` (GET list [staff], GET/:id, POST [staff creates student + login], PATCH/:id [self or staff]) · `drives` (POST, GET, GET/:id, GET/:id/criteria, `PATCH internal/drives/:id`)
- **Applications (C2)**: `POST applications` (idempotent; runs Team A evaluate → Team B rank) · `GET applications[?student_id,drive_id,state]` · `GET applications/:id` · `GET applications/:id/details` (decisions, interviews, offers, audit) · `POST applications/:id/withdraw` · `POST applications/:id/transition` `{target_state, reason, payload, expected_version}` · `POST applications/:id/interviews` · `POST applications/:id/reevaluate`
- **Interviews / offers / notifications**: `GET interviews`, `PATCH interviews/:id` · `GET offers` · `GET notifications`, `PATCH notifications/:id/read`, `POST notifications/read-all` · `announcements` (GET, POST, DELETE)
- **Commit & compensation (C3)**: `POST internal/offers/commit` · `POST internal/offers/compensate` · `POST internal/pipeline/retry`
- **Audit, reports, recovery (C4)**: `GET audit` · `GET reports/placement-performance` · `GET reports/reconciliation` · `POST internal/recovery/{verify,backup,verify-restore}`
- **SSE outbox**: `GET stream` — named events `audit`, `state_change`, `notification` (the BFF relays them as typed JSON messages).

## Application State Machine
Defined in `shared/constants.js`, enforced only by Team C (`stateMachineService.js`, `workflowService.js`):
```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED → OFFER_ACCEPTED
```
Alternative outcomes: `NOT_ELIGIBLE`, `WAITLISTED`, `REJECTED`, `WITHDRAWN`, `OFFER_DECLINED`, `EXPIRED`, `COMPENSATION_REQUIRED`.
Seats are claimed at `SELECTED` and returned when a seat-holding application is rejected, withdrawn, declined or compensated. Interview slots are Team A exclusive leases, released on completion/cancel/reject/withdraw.

## Workflow
- `npm run start:all` — start all four services · `start:a|b|c|d` for one
- `npm run reset` — wipe Team C data (re-seeds on next start) · `npm run seed` — seed an empty DB (`--force` to re-create)
- `npm run health` — ping the four services · `npm test` / `test:a|b|c|d` — run tests
- `npm run kpi` — run the KPI acceptance checks against a running stack → `docs/kpi/KPI_REPORT.md`
- Refer to `AI_DEVELOPMENT_GUIDE.md` and the design document for full constraints.
