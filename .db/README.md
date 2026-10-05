# Database files

This project uses PostgreSQL, not a checked-in SQLite `.db` file. Database
tables are defined by Drizzle in `api/src/db/src/schema/`; `DATABASE_URL`
selects the PostgreSQL database at runtime. The root `docker-compose.yml`
starts PostgreSQL for local development and stores its data in the named
`spa-postgres-data` Docker volume.

This folder intentionally contains no live database, customer data, credentials,
or production backup. Keep dumps and other database files out of source control.
See `docs/database-guide.md` for schema, migration, backup, and connection
guidance.