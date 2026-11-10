# Enterprise IT Help Desk & Ticketing System

A production-grade, modular-monolith internal IT Help Desk and Ticketing platform engineered for high-security financial institutions and currency exchange operations.

Built with **security, auditability, and concurrency safety** as core first-class principles.

---

## 🌟 Key Features & Capabilities

- **Strict Multi-Role Access Control (RBAC)**: Distinct workflows for **Employees**, **IT Technicians**, and **Administrators**.
- **Atomic Claiming Engine**: Guaranteed zero-race-condition claiming mechanism using PostgreSQL single-statement conditional updates with affected row count feedback; 409 Conflict returned if another technician claims concurrently.
- **Strict Data Isolation**:
  - Employee isolation: Employees can never query or view other employees' tickets (returns 404).
  - Internal notes (`visibility: INTERNAL`): Never leak to employees via REST APIs, WebSocket events, or notifications.
- **Sensitive Financial Data Guard**: Real-time server-side scanning rejecting payment card numbers (validated via Luhn algorithm) and plaintext credentials/secrets before persistence.
- **Secure File Storage**: S3-compatible private object storage (MinIO / AWS S3) with magic byte validation (preventing extension spoofing), virus scanning interface (EICAR detection), and short-lived signed URLs for download.
- **Real-Time Live Updates**: Authenticated Socket.IO with cookie-based handshake, role-segregated queues (`role:TECHNICIAN`), and isolated user rooms (`user:{id}`).
- **Comprehensive Audit Trail**: Append-only audit logs recording every login, status transition, ticket claim, release, override, setting change, and file download.
- **Automated Lifecycle Management**: Background jobs for scheduled auto-closing of resolved tickets and configurable reopen windows.
- **Zero Mock Data in Frontend**: Every button, form, filter, tab, and metric links directly to real backend APIs.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 18 (Standalone components, TypeScript Strict), Tailwind CSS, Reactive Forms, RxJS |
| **Backend** | Node.js 20 LTS, Express, TypeScript Strict, Zod schema validation |
| **Database** | PostgreSQL 16 with Prisma ORM (parameterized queries, migrations & seed scripts) |
| **Realtime** | Socket.IO (Authenticated handshake, role/user rooms) |
| **Object Storage**| S3-compatible private object storage (MinIO locally / AWS S3 in production) |
| **Authentication**| Microsoft Entra ID compatible OIDC (PKCE code flow) + Dev Mode for local testing |
| **Testing** | Jest + Supertest with real PostgreSQL transactions and parallel race condition suites |

---

## 👥 Role Permissions Matrix

| Action | Employee | Technician | Admin |
|---|:---:|:---:|:---:|
| **Create Ticket** | ✅ Yes | ❌ No | ❌ No |
| **View Tickets** | Own only | All (Shared Queue) | All (Global Oversight) |
| **Claim Ticket** | ❌ No | ✅ Yes (Atomic) | ❌ No |
| **Change Status** | Reopen own resolved (within window) | Only on owned tickets | ✅ Force transitions (audited) |
| **Public Comments** | Own tickets | Any ticket | Any ticket |
| **Internal Notes** | ❌ Never visible | ✅ Yes | ✅ Yes |
| **Release Ticket** | ❌ No | Own tickets (reason required) | ✅ Yes (reason required) |
| **Reassign Ticket** | ❌ No | ❌ No | ✅ Yes (audited) |
| **Master Data Management** | ❌ No | ❌ No | ✅ Yes (Users, Depts, Branches, Settings) |
| **Reports & Audit Logs** | ❌ No | Own workload metrics | ✅ Global reports & audit logs |

---

## ⚡ Quick Start & Local Setup

### Option 1: Docker Compose (Full Stack)

Ensure Docker Desktop is running on your machine:

```bash
# Clone the repository
git clone <repo-url>
cd first_exchange

# Start all services (PostgreSQL, MinIO, Backend Server, and Angular Client)
docker compose up --build
```

- **Frontend Client**: [http://localhost:4200](http://localhost:4200)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

---

### Option 2: Local Development Mode

#### 1. Start PostgreSQL
Ensure PostgreSQL is running locally on port 5432 with database `helpdesk`.

#### 2. Backend Setup
```bash
cd server

# Install dependencies
npm install

# Generate Prisma Client & Run Migrations
npx prisma db push
npm run prisma:seed

# Start backend dev server
npm run dev
```
The backend starts at [http://localhost:3000](http://localhost:3000).

#### 3. Frontend Setup
```bash
cd client

# Install dependencies
npm install

# Start Angular development server
npm start
```
The frontend starts at [http://localhost:4200](http://localhost:4200).

---

## 🔑 Pre-Seeded Personas & Dev Auth

When running in `AUTH_MODE=dev`, the top navigation bar includes an **Identity Switcher** allowing instant switching between pre-seeded personas:

| Persona | Role | Department | Email |
|---|---|---|---|
| **Sarah Chen** | `ADMIN` | IT Infrastructure | `sarah.chen@exchange.internal` |
| **Marcus Brody** | `TECHNICIAN` | IT Support Tier 2 | `marcus.brody@exchange.internal` |
| **Elena Rostova** | `TECHNICIAN` | IT Support Tier 1 | `elena.rostova@exchange.internal` |
| **David Kim** | `TECHNICIAN` | Network & Security | `david.kim@exchange.internal` |
| **Alex Rivera** | `EMPLOYEE` | Foreign FX Trading | `alex.rivera@exchange.internal` |
| **Jessica Taylor** | `EMPLOYEE` | Compliance & AML | `jessica.taylor@exchange.internal` |
| **Michael Chang** | `EMPLOYEE` | Retail Operations | `michael.chang@exchange.internal` |

> [!IMPORTANT]
> The server strictly refuses to start with `AUTH_MODE=dev` when `NODE_ENV=production`. In production, standard OIDC authorization code flow with PKCE is enforced.

---

## 🧪 Automated Testing & Verification

The backend test suite runs against real PostgreSQL transactions to verify data isolation, security filters, and concurrency:

```bash
cd server
npm test
```

### Key Test Suites:
1. **Critical Concurrent Claim Test (`stage4-concurrent-claim.test.ts`)**:
   Fires **20 simultaneous parallel claim requests** from 20 different technicians at a single open ticket. Exactly 1 technician succeeds (HTTP 200), exactly 19 receive HTTP 409 Conflict, and exactly 1 claim entry is recorded in the ticket history.
2. **Employee Isolation Test (`stage4-state-machine.test.ts`)**:
   Verifies that an employee requesting another employee's ticket receives an immediate HTTP 404.
3. **Internal Notes Privacy Test (`stage5-comments-attachments.test.ts`)**:
   Verifies that staff internal notes are completely stripped from employee queries and notifications.
4. **End-to-End Enterprise Lifecycle Test (`stage9-e2e-lifecycle.test.ts`)**:
   Executes the entire lifecycle flow: Ticket Creation -> Shared Queue -> Claim -> Internal Note -> Public Reply -> Resolve -> Employee Confirmation Close.

---

## 📚 Documentation Index

- [Architecture & Technical Design](file:///e:/first_exhange/docs/ARCHITECTURE.md) - Deep dive into database schemas, concurrency locking, and security layers.
- [Production Deployment Runbook](file:///e:/first_exhange/docs/DEPLOYMENT.md) - TLS termination, NGINX proxy, secret management, daily backups, and Point-in-Time Recovery (PITR).
- [Assumptions & Design Decisions](file:///e:/first_exhange/docs/ASSUMPTIONS.md) - Record of engineering choices and security constraints.
