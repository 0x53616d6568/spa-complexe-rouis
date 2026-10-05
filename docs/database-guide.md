# Database guide

## Runtime database

The application uses PostgreSQL and Drizzle ORM. The source schema is in
`api/src/db/src/schema/`; connection setup is in `api/src/db/src/index.ts`.
`DATABASE_URL` is required by the API.

There is no `.db` file in the archive. PostgreSQL is a server, and local data
lives in the Docker-managed `spa-postgres-data` volume. `.db/README.md` is a
placeholder for database guidance, not a database dump.

## Local schema setup

After starting PostgreSQL and loading `.env` into the shell:

```sh
pnpm db:push
pnpm seed
```

`db:push` uses Drizzle Kit to synchronize the current schema with the selected
database. Use it for local development only. Review every proposed change
before applying it to a shared database. The repository does not yet provide a
production migration and rollback workflow; establish one before deployment.

## Current tables

The checked-in Drizzle schema currently defines:

- `spa_settings`
- `service_categories` and `services`
- `staff_profiles`, `staff_services`, and `working_hours`
- `customers` and `bookings`
- `booking_status_history` and `booking_slot_claims`
- `guest_booking_tokens` for hashed, expiring guest booking links
- `notifications` and `audit_logs`

Customer rows can link to verified Clerk account IDs. The schema does not yet
include every table in the supplied blueprint, such as staff time off or
payment records.

## Prisma path in the requested layout

`api/prisma/schema.prisma` mirrors the current Drizzle table shape for reference
and to match the requested directory layout. Prisma is not installed or used by
the app. Do not run Prisma migrations from that file; doing so could create a
second, conflicting schema source.

## Backups and data safety

Do not commit database files, dumps, credentials, or customer exports. Back up
production PostgreSQL through the hosting provider, restrict access, encrypt
backups, and test restoration before relying on them. The local Docker volume
can be deleted by `docker compose down -v`; that command permanently removes
its local development data.
