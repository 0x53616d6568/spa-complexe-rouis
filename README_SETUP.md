# Project Setup & Architecture Guide

This document summarizes the environment configuration, architecture overview, and developer cheat-sheet for working on the **Stillroom** Spa Platform.

---

## 1. What Was Done

### 1.1 Environment & Database Setup (Cloud-based, No Docker Needed)
* **Replaced Local Docker with Aiven Cloud PostgreSQL**:
  Instead of requiring local Docker Desktop, the backend was connected directly to an **Aiven Cloud PostgreSQL** instance.
* **Configured `.env`**:
  - Connected `DATABASE_URL` to Aiven Cloud DB with SSL enabled.
  - Configured Clerk Authentication (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
  - Added session signing secrets and API ports (`PORT=5000`, `WEB_PORT=5173`).
* **Database Schema Initialization**:
  - Ran database table creation scripts (`init-db.mjs`) to create all tables:
    `spa_settings`, `service_categories`, `services`, `bookings`, `booking_slot_claims`, `working_hours`, `staff_profiles`, `audit_logs`, etc.
* **Seeded Initial Demo Data**:
  - Ran `pnpm seed` to populate initial spa treatments, working hours, and placeholder settings.

### 1.2 Development Environment & Package Manager
* Installed **`pnpm`** globally to manage workspace dependencies across the monorepo.
* Successfully installed and built dependencies for both `@workspace/api-server` and `@workspace/spa-platform`.
* Launched both API (port `5000`) and React frontend (port `5173`) concurrently via `pnpm dev`.

---

## 2. Running the Application Daily

To start working on the project, you only need to run:

```bash
pnpm dev
```

This concurrently starts:
* **Frontend (React + Vite)**: [http://localhost:5173](http://localhost:5173)
* **Backend API (Express 5)**: [http://localhost:5000](http://localhost:5000) (Health check: [http://localhost:5000/api/healthz](http://localhost:5000/api/healthz))

---

## 3. Why Docker Is Not Required

The original project included a `docker-compose.yml` to spin up a local PostgreSQL container. Because we configured **Aiven Cloud PostgreSQL**, your database is hosted in the cloud. You do **not** need Docker Desktop installed to run, build, or develop this project.

---

## 4. Angular vs. React Cheat-Sheet

If you are coming from an Angular background, here is how concepts in this codebase map to what you know:

| Angular Concept | React Equivalent in this Project | Code Location / Example |
| :--- | :--- | :--- |
| **Component (`@Component`)** | Functional Component returning JSX | `function ServiceCard({ service }: Props)` in `SpaPages.tsx` |
| **`@Input()`** | **Component Props** | `<ServiceCard service={s} index={i} />` |
| **`@Output()` / `EventEmitter`** | **Callback Props** | `<button onClick={() => setFilter('Massages')}>` |
| **`ngOnInit` / Lifecycle** | **`useEffect(() => { ... }, [])`** | `useEffect(() => { ... }, [dependencies])` |
| **Component State / Signals** | **`useState()`** | `const [date, setDate] = useState('')` |
| **`HttpClient` / RxJS** | **TanStack React Query** | `useListServices()`, `useGetAvailability()` |
| **`*ngIf`** | Logical AND (`&&`) or ternary (`? :`) | `{services.isLoading ? <LoadingBlock /> : <Grid />}` |
| **`*ngFor`** | Array `.map()` method | `{services.data.map(item => <Card key={item.id} />)}` |
| **Services / Dependency Injection** | **React Context & Custom Hooks** | `useLanguage()`, `useUser()`, `useClerk()` |
| **`RouterModule` / `<router-outlet>`** | **Wouter (`<Switch>`, `<Route>`)** | Inside `web/app/App.tsx` |
| **Route Guards (`CanActivate`)** | Conditional wrapper components | `<ProtectedManager>` in `web/app/App.tsx` |

---

## 5. Project Directory Structure

```text
├── .env                       # Environment variables (Database credentials, Clerk keys)
├── package.json               # Root monorepo workspace configuration
├── api/                       # Backend Package
│   ├── src/
│   │   ├── app.ts             # Express application & middleware (CORS, Clerk auth)
│   │   ├── routes/            # API endpoints (/api/public, /api/manager, /api/auth)
│   │   ├── db/                # Database connection & Drizzle ORM schema
│   │   │   ├── init-db.mjs    # Schema creation script
│   │   │   └── src/schema/    # Table schema definitions (PostgreSQL)
│   │   └── scripts/seed.ts    # Demo data seeder script
├── web/                       # Frontend Package (React 19 + Vite + Tailwind)
│   ├── app/
│   │   ├── App.tsx            # Main router, Clerk provider, and route definitions
│   │   └── index.css          # Tailwind CSS styling and theme definitions
│   ├── components/
│   │   ├── SpaPages.tsx       # Core pages (Home, Treatments, Booking, Confirmation, Manager)
│   │   ├── StaffManagementPanel.tsx # Staff accounts and permission management
│   │   └── ui/                # Radix UI and Shadcn components
│   └── lib/
│       ├── api-client-react/  # Generated React Query API hooks
│       └── i18n.tsx           # Multi-language support (English, French, Arabic)
```

---

## 6. Key Application Features

1. **Guest Booking (No account needed)**:
   - Guests can view treatments, check live time slot availability, and book appointments without signing in.
   - An idempotency mechanism prevents duplicate bookings.
2. **Guest Booking Management**:
   - Guests receive a link with a token to view or cancel their reservation self-service (`/booking/manage?token=...`).
3. **Manager & Admin Desk (`/manager`)**:
   - Protected by Clerk Authentication.
   - Operational dashboard for today's appointments and status tracking (`pending` -> `confirmed` -> `checked_in` -> `completed`).
   - Assigning therapists to specific bookings.
   - Managing treatments, staff schedules, and customer lists.
4. **Audit Trail (`/admin/audit-logs`)**:
   - Live audit history tracking actions taken by guests, customers, and staff.
