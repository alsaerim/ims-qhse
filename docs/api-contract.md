# ISO Radar — API contract (frontend ⇄ backend)

What the frontend pages call, what the NestJS backend (`ims-qhse-backend`) already serves, and the
exact shapes needed for the endpoints that do not exist yet. Written so the backend work can start
from this file.

## Conventions the frontend relies on

| Topic | Rule |
|---|---|
| Base URL | `https://<backend>/api/v1` (pages hold it in `API` / `MAPI`) |
| Auth | `Authorization: Bearer <access_token>`; `401` sends the user back to login |
| Envelope | `{ success: true, data: <payload> }` — the existing `TransformInterceptor` |
| Lists | `data` is a **plain array** (the interceptor unwraps `{ data, total }`). Pages also accept `{ data: [...] }` |
| Enums | Stored upper-case (`OPEN`, `COMPLETED`, `MAJOR`). Pages lower-case `status/type/result/severity/priority` on read and send either case; the backend upper-cases on write |
| Errors | Non-2xx with `{ message }` — the message is shown to the user, so write it in Arabic |
| Missing endpoint | `404` on a `GET` list renders an empty state; on writes the page says the module is not enabled on the server yet |
| Tenant | Every tenant route scopes by `req.user.tenant_id`; never trust a tenant id from the body |

## Status of every endpoint the pages call

Legend: ✅ exists · 🟡 exists, frontend adapted · ✅ missing (build it)

### Auth & users
| Method | Path | Status | Used by |
|---|---|---|---|
| POST | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` | ✅ | landing, mobile, admin |
| GET | `/auth/me` | ✅ | all |
| GET/POST | `/users` · GET/PUT/DELETE `/users/:id` · POST `/users/:id/activate` | ✅ | app, mobile profile (PUT own name/phone/department/password) |
| GET | `/users/stats/roles` | ✅ | app |
| POST | `/users/:id/avatar` | ✅ | app user modal, mobile profile (`{ image_base64 }` → `{ avatar_url }`; self or admin) |

### Quality core
| Method | Path | Status | Notes |
|---|---|---|---|
| GET/POST, PUT/DELETE `:id` | `/projects` | ✅ | stored on the `Audit` table with `type='project'` — move to its own table |
| GET/POST, PUT/DELETE `:id`, GET `/stats` | `/audits` | 🟡 | mobile used `/inspections` + `/inspections/:id/complete`; now uses `/audits` and completes with `PUT /audits/:id { status:'COMPLETED', result:'PASS'\|'PARTIAL'\|'FAIL', compliance_score, completed_at, checklist_data }` |
| GET/POST, PUT/DELETE `:id`, GET `/stats` | `/nonconformances` | ✅ | |
| GET/POST, PUT/DELETE `:id` | `/rca`, `/risks`, `/kpis`, `/lean/wastes` | ✅ | |
| GET | `/kpis/:id/history` | ✅ | |
| GET/PUT | `/org/profile` · `/org/iso/standards` · `/org/objectives` | ✅ | app now calls `/org/iso/standards` (was `/org/iso-standards`) |
| GET | `/org/objectives` (list) | ✅ | same objectives as inside `/org/profile` |
| GET/POST/PUT/DELETE | `/iso/standards` | ✅ | |
| GET/POST/PUT/DELETE | `/integrations` | ✅ | |
| GET | `/dashboard/overview` | ✅ | |
| GET / PUT `read` | `/dashboard/notifications` | ✅ | the signed-in user's own notifications (task assigned, high/critical incident); PUT `{ ids: [] }` marks all read |
| POST | `/advisory-sessions/chat`, GET/POST/DELETE `/advisory-sessions` | ✅ | only module without `/v1` versioning |

### ISO Radar modules (built in migration `20261028000000_isoradar_modules`)
| Method | Path | Page |
|---|---|---|
| GET/POST, PUT/DELETE `:id` | `/incidents` ✅ | app «الحوادث والإصابات», mobile «الإبلاغ عن حادث» (any member may report; delete = manager) |
| GET/POST, PUT/DELETE `:id` | `/documents` ✅ | app «ضبط الوثائق» (code unique per company) |
| GET/POST, PUT/DELETE `:id` | `/trainings` ✅ | app «التدريب والكفاءات» (status derived from expiry) |
| GET/POST, PUT/DELETE `:id` | `/tasks` ✅ · `/dashboard/tasks` ✅ | app Kanban (assets/isoradar-tasks-sync.js), mobile «مهامي» (`?mine=1`) |
| GET/POST, PUT/DELETE `:id` | `/annual-plans` ✅ | mobile «الخطة السنوية» (managers edit) |
| POST · GET · DELETE `:id` | `/uploads/photo` ✅ · `/uploads` · `/uploads/:id/file?sig=` | mobile inspection / NC / RCA / incident photos, task attachments |
| GET | `/db-stats` ✅ | mobile profile counters (records the user created) |
| GET | `/health` ✅ | admin «صحة النظام» (public) |

### Platform console (SUPER_ADMIN only)
| Method | Path | Status | Page |
|---|---|---|---|
| GET | `/super-admin/stats`, `/revenue`, `/tenants`, `/tenants/:id`, `/plans`, `/invoices` | ✅ | dashboard, analytics, tenants, plans, invoices |
| POST/PUT | `/super-admin/tenants/:id/assign-plan`, `/plans`, `/plans/:id`, `/plans/:id/features`, `/invoices/:id/pay`, `/invoices/generate` | ✅ | |
| GET · PUT `:id` | `/super-admin/users` | ✅ | «مستخدمو المنصة» |
| GET | `/super-admin/audit-log` | ✅ | «سجل النشاط» |
| GET/POST · DELETE `:id` | `/super-admin/announcements` | ✅ | «الإعلانات» |
| GET · PUT | `/super-admin/settings` | ✅ | «الإعدادات» |

## Shapes for the missing endpoints

All rows also carry `id` (uuid), `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete).
`?mine=1` on a list means "rows created by / assigned to the current user".

### `/incidents` — ISO 45001 §10.2
```jsonc
{
  "ref_number": "INC-2026-001",          // server-generated
  "title": "انزلاق عامل عند مدخل المستودع", // required
  "type": "NEAR_MISS | FIRST_AID | MEDICAL | LOST_TIME | PROPERTY_DAMAGE | ENVIRONMENTAL", // required
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",  // required
  "occurred_at": "2026-10-27",           // required
  "location": "المستودع — البوابة 2",
  "latitude": 26.9, "longitude": 49.6,
  "project_id": null,
  "description": "…", "immediate_action": "…",
  "status": "REPORTED | INVESTIGATING | CLOSED",  // default REPORTED
  "reported_by": "<user id>",            // take from req.user, not the body
  "nc_id": null, "rca_id": null          // optional links once investigated
}
```

### `/documents` — ISO 9001 §7.5
```jsonc
{
  "code": "QP-07-01",                    // required, unique per tenant
  "title": "إجراء ضبط المنتج غير المطابق", // required
  "doc_type": "POLICY | MANUAL | PROCEDURE | WORK_INSTRUCTION | FORM | RECORD", // required
  "iso_standard": "ISO_9001",
  "version": "1.0",
  "owner": "مدير الجودة",
  "effective_date": "2026-01-01",
  "review_date": "2027-01-01",           // page flags rows due within 30 days
  "status": "DRAFT | UNDER_REVIEW | APPROVED | OBSOLETE", // default DRAFT
  "file_url": "https://…"                // later: POST /documents/:id/file
}
```

### `/trainings` — ISO 9001 / 45001 §7.2
```jsonc
{
  "user_id": null,                        // optional link to a user
  "employee_name": "محمد الزهراني",        // required
  "course": "السلامة من الحرائق",           // required
  "provider": "الدفاع المدني",
  "iso_standard": "ISO_45001",
  "completed_at": "2026-05-01",           // required
  "expires_at": "2028-05-01",
  "certificate_url": "https://…",
  "status": "VALID | EXPIRING | EXPIRED"  // optional; the page derives it from expires_at (≤30 days = EXPIRING)
}
```

### `/tasks`
```jsonc
{ "title": "…", "description": "…", "status": "TODO | IN_PROGRESS | REVIEW | DONE",
  "priority": "LOW | MEDIUM | HIGH | URGENT", "assigned_to_id": "<user>", "project_id": null,
  "iso_standard": "ISO_9001", "due_date": "2026-11-10", "completed_at": null,
  "source_type": "NC | RCA | RISK | AUDIT | null", "source_id": null }
```
`/dashboard/tasks` returns the current user's open tasks.

### `/annual-plans`
```jsonc
{ "title": "تدقيق داخلي ISO 9001", "iso_standard": "ISO_9001", "quarter": "Q1 | Q2 | Q3 | Q4",
  "owner": "…", "start_date": "2026-01-15", "end_date": "2026-03-31",
  "progress": 40, "status": "PLANNED | IN_PROGRESS | COMPLETED | DELAYED" }
```

### `/uploads/photo`
Request `{ image_base64, entity_type: "inspection | nc | rca | incident | task | document", entity_id, latitude, longitude }`
→ `{ id, url }`. `entity_id` may be the record id or its number (`NC-2026-014`) and must belong to the caller's company.
JPG / PNG / WEBP only (checked by content), 5 MB max. Stored in Postgres (`uploads`, bytea) because no object storage is configured;
`url` is HMAC-signed (`UPLOAD_SIGNING_SECRET`, falls back to `JWT_SECRET`) so `<img>` can load it without a token.

### `/super-admin/users`
`GET` → `[{ id, full_name, email, role, status, tenant_id, tenant_name, last_login_at }]` (supports `?search=&role=&status=&limit=`)
`PUT /super-admin/users/:id` `{ status: "ACTIVE" | "INACTIVE" }`

### `/super-admin/audit-log`
`GET ?limit=&tenant_id=&action=` → `[{ id, created_at, actor_id, actor_name, tenant_id, tenant_name, action: "LOGIN | LOGOUT | CREATE | UPDATE | DELETE | ASSIGN_PLAN | PAYMENT", entity_type, entity_ref, ip_address }]`.
Write rows from an interceptor on auth and on mutating super-admin / user routes.

### `/super-admin/announcements`
`{ title, body, level: "INFO | WARNING | CRITICAL", audience: "ALL | ADMINS | TRIAL", ends_at }` → list returns `created_at` too.
Tenant apps should later read active ones from `GET /announcements/active`.

### `/super-admin/settings`
`{ trial_days: 14, vat_rate: 15, currency: "SAR", due_days: 7, support_email: "", maintenance_mode: false }` — one row per platform.

### `/health` (public)
`{ status: "ok", version: "1.0.0", db: "ok", uptime: 12345 }`.

## Known data-shape notes
- Audit `result` enum is `PASS | FAIL | PARTIAL | PENDING`; status `DRAFT | SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED`.
- NC `type` is `CRITICAL | MAJOR | MINOR | OBSERVATION`; status `OPEN | IN_PROGRESS | CLOSED | OVERDUE`.
- Lists lose `total` in the interceptor; if pagination is needed later, return it in `meta` (the interceptor already passes `meta` through).

## Security model (backend)
- Every tenant query is scoped by `req.user.tenant_id` from the JWT; ids in the body are never trusted.
- Roles: VIEWER reads; ENGINEER/AUDITOR write; MANAGER deletes and edits the annual plan; TENANT_ADMIN manages users; SUPER_ADMIN runs `/super-admin/*`.
- New modules validate input with DTOs (`whitelist: true` drops unknown fields); `<` `>` are stripped from all JSON strings (stored-XSS defence).
- Body limit 1 MB (8 MB for `/uploads/photo` and `/users/:id/avatar`); rate limits on login (5/min), register (3/min), uploads (40/min), advisory chat (20/min).
- Suspended or cancelled companies lose access immediately (login and existing tokens); `maintenance_mode` blocks every login except SUPER_ADMIN.
- Every successful change and every login / failed login is written to `audit_logs` (`/super-admin/audit-log`).
