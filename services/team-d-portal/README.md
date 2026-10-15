# Team D — Placement Portal & BFF

**Web Technology · port 3000 · Express BFF + vanilla-JS SPA**

The user-facing portal and the backend-for-frontend. It authenticates users against Team C accounts, aggregates Team A/B/C data per screen, relays the live event stream, and renders everything role-aware. Team D never owns application state.

```
Browser SPA ◀──REST + SSE──▶ BFF (this service) ──▶ Team C :3003 (system of record, orchestrates A and B)
                                                  ├─▶ Team A :3001 (eligibility check, queue, metrics, benchmarks)
                                                  └─▶ Team B :3002 (rankings, analytics, shortlist index)
```

## Run

```bash
npm run start:d          # BFF + SPA on http://localhost:3000 (needs Team C; A and B optional → visible degraded banner)
npm run start:all        # whole platform
npm run test:d           # 128 supertest tests against the in-memory mock adapters
```

Environment: `TEAM_A_URL`, `TEAM_B_URL`, `TEAM_C_URL`, `INTERNAL_SERVICE_SECRET`, `JWT_SECRET` (see root `.env.example`). `MOCK_TEAM_A|B|C=true` swaps in the mock adapters (offline demos and the tests).

## Behaviour guarantees

- **Real sessions**: `POST /session {username,password}` → signed token from Team C; `POST /register` for students. Sessions are verified on every call; Team C re-checks the role.
- **No fake success**: every workflow action (shortlist, reject, waitlist, interview, select, offer, accept/decline, withdraw) is a Team C call. Team C down ⇒ `503 TEAM_C_UNAVAILABLE`.
- **Honest degradation**: if Team A/B are unreachable the BFF answers from a local fallback and adds `meta.degraded` to the envelope; the SPA shows a banner. Benchmarks/policy/locks never fall back.
- **Role guards** in `routes/uiRoutes.js`: students (own data only) · faculty/TPO · admin · auditor (read-only evidence).
- **Rate limits** on sign-in/registration, writes and exports; CSV export neutralises formula injection.
- **Live updates**: `/stream?token=…` relays Team C events as typed JSON; notifications reach only their recipient.

## BFF endpoints (`/api/v1/ui`)

| Area | Endpoints |
| :-- | :-- |
| Session | `POST session` · `POST register` · `DELETE session` · `GET me` · `POST me/password` |
| Dashboard / stream | `GET dashboard` (role-specific) · `GET stream` |
| Students | `GET students` (staff) · `POST students` (staff) · `GET|PATCH students/:id` · `GET students/:id/readiness` |
| Drives & companies | `GET|POST companies` · `PATCH companies/:id` · `GET|POST drives` · `GET|PATCH drives/:id` · `GET eligibility/check/:driveId[?strategy]` |
| Applications | `POST|GET applications` · `GET applications/:id` · `POST applications/:id/{withdraw,shortlist,reject,waitlist,interviews,select,offer,offer-decision,reevaluate}` · `GET|PATCH interviews` · `GET offers` |
| Rankings | `GET rankings[?drive_id&algorithm]` · `POST rankings/preview` |
| Analytics & reports | `GET analytics` · `GET reports/placement-performance` · `GET reports/export?type&format` · `GET audit` |
| Notifications & announcements | `GET notifications` · `PATCH notifications/:id/read` · `POST notifications/read-all` · `GET|POST announcements` · `DELETE announcements/:id` |
| Admin | `GET|POST users` · `PATCH users/:id` · `GET system` · `POST system/benchmark/:team` · queue policy / locks / deadlocks (A) · shortlist lookup / cache invalidate (B) · reconciliation / recovery (C) |

## SPA map

| Role | Pages |
| :-- | :-- |
| Public | `#/login` · `#/register` |
| Student | dashboard · drives & company cards · drive detail + apply modal · applications + detail (stepper, decision, rank, audit) · interviews · offers (accept/decline) · eligibility check (strategy comparison) · my ranking · notifications · profile editor (skills with Team B suggestions, projects, certifications, academics) |
| Faculty / TPO | dashboard · review applications (shortlist / waitlist / reject / interview / select / offer, bulk shortlist) · interview schedule · drives · companies · students (verify) · announcements · ranking console (algorithms, weights, compare) · analytics · reports & export |
| Admin | control centre · users & roles · companies · drives · students · applications · rankings · analytics · reports · audit log · system & engines (health, benchmarks, queue policy, locks, deadlock analyser, cache, recovery, reconciliation) |
| Auditor | overview · audit log · system · analytics · reports (read-only) |

Every page header and card shows tiny **Team A/B/C/D** provenance tags.

## Frontend structure

```
src/frontend/index.html
css/main.css (design tokens: navy #0f2b5c / royal blue #1d4ed8, Inter) · components.css · layout.css (shell, pages, forms)
js/api.js (BFF client, meta.degraded) · state.js · sse.js · router.js · app.js (route table + roles)
js/components/ui.js (esc, fmt, teamTag, pageHeader, formModal, runAction, eligibility breakdown) · navbar.js (top bar + sidebar) · charts, timeline, dataTable, modal, toast
js/views/{loginView,accountView}.js · student/* · faculty/* · admin/*
```
