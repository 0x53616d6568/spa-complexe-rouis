# System description

## Purpose

This is a single-location spa booking and operations app. The public flow is
guest-first: visitors browse services, check availability, and request an
appointment without creating an account. Clerk sign-in protects staff
operations.

## Runtime architecture

- **Web:** React 19, TypeScript, Vite, Tailwind CSS, and Clerk React components.
- **API:** Express 5 and TypeScript, mounted under `/api`.
- **Database:** PostgreSQL accessed through Drizzle ORM.
- **Contracts:** shared Zod schemas plus generated React Query API hooks.
- **Email:** queued in PostgreSQL and delivered by an asynchronous SMTP worker.
- **Authentication:** Clerk; `publicMetadata.role` is mapped to centralized
  permissions before protected operations are authorized.

The API and web packages are independent processes. For local development,
Vite proxies `/api` to the API process. Production needs an equivalent reverse
proxy or deployment routing rule.

## Module map

- `api/src/modules/auth` — Clerk session verification and role-to-permission
  policy.
- `api/src/modules/services` — public service catalog.
- `api/src/modules/bookings` — booking transaction, idempotency, and status
  history.
- `api/src/modules/guest-bookings` — reserved boundary; current guest booking
  implementation remains in the bookings module.
- `api/src/modules/availability` — service availability calculation.
- `api/src/modules/staff` — manager booking views, staff assignment, and status
  updates.
- `api/src/modules/notifications` — queued email worker.
- `api/src/modules/audit` — audit event writes and reads.
- `api/src/db` — Drizzle connection and PostgreSQL schema.
- `api/src/contracts` — shared API Zod contracts.
- `web/app`, `web/components`, and `web/lib` — Vite entry pages, UI, hooks,
  utilities, and generated API client.

## Booking and access safeguards present in the code

- Booking input is validated server-side.
- The API recalculates availability during booking creation.
- Booking creation is transactional and uses a PostgreSQL advisory lock,
  idempotency keys, and unique time-slot claims to reject conflicting requests.
- Manager routes require capabilities such as `view_all_bookings`,
  `manage_staff_schedules`, and `view_operational_reports`; audit-log access
  requires `view_audit_logs`.
- `GET /api/auth/me` returns the authenticated account's effective role and
  permissions for client-side capability-aware UI.
- Booking status changes and staff assignment are recorded in audit/history
  tables.
- Email delivery is queued so email failure does not undo a saved booking.

The slot-claim table is global by time rather than keyed by therapist. Confirm
that this capacity model matches the spa's staffing rules before production.

## Requirements from the supplied architecture plan

The supplied plan (`architecture-plan.md`) remains the product/security
reference. Its key constraints include guest booking by default, server-side
authorization, server-rechecked availability, database-backed conflict
prevention, sensitive-operation auditing, customer-data minimization,
responsive accessible interfaces, and no online payment in version 1.

## Current limitations

This archive packages the existing implementation; it does not claim that the
whole blueprint is complete. Current code does not yet provide:

- Guest booking management tokens and self-service cancel/reschedule.
- Customer accounts, ownership-scoped booking history, or customer profile
  management.
- A database-backed/configurable permission registry, MFA policy, or full admin
  account and role-management UI. The current permission policy is centralized
  in code so future roles can be added without changing route authorization.
- Staff time-off/closure management or multi-location support.
- Production migration/rollback tooling, automated backup restoration checks,
  or the full unit/integration/end-to-end security test plan.
- Online payment, SMS, or a persistent object-storage integration.

The seed data is demonstrative. Replace it and complete a security, privacy,
operational, and accessibility review before real customer use.