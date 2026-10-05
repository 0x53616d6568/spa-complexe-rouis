# Use guide

## Guest/customer booking

1. Open the public site and browse Services.
2. Choose a service and a date. The app displays available appointment times.
3. Enter the requested contact details and submit the booking.
4. Keep the booking reference shown on the confirmation page.

Guest booking does not require registration. A new booking starts in `pending`
status until a manager confirms or otherwise updates it. The current app does
not provide a customer account dashboard or a secure email link for guests to
reschedule/cancel.

## Manager

1. Create a user account through the configured Clerk sign-in flow.
2. Have an administrator assign the `manager` role using the integration
   instructions. The role maps to permissions server-side; routes do not trust
   a role name supplied by the browser.
3. Sign in and open `/manager`.
4. Review the dashboard and bookings, assign a therapist where appropriate,
   then update booking status as the appointment progresses.

Supported statuses are `pending`, `confirmed`, `checked_in`, `completed`,
`cancelled`, and `no_show`. Use the status controls rather than editing the
database directly.

## Admin

An account with Clerk role `admin` can use the manager area and open
`/admin/audit-logs` to review recent audit events. The API exposes the effective
permission set at `GET /api/auth/me`. The current UI does not yet provide full
account/role administration, data exports, or security-event management from
the supplied plan.

## Demo data

The seed command adds clearly labeled placeholder business data. Update the
spa name, address, contact details, timezone, cancellation policy, service
descriptions/prices, staff profiles, and opening hours before inviting
customers. Demo values are not business-approved terms.