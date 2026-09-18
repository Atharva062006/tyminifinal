# Team D — APNILEAP Placement Portal

**Web Technology | Port 3000 | Express BFF + Vanilla JS SPA**

Team D is the end-user portal and API Gateway for the APNILEAP Placement Management Platform. It serves a full Vanilla JS Single Page Application (SPA) and integrates with Team A (OS Eligibility), Team B (Data Structures Ranking), and Team C (DBMS Authoritative Engine) via HTTP and Server-Sent Events (SSE).

---

## Architecture Overview

```
Browser (SPA)  ←→  Team D BFF (Port 3000)  ←→  Team C (Port 3003)
                                             ←→  Team A (Port 3001)
                                             ←→  Team B (Port 3002)
```

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS SPA (no framework) |
| Backend-for-Frontend | Node.js + Express |
| Upstream Integration | HTTP REST + SSE relay |
| Auth | Bearer `<role>_<userId>` token |
| Live Updates | SSE Proxy from Team C outbox |

---

## Role-Based Access

| Role | Login ID Example | Access |
|---|---|---|
| **student** | `STU001` | Drives, Applications, Eligibility Check, Rankings, Profile |
| **faculty** | `FAC001` | Operations Dashboard, All Applications, Analytics, Reports |
| **admin** | `ADM001` | Full control + Drives Admin, Audit Trail, System Health |

---

## Quick Start

```bash
# Install dependencies (from repo root)
npm install

# Start only Team D portal
npm run start:d   # runs on http://localhost:3000

# Start entire platform
npm run start:all  # Teams A, B, C, D

# Seed authoritative database (Team C)
npm run seed

# Run Team D unit & integration tests
npm test --prefix services/team-d-portal
```

---

## Environment Variables

Copy `.env.example` to `.env` in `services/team-d-portal/`:

```bash
cp services/team-d-portal/.env.example services/team-d-portal/.env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Team D BFF port |
| `TEAM_A_BASE_URL` | `http://localhost:3001` | Team A OS Engine URL |
| `TEAM_B_BASE_URL` | `http://localhost:3002` | Team B DS Engine URL |
| `TEAM_C_BASE_URL` | `http://localhost:3003` | Team C DBMS Engine URL |
| `TEAM_C_STREAM_URL` | `http://localhost:3003/api/v1/stream` | SSE stream endpoint |
| `MOCK_TEAM_A` | `false` | Use mock fallback for Team A |
| `MOCK_TEAM_B` | `false` | Use mock fallback for Team B |
| `MOCK_TEAM_C` | `false` | Use mock fallback for Team C |
| `NODE_ENV` | `development` | Environment mode |

> **Mock Mode**: When Team A/B/C are offline (e.g., during isolated testing), Team D automatically falls back to local mock adapters without throwing errors. Live services take priority.

---

## BFF API Endpoints (`/api/v1/ui/*`)

### Authentication & Session

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/ui/session` | None | Login, returns Bearer token |
| `GET` | `/api/v1/ui/me` | Required | Current user profile |
| `DELETE` | `/api/v1/ui/session` | None | Logout |

### Placement Drives

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/drives` | Optional | List drives from Team C |
| `GET` | `/api/v1/ui/drives/:id` | Optional | Drive details + criteria |
| `PATCH` | `/api/v1/ui/drives/:id` | Admin/Faculty | Update drive state or seats |

### Eligibility (Team A Integration)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/eligibility/check/:driveId` | Student | Live rule chain evaluation via Team A |

### Applications (Team C Integration)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/ui/applications` | Student | Submit application (with Idempotency-Key) |
| `GET` | `/api/v1/ui/applications` | Any | List applications (filtered) |
| `GET` | `/api/v1/ui/applications/:id` | Any | Detailed application + 7-step timeline |
| `POST` | `/api/v1/ui/applications/:id/withdraw` | Student | Withdraw application |

### Rankings (Team B Integration)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/rankings` | Any | Computed rankings for a drive |
| `POST` | `/api/v1/ui/rankings/preview` | Faculty/Admin | Simulate ranking with custom weights |

### Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/dashboard` | Any | Role-specific aggregated dashboard |

### Reports & Audit

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/reports/placement-performance` | Admin | Placement performance report |
| `GET` | `/api/v1/ui/audit` | Admin | Immutable audit trail query |

### System Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/system` | Admin | Multi-service health monitoring |

### SSE Event Stream

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/ui/stream` | Any | Live SSE relay from Team C outbox |

---

## Frontend SPA Route Map

| Route | Role | View |
|---|---|---|
| `#/login` | Public | Persona switcher login |
| `#/student/dashboard` | student | KPI cards, applications, drives |
| `#/student/drives` | student | Drive discovery with filters |
| `#/student/drives/:id` | student | Drive detail + apply modal |
| `#/student/applications` | student | Application tracker list |
| `#/student/applications/:id` | student | 7-step timeline detail |
| `#/student/eligibility` | student | Interactive eligibility sandbox |
| `#/student/rankings` | student | Candidate leaderboard |
| `#/student/profile` | student | Academic profile |
| `#/faculty/dashboard` | faculty/admin | Operations dashboard |
| `#/faculty/applications` | faculty/admin | All applications manager |
| `#/faculty/rankings` | faculty/admin | Ranking compute panel |
| `#/faculty/analytics` | faculty/admin | Department analytics & telemetry |
| `#/faculty/reports` | faculty/admin | Printable placement report |
| `#/admin/dashboard` | admin | Control panel |
| `#/admin/drives` | admin | Drive management + criteria editor |
| `#/admin/audit` | admin | Immutable audit log viewer |
| `#/admin/system` | admin | Microservice health dashboard |

---

## Application State Machine

All state transitions are enforced by **Team C only**. Team D displays and proxies.

```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED
```

Alternative outcomes: `NOT_ELIGIBLE` | `WAITLISTED` | `WITHDRAWN` | `EXPIRED` | `COMPENSATION_REQUIRED`

---

## SSE Live Updates

Team D runs an internal SSE proxy service (`sseProxyService.js`) that:
- Maintains a persistent connection to Team C's outbox at `http://localhost:3003/api/v1/stream`
- Relays `audit` events to all connected browser clients
- Sends 15-second heartbeat pings to prevent connection drops
- Auto-reconnects with 5-second back-off if Team C disconnects
- Broadcasts `stream_status: DISCONNECTED` and stale-data indicator to UI on failure

---

## Cross-Service Request Headers

Every request from Team D to Teams A, B, C includes:

| Header | Description |
|---|---|
| `X-Correlation-ID` | Unique UUID per request chain (auto-generated if not received from browser) |
| `Authorization` | Forwarded Bearer token from user session |
| `Idempotency-Key` | UUID generated per application submission, stored in `localStorage` |

---

## Mock Fallback Adapters

Located at `src/mocks/`:

| File | Description |
|---|---|
| `mockTeamA.js` | Local decision tree rule evaluator |
| `mockTeamB.js` | Local weighted scoring and heap ranking |
| `mockTeamC.js` | In-memory data store with sample students, drives, and applications |

All real clients automatically fall back to mocks when upstream services are unreachable, displaying `DEGRADED` mode indicators in the UI.

---

## Test Suite

Located at `tests/`:

| File | Coverage |
|---|---|
| `auth.test.js` | Session create/destroy, RBAC, `/me` endpoint |
| `drives.test.js` | Drive listing, eligibility check, admin PATCH guard |
| `applications.test.js` | Consent validation, cross-student guard, list |
| `dashboard.test.js` | Student/Faculty/Admin dashboard aggregation |
| `rankings.test.js` | Rankings retrieval, preview simulation |
| `error_handling.test.js` | 404/400 envelopes, system health |
| `e2e_integration.test.js` | Full Apply → Rank → Audit E2E flow |

```bash
npm test --prefix services/team-d-portal
```

---

## File Structure

```
services/team-d-portal/
├── server.js                          # Express BFF entry point
├── .env.example                       # Environment configuration template
├── package.json
├── src/
│   ├── bff/
│   │   ├── controllers/               # Route handlers
│   │   │   ├── sessionController.js
│   │   │   ├── driveController.js
│   │   │   ├── applicationController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── rankingController.js
│   │   │   ├── reportController.js
│   │   │   └── systemController.js
│   │   ├── middleware/
│   │   │   ├── auth.js                # Bearer token RBAC
│   │   │   ├── correlation.js         # X-Correlation-ID
│   │   │   └── errorHandler.js        # Centralised error → JSON envelope
│   │   ├── routes/
│   │   │   └── uiRoutes.js            # All /api/v1/ui/* routes
│   │   ├── services/
│   │   │   ├── teamAClient.js         # Team A OS Engine client
│   │   │   ├── teamBClient.js         # Team B DS Engine client
│   │   │   ├── teamCClient.js         # Team C DBMS client
│   │   │   ├── dashboardService.js    # Cross-service dashboard aggregation
│   │   │   ├── applicationService.js  # Application + timeline aggregation
│   │   │   ├── rankingService.js      # Ranking aggregation
│   │   │   └── sseProxyService.js     # Resilient SSE relay
│   │   └── utils/
│   │       ├── apiResponse.js         # sendSuccess / sendError helpers
│   │       ├── timeout.js             # withTimeout utility
│   │       └── retry.js               # retryOperation utility
│   ├── mocks/
│   │   ├── mockTeamA.js
│   │   ├── mockTeamB.js
│   │   └── mockTeamC.js
│   └── frontend/
│       ├── index.html                 # SPA shell
│       ├── css/
│       │   ├── main.css               # Core design system
│       │   └── components.css         # Component styles
│       └── js/
│           ├── api.js                 # BFF API client
│           ├── state.js               # Reactive state store
│           ├── sse.js                 # SSE subscriber client
│           ├── router.js              # Hash-based SPA router
│           ├── app.js                 # Bootstrap & route registration
│           ├── components/            # Reusable UI components
│           └── views/                 # Role-based page views
│               ├── student/
│               ├── faculty/
│               └── admin/
└── tests/
    ├── auth.test.js
    ├── drives.test.js
    ├── applications.test.js
    ├── dashboard.test.js
    ├── rankings.test.js
    ├── error_handling.test.js
    └── e2e_integration.test.js
```

---

## Team Boundary Invariants

- **Team D never directly touches JSON data files** — all mutations go through Team C's REST API
- **All cross-service mutations include `Idempotency-Key`** headers via Team C Client
- **Only Team C's `stateMachineService.js`** may change application state
- **Team A and Team B are read-only** from Team D's perspective — no state mutations
