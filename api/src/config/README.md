# API configuration

The API reads configuration from environment variables. See the root
`.env.example` and `docs/integration-guide.md`. In particular:

- `DATABASE_URL` connects the API to PostgreSQL.
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` configure Clerk.
- `PORT` selects the API listen port.
- `SMTP_*` and `EMAIL_PROVIDER` control the asynchronous email worker.

Do not add real credentials to this directory or commit a `.env` file.