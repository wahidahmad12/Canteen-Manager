# DJ KPF Daily Cash Expance

## Overview

A daily expense reporting application for DJ KPF with multi-user authentication. Admin creates user accounts grouped by client name. Features include daily expense reports, Cash Seal tracking, daily inventory management, Menu Manager with 2-week lunch schedules, and a Salary & Payroll Management system with Employee Master, Muster Roll (attendance), Salary Register, Wage Slips, and Indian government labour form registers (Form XIII–XXIII).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **Forms**: React Hook Form with Zod resolver for validation, useFieldArray for dynamic line items
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Key Pages**:
  - `/` — Dashboard listing all reports with tabs (Expense Reports, Cash Seal, Daily Inventory)
  - `/new` — Create new report form (pre-populated with default fixed items, Other Item Purchase section with Item Master dropdown for non-vegetable items, Vegetable Purchase section for vegetable items)
  - `/report/:id` — Edit existing report
  - `/cash-seal` — Cash Seal KPF income/expense tracking
  - `/inventory` — Daily Inventory (Kitchen Stock + Biscuits)
  - `/menu` — Menu Manager (2-week lunch menu schedule with client selection)
  - `/admin` — PIN-protected admin panel for Item Master management, vendor/client/user management
  - `/vendor-report` — Vendor Payment Report with date filters, vendor/client filters, group by vendor/client, summary cards, PDF export, Excel export (admin only)
  - `/employee-master` — Employee Master CRUD (admin only) with all worker details, government IDs, bank info
  - `/muster-roll` — Muster Roll (Form XVI) monthly attendance grid with day-by-day P/A/H/WO/PH/CL/SL/EL tracking, Excel export with color-coded attendance cells
  - `/salary` — Salary Register (Form XVII) with auto-generation from attendance, summary cards, Excel export with all 35 columns
  - `/salary/:id/slip` — Wage Slip (Form XIX) printable individual pay slip
  - `/registers` — Combined registers page with tabs for Fines (XXI), Advances (XXII), Overtime (XXIII), Damage/Loss (XX)
  - `/form-xiii` — Workmen Register (Form XIII) printable list of workers by company
  - `/form-xiv/:id` — Employment Card (Form XIV) individual worker card
  - `/bonus-return` — Bonus Return with tabs: Form C (client-wise annual bonus calculation at 8.33% of gross salary) and Form D (Annual Return summary per Payment of Bonus Act rule 5, with editable fields for nature of industry, settlement, percentage, paid-to-all status, remarks)
  - `/half-yearly-return` — Half-Yearly Return (Form XXIV) Rule 82(1) with cover letter and form, auto-calculated from salary records, separate print buttons for cover letter (A4 portrait) and Form XXIV (A4 portrait)
  - `/leave-with-wages` — Register of Leave With Wages (Form No. 15) per employee, government format print (A3 landscape), CRUD for yearly leave records

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **Architecture**: Single Express server that serves both the API and the built frontend static files
- **API Pattern**: RESTful JSON API under `/api/` prefix. Route definitions live in `shared/routes.ts` with Zod schemas for input validation and response typing
- **Development**: Vite dev server runs as Express middleware with HMR via `server/vite.ts`
- **Production Build**: Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`

### Shared Code (`shared/`)
- **`schema.ts`**: Drizzle ORM table definitions, relations, and Zod schemas (via drizzle-zod). This is the single source of truth for both database structure and validation
- **`routes.ts`**: API route definitions with paths, methods, input/output Zod schemas. Used by both server (for validation) and client (for type-safe fetching)

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with node-postgres driver
- **Schema Push**: `npm run db:push` uses drizzle-kit to push schema changes directly (no migration files needed for development)
- **Tables**:
  - `daily_reports` — One row per day (date is unique). Stores opening balance, received amount, auto-incrementing reportNumber
  - `expense_items` — Line items belonging to a report. Has category ('fixed' or 'vegetable'), description, UOM, qty, rate, amount. Cascade deletes with parent report
  - `vegetable_items` — Legacy lookup table of predefined vegetable names (superseded by item_master)
  - `item_master` — Unified item catalog with itemName (unique), uom, rate, hsnCode, gstPercent, itemType (purchase/sales/both), itemCategory (General/Vegetable/Fruit/Grocery/Spice & Masala/Dry Fruit/Sauce & Condiment/Snack & Ready Food/Non-Veg). Used for dropdowns in expense reports (Vegetable category items show in Vegetable Purchase), purchase requests (purchase items), and purchase invoices (purchase items with GST auto-fill)
  - `cash_seals` — Daily cash seal income/expense records with auto-incrementing serialNumber. Linked to daily_reports via reportId
  - `daily_inventory` — Daily inventory records with auto-incrementing serialNumber
  - `kitchen_stock_items` — Kitchen stock line items (Banana, Dahi, Chicken, Fish, Eggs) linked to daily_inventory
  - `biscuit_items` — Biscuit inventory items linked to daily_inventory
  - `admin_settings` — Stores admin PIN for access control (default: 1234)
  - `purchase_requests` — Purchase request headers with serialNumber, clientName, date, status (pending/approved/rejected)
  - `purchase_request_items` — Line items for purchase requests: itemName, uom, qty, requestQty, approved flag. Cascade deletes with parent
  - `vendors` — Vendor names (unique) for purchase invoice selection
  - `purchase_invoices` — Purchase invoice headers with serialNumber, purchaseRequestId (optional link), clientName, vendorName, vendorInvoiceNo, date, totalAmount, totalGst, grandTotal, paymentGiven (boolean), createdBy
  - `purchase_invoice_items` — Invoice line items: itemName, uom, qty, unitPrice, totalPrice, gstRate, gstAmount, netAmount. Cascade deletes with parent invoice
  - `users` — User accounts with username (unique), passwordHash (bcrypt), displayName, role (admin/user), clientName (nullable), isActive flag
  - `employees` — Employee Master with employeeCode (unique), name, fatherName, designation, department, clientName, government IDs (ESIC, PF, UAN, Aadhaar, PAN), bank details, dailyRate, fixedHra (monthly HRA amount), permanentAddress, localAddress, skills, joiningDate, leavingDate, isActive
  - `attendance` — Monthly attendance records with day1-day31 columns (P/A/H/WO/PH/CL/SL/EL), unique on (employeeId, month, year)
  - `salary_records` — Monthly salary with basicWage, DA, HRA, gross, PF/ESIC/PT deductions, netPay, overtime. Unique on (employeeId, month, year)
  - `fines` — Fine register (Form XXI) linked to employees
  - `advances` — Advance register (Form XXII) linked to employees
  - `overtime_register` — Overtime register (Form XXIII) linked to employees
  - `damage_deductions` — Damage/Loss register (Form XX) linked to employees
  - `leave_with_wages` — Register of Leave With Wages (Form No. 15, Rule 88 WB Factories Rule 1958) per employee per calendar year, tracking leave earned, brought forward, absences, days worked, leave allowed, wages rate/amount, payment date
  - `employee_wage_rates` — Year-wise daily wage rates per employee (since wages change ~twice yearly). Used by Leave Register to pull correct rate for each year. Falls back to Employee Master dailyRate if no year-wise rate is set
  - `skill_wage_rates` — Skill-category-wise daily wage rates by month and year (Unskilled, Semi Skilled, Skilled, High Skilled). Primary source for salary generation and leave wage calculations. Falls back to Employee Master dailyRate if no skill rate is set for that month/year
  - `half_yearly_returns` — Saved Half-Yearly Return (Form XXIV) data per client/half/year. Stores all form fields (contract dates, days worked, LWF, facilities, licence no, etc.) so users can retrieve previously entered data
  - `bonus_returns` — Saved Bonus Return data per client/FY year. Stores Form C fields (bonusDate, workingDays, refNumber, letterDate) and Form D fields (formDNatureOfIndustry, formDEmployerName, formDSettlement, formDPercentage, formDPaidToAll, formDRemarks, formDPaymentDate)
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class, abstracting all DB operations

### Key Design Decisions
1. **Shared schemas between client and server** — Zod schemas derived from Drizzle tables ensure type safety across the full stack without duplication
2. **One report per day constraint** — Enforced at the database level with a unique constraint on the date column
3. **Pre-populated fixed items** — When creating a new report, the form pre-fills a default set of common canteen items (ginger, garlic, tomato, etc.) that are editable
4. **Real-time calculations** — The frontend computes `amount = qty × rate` in real-time as the user types, before submission
5. **Cascade deletes** — Deleting a report automatically removes all its expense items via foreign key cascade

## External Dependencies

- **PostgreSQL** — Primary database hosted on **Google Cloud SQL** (PostgreSQL 16). Connected via `GOOGLE_DATABASE_URL` environment variable (falls back to `DATABASE_URL` if not set). SSL is enabled with `rejectUnauthorized: false` for Google Cloud. The database name is `djpkf` on host `34.100.151.246`
- **Google Fonts** — Loads Inter, DM Sans, Fira Code, Geist Mono, and Architects Daughter font families from Google Fonts CDN
- **Authentication** — Session-based auth with bcrypt password hashing. Two types of user creation: (1) Work User — manual username/password/role, (2) Employee User — auto-created from Employee Master with mobile as username, password=name[0:3].lower()+"@"+mobile[-4:], role="employee", linked via employeeId. Default admin: username "admin", password "admin123"
- **Session Storage** — PostgreSQL-backed sessions via connect-pg-simple with 30-day cookie lifetime
- **Role-based Access** — "admin" role for full access; "user" role for standard operations; "employee" role for self-service dashboard (view own attendance, salary, print wage slip)
- **Permissions** — Available permissions: expense, cashseal, inventory, menu, purchase, labour. Dashboard tabs and navigation are filtered based on user permissions.
- **Route Protection** — All API routes require authentication; admin-only routes use requireAdmin middleware. Frontend gates /admin route to admin users only