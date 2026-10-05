# Guest bookings

Guest booking creation is currently implemented in
`../bookings/bookings.service.ts` and exposed by `POST /api/bookings`.
This directory reserves the module boundary from the supplied architecture
plan; it is not a second booking implementation.

The current flow collects the customer's name, email, and phone without
requiring a Clerk account. When `PUBLIC_APP_URL` and a 32-byte-or-longer
`GUEST_BOOKING_MANAGEMENT_SECRET` are configured, the booking email includes a
30-day link to review or cancel an upcoming pending or confirmed booking. The
token is derived from the notification ID and secret, and only its SHA-256 hash
is stored in `guest_booking_tokens`. Cancellation consumes the token, releases
the slot claim, records status history and an audit event, and queues a customer
email. `GET /api/guest-bookings/manage?token=...` returns booking details
without consuming the token so common email link scanners do not invalidate the
customer's link. `POST /api/guest-bookings/manage/cancel?token=...` performs
cancellation. The API request logger omits query strings so bearer tokens are
not copied into normal access logs.

The database schema is synchronized by `pnpm db:push` or `pnpm db:init`.
Rescheduling and account-backed booking history remain future work.
