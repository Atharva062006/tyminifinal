# APNILEAP — Agent & Developer Guidelines

> **CRITICAL WARNING TO ALL AI AGENTS**: Read this document entirely before making code changes. The project has strict academic constraints, specific team boundaries and a custom architecture. **Do NOT use external databases (MongoDB, PostgreSQL, SQLite, …), ORMs, or external algorithm/data-structure packages.** Everything is implemented from scratch on Node.js + Express.

## 1. Architecture & monorepo structure

Four independent Node/Express services in an npm-workspaces monorepo, talking REST (+ SSE) with a shared envelope, `X-Correlation-ID` propagation and idempotency keys.

```
shared/                         response envelope, errors, correlation, state-machine constants, signed tokens (token.js)
services/team-a-eligibility/    :3001  OS engine
services/team-b-ranking/        :3002  DS engine
services/team-c-placement/      :3003  DBMS + workflow  (authoritative data)
services/team-d-portal/         :3000  BFF + SPA
scripts/                        start-all, seed-data, reset-data, health-check, kpi-report
docs/kpi/                       generated KPI evidence
```

### Team A — Eligibility (OS)
```
server.js                 routes + engine wiring (buildApp() exported for tests)
src/rules/                SequentialANDChain, WeightedPriority, DecisionTree, ruleSet.js (criteria → rules; hard vs soft)
src/queues/               FIFOQueue, CircularQueue, PriorityQueue (min-heap), HeapQueue (max-heap)
src/engine/RuleEngine.js  strategy runner + reference oracle
src/engine/Scheduler.js   per-drive queues, round-robin worker, policy switch, aging (no starvation), request store
src/engine/LockManager.js exclusive/shared slot leases, lease expiry, wait-for graph, deadlock detect/prevent/analyse
src/engine/Metrics.js     p50/p95/p99, throughput, waits per priority
src/engine/benchmark.js   strategy comparison, 10k-way slot safety, seeded deadlock cycles
```
Team A never reads master data: Team C/D send `{student, criteria}` snapshots.

### Team B — Ranking (DS)
```
src/graph/                AdjacencyList (baseline), AdjacencyMatrix (comparison)
src/ranking/              WeightedScore, HeapTopK, MergeSort, compare.js (tie-break: score DESC, student_id ASC)
src/index/                AVLTree, HashIndex (chaining, FNV-1a), Trie
src/engine/ProfileRegistry.js  versioned students/drives/skills graph (graph_version gN)
src/engine/RankingEngine.js    compute (weights validated, disqualification, cache, shortlist index), lookups, metrics
src/engine/RankingCache.js     key includes graph_version → stale entries unservable; invalidate by drive
src/engine/analytics.js        department trend, company conversion, package histogram, skill gap + complexity evidence
src/engine/benchmark.js        latency/optimality/AVL-vs-hash/list-vs-matrix/cache
```

### Team C — Placement DBMS & workflow
```
server.js                 DI wiring; startServer({dataDir, listen}) for tests; auto-seed; profile sync to Team B
data/                     tables/*.json, wal/, backups/ (runtime, gitignored)
src/db/                   Database (TableAPI + transactionIndexed + lookupBy), engine/{StorageEngine,WAL,LockManager,TransactionManager}, indexes/{BTreeIndex,HashIndex}, schema/{SchemaManager,migrations}
src/services/             applicationService (idempotent create under logical locks)
                          workflowService (pipeline + every state transition + seats + interview leases + compensation)
                          offerService (commit/compensate API), authService (scrypt, tokens), notificationService,
                          auditService, idempotencyService, reportService (indexed queries, reconciliation),
                          recoveryService (WAL verify, backup, verify-restore), seedService, engineClients (HTTP → A/B), sseService
src/controllers|routes|middleware   thin HTTP layer; auth.js accepts signed tokens OR trusted-service headers
```
Tables: students, companies, drives, applications, eligibility_decisions, offers, interviews, users, announcements, notifications, audit_log, idempotency_keys. Migrations v1–v3.

**Database rules**: use `db.transactionIndexed(fn)` for multi-table writes (schema + FK + unique validation and index maintenance); use `txn.lock(resource)` / `txn.readForUpdate()` for check-then-write sequences to avoid races and S→X upgrade deadlocks; use `db.lookupBy(table, field, key)` for hash-indexed equality reads.

### Team D — Portal
```
server.js                          static SPA (no-cache), /api/v1/ui, JSON 404 for unknown /api routes
src/bff/                           routes/uiRoutes.js (role guards + rate limiters), controllers/, services/{teamA,teamB,teamC}Client,
                                   applicationService (details + timeline from audit), dashboardService, analyticsService,
                                   rankingService, sseProxyService (named events → typed JSON, per-recipient notification filtering),
                                   utils/degraded.js (meta.degraded), middleware/auth.js (signed tokens)
src/mocks/                         mock adapters (only when MOCK_TEAM_x=true)
src/frontend/                      index.html, css/{main,components,layout}.css, js/{api,state,sse,router,app}.js,
                                   js/components/{ui,navbar,…}, js/views/{loginView,accountView,student/*,faculty/*,admin/*}
tests/                             supertest suites run against the mocks (tests/setupEnv.js)
```

## 2. Strict rules for AI agents
1. **Respect team boundaries.** Only Team C writes data files. Teams A, B, D never import Team C's `Database.js`; they use HTTP.
2. **No external databases / algorithm packages.** Core logic must be hand-written.
3. **Shared contracts.** Use `shared/` for responses, errors, correlation IDs, constants and tokens; never hard-code state strings — use `shared/constants.js`.
4. **State machine compliance.** Only Team C changes application state, through `WorkflowService`. New transitions go in `shared/constants.js` **and** `workflowService.PERMISSIONS` **and** (if they have side-effects) the `_commit` hooks; add tests.
5. **No silent fakes.** The BFF must not fabricate success. Mocks only behind `MOCK_*` flags; fallbacks must call `degraded.mark()`.
6. **HTML safety.** The SPA escapes all server text with `esc()`; do not store pre-escaped HTML in the database.
7. **Provenance tags** (`components.teamTag`) on every new page/card.
8. **Living documentation**: update this file, `.agents/AGENTS.md` and `README.md` for structural changes.

## 3. Application state machine
`APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED → OFFER_ACCEPTED`, with `NOT_ELIGIBLE`, `WAITLISTED`, `REJECTED`, `WITHDRAWN`, `OFFER_DECLINED`, `EXPIRED`, `COMPENSATION_REQUIRED`. Defined in `shared/constants.js`; role permissions per target in `workflowService.PERMISSIONS` (students: withdraw, accept/decline own offer; staff: shortlist/waitlist/reject/interview/select/offer).

Orchestration (`WorkflowService.runPipeline`): `APPLIED → SCREENING` → Team A evaluate (idempotent `REQ-<applicationId>`) → decision row + `RULE_EVALUATED | NOT_ELIGIBLE` → Team B rank (stores `ranking_id`, `rank`, `rank_score`; failure ⇒ `ranking_status: DEGRADED`). Team A down ⇒ application stays `SCREENING` with `pipeline_status: EVALUATION_PENDING`, retried via `/reevaluate` or at start-up. Interview scheduling takes an exclusive Team A lease **before** the DB commit and releases it if the commit fails (compensation, audited).

## 4. Authentication
`users` table (scrypt hash + salt). `POST /auth/login` returns an HMAC-signed token (`shared/token.js`, 8 h). The BFF verifies tokens and forwards the acting user to Team C as `X-Actor-*` headers behind `X-Internal-Secret`; Team C re-checks role permissions. `NODE_ENV=test` (or `ALLOW_DEV_TOKENS=true`) additionally accepts legacy `role_id` tokens for the unit tests.

## 5. Development commands
`npm run start:all|start:a|b|c|d` · `npm run seed [-- --force]` · `npm run reset` · `npm run health` · `npm test` · `npm run test:a|b|c|d` · `npm run kpi`

## 6. Idempotency & concurrency
Applications: `Idempotency-Key` header/body key stored with the *final* outcome; a per-key lock plus a per-(student, drive) lock make duplicates impossible under concurrency (verified with 10,000 concurrent attempts in `npm run kpi`). State changes use optimistic `expected_version` (409 on mismatch) and row-level exclusive locks.

## 7. SSE event stream
Team C `GET /api/v1/stream` emits named events (`audit`, `state_change`, `notification`). The BFF `GET /api/v1/ui/stream?token=…` relays them as typed JSON messages (`{type, …}`), sends a 15 s `heartbeat` message, and delivers `notification` events only to their recipient. The SPA marks the stream stale when no heartbeat arrives and silently re-renders live views (debounced).

---
*By strictly following these boundaries, Teams A, B, C and D can develop their algorithms independently without corrupting global state.*
