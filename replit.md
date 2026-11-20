# DJ KPF Daily Cash Expance

## Overview

DJ KPF Daily Cash Expance is a comprehensive web application designed for managing daily expenses and various operational aspects for DJ KPF. It supports multi-user authentication and features daily expense reporting, cash seal tracking, daily inventory management, a menu manager for lunch schedules, and an extensive salary and payroll management system. The payroll system includes employee master data, attendance tracking (Muster Roll), salary registers, wage slips, and generation of Indian government labour forms (Form XIII–XXIII). Additionally, it handles bonus returns, half-yearly returns, leave with wages, EPFO/ESIC exports, letterhead generation, professional tax reports, contract work notices (Form VI-A), sales invoice ledger entries, purchase orders, and a sales dashboard for billing and payment tracking. The project aims to streamline financial and HR operations, ensuring compliance and efficient record-keeping.

## User Preferences

Preferred communication style: Simple, everyday language.

Letterhead: Whenever printing or generating any letter/document that needs a letterhead, always use the official company letterhead from `attached_assets/Letter_Hade_1785480466712.pdf` (DJ Hospitality & Facility Management Pvt Ltd — header with logo, contact details, orange rule, faded "dj" watermark). Overlay letter content onto this PDF page so the format stays exactly the same.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Lightweight client-side routing using Wouter.
- **State/Data Management**: TanStack React Query for server state and data fetching.
- **Forms**: React Hook Form with Zod for validation and `useFieldArray` for dynamic form elements.
- **UI Components**: `shadcn/ui` (new-york style) built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables for theming, supporting light/dark modes.
- **Key Features**:
  - Dashboard with Expense Reports, Cash Seal, and Daily Inventory.
  - Forms for creating and editing reports, pre-populated with fixed items.
  - Dedicated pages for Cash Seal income/expense, Daily Inventory (Kitchen Stock + Biscuits).
  - Menu Manager for 2-week lunch schedules with client selection.
  - PIN-protected Admin panel for master data management (items, vendors, clients, users).
  - Vendor Payment Report with filtering, grouping, and export options (PDF/Excel).
  - Comprehensive Employee Management: CRUD for Employee Master, Muster Roll (attendance tracking with Excel export), Salary Register (auto-generated, Excel export), Wage Slips (printable).
  - Government Labour Forms: Registers for Fines (XXI), Advances (XXII), Overtime (XXIII), Damage/Loss (XX), Workmen Register (XIII), Employment Card (XIV), Service Certificate (XV), Bonus Returns (Form C & D), Half-Yearly Return (Form XXIV), Register of Leave With Wages (Form No. 15).
  - EPFO & ESIC Excel exports with client and month/year filters.
  - Letterhead Letters: Compose and save letters with auto-generated reference numbers.
  - Professional Tax Report: Client-wise employee breakdown with print/Excel export.
  - Form VI-A: Notice of Commencement/Completion of Contract Work.
  - Sales Invoice Ledger Entry: CRUD operations, client/month/year filters, inline editing, and a "Pankaj Report" tab for client-specific monthly data.
  - Sales Dashboard: Visualizations for billing, received payments, payment status, and pending payments.
  - Purchase Invoice: Auto-generated DJ Invoice No (DJ001, DJ002…), partial payment tracking with date + amount per payment, payment progress bar, Paid/Partial/Unpaid status. Dashboard shows DJ No, Grand Total, Paid, Balance, Status columns.
  - Date Entry Tab: Multi-client date entry with sub-tabs for UBL (Snack/Lunch), Unichem (Snack/Lunch), Cipla, and HUL (Hindustan Unilever Limited). HUL tab supports KPF/TEC location selector, full-month scaffold with Meal Charges (Breakfast/Lunch/Evening Snacks/Night Snacks) and Guest Meal Charges, mobile card view + desktop table view, per-row Save/Delete, Save All, Print, and Excel export.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (run via `tsx`).
- **Architecture**: Single Express server serving both API and static frontend files.
- **API Pattern**: RESTful JSON API under `/api/` using Zod schemas for validation and typing.
- **Development**: Vite dev server integrated as Express middleware for HMR.
- **Production**: Client built to `dist/public/`, server bundled to `dist/index.cjs` with esbuild.
- **WhatsApp expense slips**: Configure `WHATSAPP_REPORT_SENDER` as the sender's full WhatsApp JID (for example `919876543210@s.whatsapp.net`) and set `GEMINI_API_KEY` or `OPENAI_API_KEY` on the backend. Sign in as an admin on the backend origin and open `/api/whatsapp/qr` to link a device. The backend must stay running to receive images. Keep `whatsapp_auth_session/` private and persist it across restarts; otherwise the device must be linked again.
- **Grocery Scan**: Set `GEMINI_API_KEY` or `OPENAI_API_KEY` on the backend. Gemini takes precedence if both are set; a legacy Gemini key stored in `OPENAI_API_KEY` is also supported.
- When Gemini returns 503 for `gemini-3.8-flash`, WhatsApp slip and grocery extraction retry with `gemini-3.1-flash-lite`; the alternate model may have different pricing and extraction accuracy. Other errors are reported without a model retry.
- On the Daily Cash Expance form, admins can open the WhatsApp QR page or fetch the latest available sender image. Images are not saved as reports automatically: Fetch displays the extracted item names and an editable report preview, which must be reviewed and saved within 10 minutes. Saving asks for confirmation before replacing an existing report. Older images are available only if WhatsApp synchronizes them to the bot or they were received and cached; if no image is available, resend it. The cached image metadata is stored alongside the private WhatsApp session.

### Shared Code
- **Schema Management**: `shared/schema.ts` defines Drizzle ORM table definitions and Zod schemas, acting as a single source of truth for database structure and validation.
- **Route Definitions**: `shared/routes.ts` defines API routes with paths, methods, and Zod schemas for input/output, ensuring type safety across the stack.

### Data Storage
- **Database**: MySQL (TiDB Cloud Serverless) using `TIDB_DATABASE_URL` with SSL.
- **ORM**: Drizzle ORM with `mysql2` driver.
- **Schema Design**: Tables for daily reports, expense items, cash seals, daily inventory, kitchen stock, biscuits, admin settings, purchase requests, vendors, purchase invoices, users, employees, attendance, salary records, various labour registers (fines, advances, overtime, damage deductions, leave with wages), employee wage rates, skill wage rates, half-yearly returns, bonus returns, letters, purchase orders, sales invoices, and pankaj reports.
- **Key Design Decisions**:
  - Shared Zod schemas between client and server for type safety.
  - Database-level unique constraint for one report per day.
  - Pre-population of fixed items in new report forms.
  - Real-time frontend calculations for amounts.
  - Cascade deletes for related data (e.g., expense items with reports).

## External Dependencies

- **TiDB Cloud**: Primary MySQL-compatible database.
- **Google Fonts**: Inter, DM Sans, Fira Code, Geist Mono, and Architects Daughter.
- **Authentication**: Session-based authentication with bcrypt password hashing. Supports "Work User" (manual creation) and "Employee User" (auto-created from Employee Master). Default admin credentials provided.
- **Session Storage**: MySQL-backed sessions via `express-mysql-session` with a 30-day cookie lifetime.
- **Access Control**: Role-based access with "admin" (full access), "user" (standard operations), and "employee" (self-service dashboard) roles. Permissions (`expense`, `cashseal`, `inventory`, `menu`, `purchase`, `labour`) control feature visibility.
- **Route Protection**: All API routes require authentication; admin-specific routes use `requireAdmin` middleware.