# DJ KPF Delay Cash Expanse

## Overview

A daily expense reporting application for DJ KPF. Users create one report per day that tracks an opening balance, received amount, and line-item expenses (both "fixed" items like common ingredients and dynamic "vegetable" items). The app calculates totals in real-time (qty × rate = amount) and provides a dashboard listing all reports.

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
  - `/` — Dashboard listing all reports
  - `/new` — Create new report form (pre-populated with default fixed items)
  - `/report/:id` — Edit existing report

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
  - `daily_reports` — One row per day (date is unique). Stores opening balance and received amount
  - `expense_items` — Line items belonging to a report. Has category ('fixed' or 'vegetable'), description, UOM, qty, rate, amount. Cascade deletes with parent report
  - `vegetable_items` — Lookup table of predefined vegetable names for selection dropdowns
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class, abstracting all DB operations

### Key Design Decisions
1. **Shared schemas between client and server** — Zod schemas derived from Drizzle tables ensure type safety across the full stack without duplication
2. **One report per day constraint** — Enforced at the database level with a unique constraint on the date column
3. **Pre-populated fixed items** — When creating a new report, the form pre-fills a default set of common canteen items (ginger, garlic, tomato, etc.) that are editable
4. **Real-time calculations** — The frontend computes `amount = qty × rate` in real-time as the user types, before submission
5. **Cascade deletes** — Deleting a report automatically removes all its expense items via foreign key cascade

## External Dependencies

- **PostgreSQL** — Primary database, connected via `DATABASE_URL` environment variable. Required for the app to start
- **Google Fonts** — Loads Inter, DM Sans, Fira Code, Geist Mono, and Architects Daughter font families from Google Fonts CDN
- **No authentication** — The app currently has no auth mechanism; all endpoints are publicly accessible
- **connect-pg-simple** — Listed as a dependency (for session storage) but no session/auth system is actively implemented