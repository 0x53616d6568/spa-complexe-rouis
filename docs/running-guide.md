# Running guide

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- Docker with Compose, or a reachable PostgreSQL database
- A Clerk development instance for sign-in and manager/admin pages

## First run

From the extracted `spa-platform/` directory:

```sh
cp .env.example .env
```

Edit `.env` and set the Clerk keys. For local PostgreSQL, the sample
`DATABASE_URL` matches the defaults in `docker-compose.yml`. The sample
database password is for local development only.

Start PostgreSQL, install dependencies, then load `.env` into the current
terminal before running commands:

```sh
docker compose up -d db
pnpm install
set -a
. ./.env
set +a
pnpm db:push
pnpm seed
pnpm dev
```

`pnpm dev` starts both processes. The default addresses are:

- Web: `http://localhost:5173`
- API health check: `http://localhost:5000/api/healthz`

The web dev server proxies `/api` requests to the API port. Set `WEB_PORT`,
`PORT`, and `API_PORT` in `.env` if the defaults conflict with other services.

The first seed inserts demo business details, three sample services, seven
days of sample working hours, and two sample staff profiles. It is safe to
re-run, but it does not replace existing placeholder values.

## Build and typecheck

With dependencies installed:

```sh
pnpm typecheck
pnpm build
```

The frontend build can complete without valid Clerk keys, but sign-in and
protected screens require a configured Clerk development instance at runtime.

## Stop local services

Stop the app processes with `Ctrl+C`. Stop PostgreSQL while retaining its data:

```sh
docker compose stop db
```

The database uses a persistent Docker volume. `docker compose down -v` deletes
that volume and all local database data; use it only when you intend to reset
the development database.