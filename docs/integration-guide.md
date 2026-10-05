# Integration guide

## PostgreSQL

The running API uses PostgreSQL through Drizzle ORM. Start the local database
with `docker compose up -d db`, or set `DATABASE_URL` to a PostgreSQL instance
you control. Keep development, test, staging, and production databases
separate. See `database-guide.md` before changing a shared or production schema.

## Public API limits and booking conflicts

Public availability, booking creation, guest booking reads, and guest
cancellations have per-IP request limits. The current limiter stores counters in
API process memory; use a shared store before running multiple API instances.
`TRUST_PROXY_HOPS` defaults to `0`. Set it to the exact number of trusted
reverse proxies in front of the API so Express uses the client IP without
trusting arbitrary forwarded headers.

Booking creation serializes slot checks in a PostgreSQL transaction and inserts
unique slot claims for the appointment duration and service buffers. The
database uniqueness constraint rejects competing requests for an overlapping
slot, while an idempotency key makes a retried request return the original
confirmation. Availability results can become stale, so the booking endpoint
checks the slot again before saving.

Bookings submitted from a signed-in account link the customer record only when
the submitted email is verified on that Clerk account. Other bookings remain
guest records, which lets staff filter customer records by account type.

## Clerk authentication

The web app uses Clerk for sign-in/sign-up. The API verifies Clerk sessions,
maps `publicMetadata.role` to centralized permissions, and authorizes each
protected operation by permission. The current role map is defined in
`api/src/modules/auth/authorization.ts`.

1. Create a Clerk development application and allow the local web origin
   (`http://localhost:5173` by default).
2. Copy its publishable key to both `VITE_CLERK_PUBLISHABLE_KEY` and
   `CLERK_PUBLISHABLE_KEY`.
3. Put its secret key in `CLERK_SECRET_KEY`. This key is server-only; never use
   a `VITE_` prefix for it or commit it.
4. Restart the API and web processes after editing `.env`.
5. Create the account that should receive a staff role, then run one of:

   ```sh
   pnpm --filter @workspace/api-server run grant-role -- staff@example.com manager
   pnpm --filter @workspace/api-server run grant-role -- owner@example.com admin
   ```

The command updates the matching Clerk user's public metadata. It requires
`CLERK_SECRET_KEY` to be loaded in the terminal. Only use trusted accounts for
manager/admin roles. Effective access for the signed-in account is available
from `GET /api/auth/me`; clients should use its `permissions` array rather than
hard-coding role checks.

`VITE_CLERK_PROXY_URL` is optional. Leave it empty for a normal local
development setup. Configure it only when you have deliberately set up a
Clerk proxy route and matching domain.

## Email

Booking emails are processed asynchronously from the PostgreSQL notification
queue. Email is disabled in `.env.example`. To enable SMTP, set
`EMAIL_PROVIDER=smtp`, then set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Store the SMTP password in a secret
manager outside local development. Booking creation does not require an email
provider, but customers will not receive notification emails while email is
disabled.

SMS, online payments, object storage, and external job queues are not connected
in this version.
