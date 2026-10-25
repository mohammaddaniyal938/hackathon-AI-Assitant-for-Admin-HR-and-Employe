# HCM Lite

HCM Lite is a Next.js App Router frontend backed by an Express/Mongoose API. It provides JWT authentication, role-based authorization, a MongoDB employee directory, attendance, leave requests and approvals, payroll drafts/review/finalization, organization settings, and audit events.

## Stack and structure

- Frontend: Next.js, React, TypeScript, Tailwind CSS, React Query, Axios.
- Backend: Express (ES modules), MongoDB/Mongoose, JWT, bcryptjs.
- The existing MongoDB database and `User` collection remain in place. The employee directory uses the same `User` model as registration and login.

```text
frontend/src/app/       App Router pages
frontend/src/context/   Client authentication context
backend/src/config/     Environment loading, database, safe development seeds
backend/src/controllers/ Authentication and HR workflows
backend/src/models/     Mongoose models
backend/src/middlewares/ JWT authentication and role authorization
backend/src/routes/     API route definitions
```

## Requirements

- Node.js 18 or newer.
- MongoDB available at the configured URI.
- npm.

## Setup

Run these commands from PowerShell in the project root:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
npm --prefix backend install
npm --prefix frontend install
```

Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in `backend\.env` to different random values, each at least 32 characters. For example, generate a value without printing any existing configuration:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The backend loads `backend\.env` by path relative to its own source, before route modules load. It exits with a clear startup configuration error if either JWT secret is missing, a placeholder, too short, or identical to the other secret. Keep real values only in the ignored local `.env` file; never put them in source control.

| Variable | Purpose | Default |
| --- | --- | --- |
| `MONGO_URI` | MongoDB connection | `mongodb://localhost:27017/hackathon-starter` |
| `JWT_SECRET` | Access-token signing and verification | Required |
| `JWT_REFRESH_SECRET` | Refresh-token signing and verification | Required; distinct from access secret |
| `PORT` | Express port | `5001` |
| `CLIENT_ORIGIN` | Allowed browser origin | `http://localhost:3000` |
| `GROQ_API_KEY` | Server-side Groq API key for authenticated AI chat | Empty; chat returns 503 until configured |
| `GROQ_MODEL` | Groq chat model identifier; choose a model available to your Groq account | `qwen/qwen3.8-27b` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional initial Admin bootstrap; creates an Admin only if no Admin already exists | Empty |
| `SEED_DEMO_USERS` | Enable missing demo-account seeding in development | `true` |

`frontend\.env` contains `NEXT_PUBLIC_API_URL=http://localhost:5001/api`. It is a public API URL, not a secret.
To enable the floating HCM AI Assistant, add your Groq key to `GROQ_API_KEY` in the backend-only `backend\.env` file and restart the backend. Never put it in a `NEXT_PUBLIC_*` variable or frontend file. The assistant receives the signed-in user's role and bounded chat messages only; it does not query or change MongoDB records. Credential-like messages are rejected before being sent to Groq.

## Run

Start two PowerShell terminals from the project root:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

- Frontend: <http://localhost:3000>
- API health: <http://localhost:5001/api/health>

## Authentication and roles

Access tokens are sent as `Authorization: Bearer <token>`. The backend validates the JWT and loads the current user/role from MongoDB for every protected request. Unauthorized requests return 401; insufficient role permissions return 403. Inactive accounts cannot sign in or use protected APIs.

Registration and newly provisioned accounts are required to change their initial password before accessing protected business APIs. Password changes require the current password and a new password of at least 12 characters.

For non-production environments, the backend idempotently creates only missing demo accounts using the existing Mongoose `User` model and bcrypt password hook. Existing demo or registered accounts are not modified. Demo accounts are disabled in production. Demo credentials:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@company.com` | `Admin123!` |
| HR | `hr@company.com` | `Hr12345!` |
| Employee | `employee@company.com` | `Employee123!` |

These publicly documented demo credentials are for local development only. Do not use them in production.
Admin/HR supply a 12-character-or-longer initial password when creating an employee. It is never returned in the API response or written to logs; share it with the employee out of band.

## Implemented routes

### Frontend pages

| Route | Access |
| --- | --- |
| `/` | Public landing page |
| `/login`, `/register` | Public authentication |
| `/change-password` | Authenticated; required for initial-password accounts |
| `/dashboard` | Authenticated, role-specific data |
| `/employees`, `/employees/[id]` | Admin/HR directory; employees can view/update only permitted fields on their own profile |
| `/attendance` | Employees manage their own attendance; HR manage personal attendance; Admin/HR view employee attendance and review corrections |
| `/leaves` | Employees apply/cancel and view their own balance; Admin/HR review requests |
| `/payroll` | Employees see their own finalized payslips; Admin/HR prepare and review runs; Admin finalizes/locks |
| `/reports` | Admin/HR-only live headcount, attendance, leave, and payroll reports with CSV export |
| `/settings` | Admin can update organization settings; HR can view them |

### API routes

All routes are under `/api`. Protected routes require a bearer access token.

| Prefix | Implemented operations |
| --- | --- |
| `/auth` | Register, login, refresh, logout, current user, change password |
| `/dashboard` | Role-filtered live MongoDB summary |
| `/employees` | Search, filters, sorting, pagination, create, profile read/update, activate/deactivate |
| `/attendance` | Own/history listing, server-timestamp check-in/out, overview, date-range trends, correction request/review |
| `/assistant` | Authenticated provider status and role-aware Groq chat; does not access database records |
| `/leaves` | Requests, balances, apply/cancel, Admin/HR review |
| `/payroll` | Monthly draft, HR review, Admin finalize/lock, employee-owned finalized payslips |
| `/settings` | Organization/work/leave/payroll settings and Admin audit history |

## Data rules and current limitations

- The application does not reset or delete the configured database. Development seeding skips existing accounts.
- Attendance uses the configured organization timezone, office start, grace period, weekends, and holiday list.
- HR check-in/out and history use the same attendance collection and unique user/work-date index, but HR self-service endpoints derive the user from the verified session. HR self-records are excluded from employee-only attendance totals and trends.
- Leave dates and quotas use configurable organization settings; overlapping pending/approved requests are rejected.
- Payroll runs can only be created for a closed month. Salary components are illustrative and configurable; no tax/statutory calculations are fabricated.
- Payslip printing uses the browser print dialog (`Print / Save as PDF`).
- The floating HCM AI Assistant uses Groq when configured. It provides role-aware product guidance only, does not access live records, and reports an unavailable state when `GROQ_API_KEY` is missing. Dashboard organization insights remain data summaries, not AI-generated output.
- CSV employee import validates a preview, flags duplicates, and requests an initial password per row (never from the CSV); exports respect the current employee filters. Department/designation lists are configurable, but reporting-manager relationships are not enforced.
- Notifications/announcements, advanced analytics, and a dedicated payroll correction workflow are not yet implemented. The reports page provides current headcount, attendance summaries, leave statuses, payroll periods, and attendance trends from stored records.
- Document uploads, mobile camera/location attendance, and time-clock overnight shifts are not provided by the current architecture.

## Validation

```powershell
npm --prefix backend run dev
npm --prefix frontend run lint
npm --prefix frontend run build
```
