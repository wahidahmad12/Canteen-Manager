# Threat Model

## Project Overview

This is a full-stack React + Express application for DJ Hospitality’s daily expense, inventory, purchasing, payroll, attendance, and labour-compliance workflows. It stores sensitive employee, payroll, banking, attendance, and business records in TiDB/MySQL and uses cookie-backed sessions for authentication.

Production scope for this scan is the Express API, the bundled React client, server-side session handling, public kiosk routes, and database-backed business workflows. Development-only Vite middleware and mockup-only behavior are out of scope unless shown reachable in production.

## Assets

- **User accounts and sessions** — usernames, password hashes, session cookies, role and permission state. Compromise allows impersonation and access to business and HR data.
- **Employee identity and payroll records** — employee master records, Aadhaar/PAN/bank details, attendance, salary, overtime, fines, advances, leave records, and labour forms. Exposure would leak highly sensitive personal and financial data.
- **Attendance integrity** — kiosk attendance logs, employee biometric/WebAuthn bindings, and QR attendance flows. Tampering can directly affect payroll, compliance, and operational decisions.
- **Business finance records** — reports, cash seals, invoices, purchase orders, sales ledgers, and dashboards. Tampering affects accounting accuracy and vendor/client relationships.
- **Administrative secrets and control state** — session secret, admin account bootstrap credentials, admin PIN, and database credentials. Compromise gives broad control over the system.

## Trust Boundaries

- **Browser to API** — all client input is untrusted and must be authenticated, authorized, and validated server-side.
- **Authenticated user to admin boundary** — admin-only functions must not rely on frontend hiding or weak secondary checks.
- **Employee/self-service to broader staff boundary** — employee users should only see their own records; standard users should not automatically gain HR/payroll visibility.
- **Public kiosk to protected attendance systems** — kiosk endpoints are internet-reachable in production and must not expose employee rosters or allow forged attendance events.
- **API to database** — the server has direct access to all HR and finance records, so authorization mistakes at the API layer become full data exposure.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/storage.ts`
- **Highest-risk areas:** auth/session bootstrap, payroll/employee APIs, attendance and kiosk routes, admin bootstrap/defaults
- **Public surfaces:** `/api/auth/login`, `/api/auth/webauthn/login/*`, `/api/kiosk/*`, static client routes
- **Authenticated surfaces:** most `/api/*` business routes, especially employee/payroll/attendance endpoints
- **Admin surfaces:** user management, admin PIN, item/client/vendor configuration, payroll generation
- **Usually dev-only and lower priority:** `server/vite.ts`, client-only rendering code without security-sensitive sinks

## Threat Categories

### Spoofing

The application relies on cookie-backed sessions plus optional WebAuthn flows. Session secrets must be strong and deployment-specific, seeded accounts must not use known default credentials, and public attendance flows must not allow attackers to impersonate staff members.

### Tampering

Attendance, payroll, purchasing, and reporting records must only be writable by authorized roles for the correct client/employee scope. The server must not trust caller-supplied `clientName`, `employeeId`, or record IDs without confirming they belong to the authenticated actor.

### Information Disclosure

This system stores high-risk PII and payroll data, including bank details and government identifiers. APIs that return employee, salary, attendance, fine, advance, overtime, and leave records must enforce least privilege and tenant scoping server-side; broad "any logged-in user" access is not acceptable.

### Denial of Service

Authentication and public attendance endpoints should resist brute-force and abuse, especially routes that can be hit anonymously or with low-cost automated requests. Any public kiosk flow must be designed so misuse cannot disrupt payroll operations at scale.

### Elevation of Privilege

The main elevation risks are broken server-side authorization, default administrative credentials, and public endpoints that can trigger privileged business actions without equivalent trust checks. Admin-only capabilities and cross-client data access must be enforced in server route handlers and storage lookups, not only in the UI.
