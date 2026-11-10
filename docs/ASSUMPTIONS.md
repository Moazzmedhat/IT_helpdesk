# IT Help Desk System - Assumptions & Design Decisions

This document records all design choices and simplifications made where the requirements allow flexibility, adhering to the principle of choosing the simplest secure option without inventing unnecessary infrastructure.

## 1. Environment & Architecture
- **Architecture**: Modular monolith with Express, Prisma ORM, and PostgreSQL. Controller -> Service -> Repository layer pattern.
- **Port Allocation**: Server runs on port 3000 (configurable via `PORT`), Client runs on port 4200 (standard Angular development server) or served statically in production.
- **Local Database**: Native PostgreSQL on `localhost:5432` for local development/test execution, containerized in `docker-compose.yml` (`postgres:16-alpine`) for Dockerized environments.
- **Object Storage**: S3-compatible object storage via AWS S3 SDK with endpoint override for MinIO (`minio:9000` in Docker, configurable via `S3_ENDPOINT`). Fallback local filesystem driver implemented for development when MinIO is not running.
- **Audit Logging**: Append-only log table in PostgreSQL. Every security-relevant event (logins, role changes, user activation, claims, releases, status transitions, admin overrides, settings changes, file downloads) creates an immutable AuditLog record.

## 2. Authentication & Session Management
- **Auth Modes**:
  - `AUTH_MODE=dev`: Allows selecting a seeded user for rapid local development and testing. Strictly forbidden when `NODE_ENV=production` (server refuses to start).
  - `AUTH_MODE=oidc`: Standard OIDC authorization code flow with PKCE, compatible with Microsoft Entra ID. MFA is delegated to the IdP.
- **Session Handling**: Server-side session store backed by PostgreSQL. Session ID delivered in an `httpOnly`, `Secure` (in production/HTTPS), `SameSite=Lax` cookie. Idle timeout default 30 minutes, absolute timeout default 8 hours.
- **CSRF Protection**: Double-submit cookie or custom header `X-CSRF-Token` verified on all state-changing mutating requests (POST, PUT, PATCH, DELETE).

## 3. Roles & Permissions
- Three primary roles:
  - `EMPLOYEE`: Can only create tickets and view/interact with their own tickets. Cannot claim, reassign, release, or view internal notes.
  - `TECHNICIAN`: Can view all tickets in shared queue, claim tickets atomically, update status of owned tickets, add public comments & internal notes, release owned tickets with reason.
  - `ADMIN`: Full oversight, force transitions (audited), reassign tickets, manage master data (users, departments, branches, categories, settings), access reports and audit logs.
- Internal notes (`visibility: INTERNAL`) are strictly excluded in database queries when the requesting user is an `EMPLOYEE`.

## 4. Ticket Lifecycle & Atomic Claiming
- Statuses: `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`, `REOPENED`.
- Atomic claim query enforces single-step claim:
  `UPDATE "Ticket" SET "assignedToId" = $1, "status" = 'IN_PROGRESS', "claimedAt" = NOW(), "version" = "version" + 1, "updatedAt" = NOW() WHERE "id" = $2 AND "assignedToId" IS NULL AND "status" IN ('OPEN', 'REOPENED')`
- Zero affected rows triggers HTTP 409 Conflict.
- Auto-close default is 3 days for `RESOLVED` tickets (configurable in `Settings`).
- Reopen window default is 7 days from `resolvedAt` (configurable in `Settings`).
- Ticket number format: `IT-YYYY-NNNNN` generated atomically via PostgreSQL `YearSequence` table counter.

## 5. Security & Sensitive Data Guard
- Inputs validated using Zod schemas at controller boundary.
- Sensitive Data Guard regex checks inputs for:
  - Credit/debit card numbers (Luhn algorithm validation).
  - Obvious plaintext passwords/secrets.
- File upload restrictions:
  - Magic byte verification using `file-type` buffer inspection.
  - Allowed MIME types: images (`image/png`, `image/jpeg`), documents (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), plain text/logs (`text/plain`).
  - Size limit: 10MB per file, maximum 5 files per ticket.
