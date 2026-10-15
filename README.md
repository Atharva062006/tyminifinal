# RIT — Campus Placement & Eligibility System

**Rajarambapu Institute of Technology (RIT)** · *Rule-based placement eligibility, DS candidate ranking & data-driven analytics*

Four cooperating services — each owned by one academic team — behind a single web portal:

| Service | Port | Domain | What it owns |
| :-- | :-: | :-- | :-- |
| **Team A** `team-a-eligibility` | 3001 | Operating Systems | Rule-chaining engine (decision tree · sequential AND · weighted priority), per-drive request queues (FIFO · circular · priority · heap) with aging, interview-slot lease manager with wait-for-graph deadlock detection, telemetry + SSE |
| **Team B** `team-b-ranking` | 3002 | Data Structures | Versioned skill/requirement graph (adjacency list **and** matrix), ranking (weighted score · heap Top-K · merge sort), AVL-tree + hash shortlist index, version-aware cache, Trie skill suggestions, cohort analytics with complexity evidence |
| **Team C** `team-c-placement` | 3003 | DBMS | **The only database.** Custom JSON DBMS (ACID transactions, WAL, row locks, B-tree + hash indexes, constraints, migrations), accounts, application state machine, orchestration of A and B, interviews, offers, seats, notifications, audit, reports, backup/recovery |
| **Team D** `team-d-portal` | 3000 | Web Technology | Backend-for-frontend (role guards, aggregation, SSE relay, CSV export) and the vanilla-JS single-page portal |

Every screen of the portal carries a tiny tag (e.g. `● Team A · rule engine`) showing which team's capability it exposes.

---

## Quick start

```bash
npm install
npm run start:all        # starts Teams A, B, C, D (ports 3001, 3002, 3003, 3000)
# open http://localhost:3000
```

The first start of Team C seeds demo data automatically (8 students, 5 companies, 6 drives, 8 applications in varied states).
To start over: `npm run reset` (wipes `services/team-c-placement/data`) and start again.

### Demo accounts

| Role | E-mail | Password |
| :-- | :-- | :-- |
| Student (shortlisted) | `aarav@rit.edu` | `student123` |
| Student (has an offer) | `ananya@rit.edu` | `student123` |
| Other students | `rohan@`, `devraj@`, `isha@`, `kabir@`, `neha@`, `omkar@rit.edu` | `student123` |
| Faculty / TPO | `tpo@rit.edu` | `faculty123` |
| Placement Admin | `admin@rit.edu` | `admin123` |
| Auditor (read-only) | `auditor@rit.edu` | `auditor123` |

New students can register themselves on the sign-in page (**Create your account**); staff accounts are created by an admin under *Users & roles*.

### Configuration (`.env`, optional)

```ini
TEAM_A_URL=http://localhost:3001
TEAM_B_URL=http://localhost:3002
TEAM_C_URL=http://localhost:3003
INTERNAL_SERVICE_SECRET=rit_placement_internal_secret_key   # BFF ↔ Team C trust
JWT_SECRET=rit_placement_jwt_signing_secret                 # signs session tokens
AUTO_SEED=true                                              # seed demo data when Team C's DB is empty
MOCK_TEAM_A=false  MOCK_TEAM_B=false  MOCK_TEAM_C=false     # true = in-memory adapters (offline demos / unit tests)
```

---

## How the pieces work together

```
Browser SPA ──REST/SSE──▶ Team D BFF ──▶ Team C  ──▶ Team A  (evaluate rules, lease interview slots)
   (role-aware)            (RBAC, aggregation)  │ └──▶ Team B  (profiles, ranking)
                                                └── JSON DBMS (WAL, ACID, indexes)
```

**Apply → Evaluate → Rank → Review → Interview → Select → Offer** (all state changes live in Team C):

1. Student applies (idempotent). Team C inserts the application under logical locks — duplicates are impossible, even under 10,000 concurrent attempts.
2. Team C asks **Team A** to evaluate the student against the drive's rule set → `RULE_EVALUATED` (or `NOT_ELIGIBLE` with the failed rules).
3. Team C asks **Team B** to rank the applicant among eligible candidates (rank/score stored; if B is down the application stays valid with `ranking_status: DEGRADED`).
4. Faculty/admin **shortlist, waitlist or reject**; **schedule interviews** (an exclusive slot lease is taken from Team A — a clash is refused with 409); **mark selected** (claims a seat atomically); **issue the offer**.
5. The student **accepts or declines**; declining returns the seat. Every step writes audit + notifications and is pushed live to open browsers over SSE.

If Team A or B is unreachable the portal says so (degraded banner) — it never silently presents fallback data as live. Team C unavailable ⇒ explicit `503`.

```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED → OFFER_ACCEPTED
                  ↘ NOT_ELIGIBLE        ↘ WAITLISTED / REJECTED / WITHDRAWN        ↘ OFFER_DECLINED
```

---

## Who can do what

| Action | Student | Faculty / TPO | Admin | Auditor |
| :-- | :-: | :-: | :-: | :-: |
| Browse drives, check eligibility, see own rank | ✅ | ✅ | ✅ | ✅ |
| Edit own profile (skills, projects, links, academics*) | ✅ | – | – | – |
| Apply / withdraw / accept or decline own offer | ✅ | – | – | – |
| Shortlist · waitlist · reject · interview · select · offer | – | ✅ | ✅ | – |
| Create/edit drives, companies; register & verify students | – | ✅ | ✅ | – |
| Post announcements; rankings console; analytics; reports & CSV/JSON export | – | ✅ | ✅ | read |
| Users & roles, engine benchmarks, recovery tools | – | – | ✅ | read |
| Audit log, reconciliation | – | – | ✅ | ✅ |

\* A student's academic edits mark the record *unverified* until staff verify it.

Authorisation is enforced twice: by the BFF route guards **and** again by Team C using the acting user's role.

---

## API surface

### Team D BFF — `/api/v1/ui` (what the browser uses)

`session` · `register` · `me` · `me/password` · `dashboard` · `stream` (SSE) · `notifications` · `announcements` · `students` (+`/:id`, `/:id/readiness`) · `companies` · `drives` · `eligibility/check/:driveId` · `applications` (+ `/:id/{withdraw,shortlist,reject,waitlist,interviews,select,offer,offer-decision,reevaluate}`) · `interviews` · `offers` · `rankings` (+`/preview`) · `analytics` · `reports/{placement-performance,export}` · `audit` · `users` · `system` (+ benchmarks, queue policy, locks, deadlock analyser, shortlist lookup, cache invalidate, reconciliation, recovery)

### Team C — `/api/v1` (authoritative)
`auth/{register,login,me,change-password}` · `users` · `companies` · `students` · `drives` (+`/criteria`) · `applications` (+`/details`, `/transition`, `/interviews`, `/reevaluate`, `/withdraw`) · `interviews` · `offers` · `notifications` · `announcements` · `audit` · `reports/{placement-performance,reconciliation}` · `internal/{offers/commit,offers/compensate,drives/:id,pipeline/retry,recovery/{verify,backup,verify-restore}}` · `stream` (SSE outbox)

### Team A — port 3001
`POST /api/v1/eligibility/requests` · `GET /requests/:id` · `GET /decisions/:id` · `GET /api/v1/drives/:id/queue` · `POST /internal/v1/rules/evaluate` · `POST|GET|DELETE /internal/v1/locks…` · `POST /internal/v1/deadlocks/analyse` · `GET /api/v1/metrics/eligibility` · `GET /api/v1/stream/eligibility` · `POST /internal/v1/benchmark` · `GET|PUT /internal/v1/policy`

### Team B — port 3002
`POST /api/v1/rankings/compute` · `GET /rankings/:id` · `GET /api/v1/profiles` · `PUT /internal/v1/profiles/{students,drives}/:id` · `POST /internal/v1/profiles/sync` · `GET /internal/v1/shortlist-index/:key` · `POST /internal/v1/shortlist-cache/invalidate` · `POST /api/v1/analytics/analyse` · `GET /api/v1/metrics/ranking` · `POST /internal/v1/benchmark`

All responses use the shared envelope (`{ data, meta:{correlation_id, …} }` / `{ error:{code,message,details} }`); every request carries `X-Correlation-ID`; creates carry `Idempotency-Key`.

---

## Testing & KPI evidence

```bash
npm test            # all four workspaces (Team A 15 · B 13 · C 30 · D 128 tests)
npm run test:a|b|c|d

npm run reset && npm run start:all     # fresh stack
npm run kpi                            # runs the KPI acceptance checks against the live stack
```

`npm run kpi` writes **`docs/kpi/KPI_REPORT.md`** (+ raw JSON): rule-evaluation correctness, decision latency, slot-allocation safety under 10,000 concurrent attempts, deadlock detection, ranking latency/optimality, AVL-vs-hash lookups, cache hit-rate, 10,000-way concurrent application safety, idempotency, audit coverage, recovery RTO/RPO, 200-concurrent-user reliability, traceability and more. The committed report is from the last run on the development machine; thresholds are the course targets from the design document.

Not covered by scripts (verify manually / with a browser tool): cross-browser behaviour, true LCP, automated accessibility audit.

---

## Project layout

```
shared/                 response envelope, errors, correlation middleware, constants (state machine), signed tokens
services/team-a-eligibility/   src/{rules,queues,engine,controllers}  tests/
services/team-b-ranking/       src/{graph,ranking,index,engine}       tests/
services/team-c-placement/     src/{db,services,controllers,routes,middleware}  data/ (gitignored)  tests/
services/team-d-portal/        src/bff/…   src/frontend/{css,js/{components,views}}   src/mocks/   tests/
scripts/                start-all · seed-data · reset-data · health-check · kpi-report
docs/kpi/               generated KPI evidence
```

See `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` for architecture rules (no external databases or algorithm libraries, team boundaries, shared contracts) and `RIT_Placement_Eligibility_System_Design_APIs_Sequences_KPIs by GSW.md` for the original design.

---

## Known limitations

- Team A and B hold their working state in memory (rebuilt from Team C on start-up); only Team C persists data.
- Authentication is an academic implementation (scrypt-hashed passwords, HMAC-signed tokens) — put TLS and a real identity provider in front for production.
- Everything runs on one host in the KPI script; the numbers show the algorithms, not a distributed deployment.

## License & credits

Developed for **Rajarambapu Institute of Technology (RIT)** — Department of Computer Science & Engineering. Academic Year 2026–27.
