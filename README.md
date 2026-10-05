# Local Spa Platform

A guest-first spa appointment booking site with protected manager and admin
operations. This archive was assembled from the current merged `main` checkout.

## Quick start

1. Copy `.env.example` to `.env` and add Clerk development keys as described in
   `docs/integration-guide.md`.
2. Start local PostgreSQL: `docker compose up -d db`.
3. Install packages: `pnpm install`.
4. Load the environment in the current terminal, then set up and seed the
   development database:

   ```sh
   set -a
   . ./.env
   set +a
   pnpm db:push
   pnpm seed
   ```

5. Start the API and web app together with `pnpm dev`.
6. Open the web address printed by Vite (default `http://localhost:5173`).

Read `docs/running-guide.md` for details, `docs/use-guide.md` for app workflows,
and `docs/system-description.md` for implementation boundaries and planned
work.

## Database note

The app uses PostgreSQL with Drizzle ORM. `.db/README.md` explains why no
database binary is included. `api/prisma/schema.prisma` is a reference schema
only; Drizzle under `api/src/db/` is the runtime source of truth.

## Useful commands

- `pnpm dev` — API on port 5000 and web app on port 5173.
- `pnpm build` — build API and web packages.
- `pnpm typecheck` — typecheck workspace packages.
- `pnpm db:push` — apply the Drizzle schema to a development database.
- `pnpm seed` — insert demo spa settings, services, working hours, and staff.

The seed values are placeholders. Replace the demo spa identity, policies,
prices, services, and staff before real bookings.