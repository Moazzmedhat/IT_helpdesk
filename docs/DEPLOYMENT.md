# Production Deployment & Operational Runbook

This guide outlines production hardening, TLS configuration, secrets management, database backup and Point-in-Time Recovery (PITR) procedures, and private object storage configuration for the **Global Exchange IT Help Desk and Ticketing System**.

---

## 1. Production Architecture Overview

In production, the system runs with strict network isolation and defense in depth:
- **Public Edge**: NGINX Reverse Proxy terminating TLS with Let's Encrypt / Enterprise PKI certificates.
- **Application Services**: Node.js backend running in production mode (`NODE_ENV=production`, `AUTH_MODE=oidc`).
- **Web Frontend**: Angular production bundle served via NGINX or enterprise CDN.
- **Relational Storage**: PostgreSQL 16 managed instance (e.g., AWS RDS, Azure Database for PostgreSQL, or hardened HA cluster).
- **Private Object Storage**: S3-compatible private storage (AWS S3 or MinIO Enterprise) with public access completely blocked.

```
 Internet (Employees & IT Techs)
            │
            ▼ HTTPS:443 / WSS:443
   ┌──────────────────┐
   │  NGINX / Envoy   │ (TLS Termination, Rate Limiting, HTTP/2)
   └────────┬─────────┘
            ├──────────────────────┬──────────────────────┐
            ▼                      ▼                      ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ Angular Static   │   │ Express REST API │   │ Socket.IO Server │
   │ Assets (/usr/    │   │ (/api/*)         │   │ (/socket.io/*)   │
   │ share/nginx/html)│   │ Node.js 20 LTS   │   │ Node.js 20 LTS   │
   └──────────────────┘   └────────┬─────────┘   └────────┬─────────┘
                                   │                      │
                                   ├──────────────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │ PostgreSQL 16 (HA + WAL-G)    │
                   └───────────────────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │ AWS S3 / Private MinIO        │
                   │ (Signed URLs Only, BlockPub)  │
                   └───────────────────────────────┘
```

---

## 2. Production TLS Setup & NGINX Reverse Proxy

### 2.1 TLS Certificate Provisioning
Use Certbot with Let's Encrypt for public domains, or an internal enterprise CA for intranet-only currency exchange environments:

```bash
# Install Certbot and NGINX plugin
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Obtain and configure certificate
sudo certbot --nginx -d helpdesk.internal.exchange.com
```

### 2.2 Hardened NGINX Configuration (`/etc/nginx/sites-available/helpdesk.conf`)

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name helpdesk.internal.exchange.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name helpdesk.internal.exchange.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/helpdesk.internal.exchange.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/helpdesk.internal.exchange.com/privkey.pem;

    # TLS Protocols & Ciphers (Mozilla Modern Standard)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self';" always;

    # Static Frontend SPA
    root /var/www/helpdesk/dist/helpdesk-client/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 15M; # Max file upload + payload buffer
    }

    # Strict Auth Rate Limit
    location /api/auth/ {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Realtime WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 3. Secret Management & Key Rotation

### 3.1 Principles
1. **Zero Hardcoded Secrets**: Secrets are injected strictly via environment variables at runtime.
2. **Production Dev-Mode Prevention**: The application explicitly validates on boot:
   ```typescript
   if (env.AUTH_MODE === 'dev' && env.NODE_ENV === 'production') {
     logger.error('CRITICAL: AUTH_MODE cannot be "dev" in production environment!');
     process.exit(1);
   }
   ```
3. **Secret Storage**: Use HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault.

### 3.2 Required Production Secrets

| Secret Name | Description | Recommended Entropy |
|---|---|---|
| `SESSION_SECRET` | Secret key used to sign session cookies | Minimum 64 hex / base64 characters |
| `DATABASE_URL` | PostgreSQL connection string with TLS (`sslmode=require`) | Strong password, rotated quarterly |
| `OIDC_CLIENT_SECRET` | Microsoft Entra ID Application Secret | Managed by Enterprise Azure Portal |
| `S3_ACCESS_KEY` & `S3_SECRET_KEY` | IAM credentials with least-privilege bucket access | Cloud IAM service account |

### 3.3 Key Rotation Procedure
1. **Session Secret Rotation**:
   - Maintain a key rotation ring (accept previous secret for decryption, sign new sessions with new secret) during a 24-hour transition window.
   - Force session re-authentication for sensitive security transitions.
2. **OIDC Client Secret Rotation**:
   - Add a new client secret in Entra ID.
   - Update `OIDC_CLIENT_SECRET` in secret manager.
   - Restart backend instances gracefully.
   - Delete the old expired secret in Entra ID.

---

## 4. PostgreSQL Backup & Point-in-Time Recovery (PITR)

### 4.1 Daily Automated Logical Backups (`pg_dump`)

Create an automated backup script `/opt/helpdesk/scripts/daily-db-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/helpdesk/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/helpdesk_db_${TIMESTAMP}.dump"
S3_BACKUP_BUCKET="s3://exchange-helpdesk-backups/database/daily/"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting logical database backup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-postgres}" \
  -F c \
  -b \
  -v \
  -f "${BACKUP_FILE}" \
  "${POSTGRES_DB:-helpdesk}"

echo "[$(date)] Encrypting and shipping backup to cold storage..."
aws s3 cp "${BACKUP_FILE}" "${S3_BACKUP_BUCKET}" --sse aws:kms

# Keep 14 days locally
find "${BACKUP_DIR}" -type f -name "*.dump" -mtime +14 -delete

echo "[$(date)] Database backup completed successfully: ${BACKUP_FILE}"
```

Schedule via systemd timer or cron (`/etc/cron.d/helpdesk-backup`):
```cron
0 2 * * * root /opt/helpdesk/scripts/daily-db-backup.sh >> /var/log/helpdesk-backup.log 2>&1
```

### 4.2 Point-in-Time Recovery (PITR) with Continuous WAL Archiving

To achieve near-zero Recovery Point Objective (RPO < 5 minutes) in a financial institution, enable WAL archiving:

#### PostgreSQL Configuration (`postgresql.conf`):
```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f && aws s3 cp %p s3://exchange-helpdesk-backups/wal/%f'
archive_timeout = 300 # Force WAL switch every 5 minutes
max_wal_senders = 10
```

#### PITR Recovery Procedure:
1. Stop the PostgreSQL service:
   ```bash
   sudo systemctl stop postgresql
   ```
2. Move existing corrupted cluster data:
   ```bash
   sudo mv /var/lib/postgresql/16/main /var/lib/postgresql/16/main_corrupted_$(date +%s)
   ```
3. Restore base backup:
   ```bash
   sudo -u postgres pg_restore -h localhost -d helpdesk /var/backups/helpdesk/postgres/helpdesk_db_base.dump
   ```
4. Configure recovery signal (`/var/lib/postgresql/16/main/recovery.signal`):
   ```bash
   sudo -u postgres touch /var/lib/postgresql/16/main/recovery.signal
   ```
5. Specify target recovery time in `postgresql.conf`:
   ```ini
   restore_command = 'aws s3 cp s3://exchange-helpdesk-backups/wal/%f %p'
   recovery_target_time = '2026-11-09 14:32:00 UTC'
   recovery_target_action = 'promote'
   ```
6. Start PostgreSQL and monitor recovery logs:
   ```bash
   sudo systemctl start postgresql
   sudo tail -f /var/log/postgresql/postgresql-16-main.log
   ```

### 4.3 Automated Restore Verification Test
Run quarterly in a dedicated staging sandbox:

```bash
#!/usr/bin/env bash
# verify-restore.sh
set -euo pipefail

TEST_DB="helpdesk_restore_test"
LATEST_BACKUP=$(aws s3 ls s3://exchange-helpdesk-backups/database/daily/ | sort | tail -n 1 | awk '{print $4}')

aws s3 cp "s3://exchange-helpdesk-backups/database/daily/${LATEST_BACKUP}" /tmp/test_backup.dump

dropdb --if-exists -U postgres "${TEST_DB}"
createdb -U postgres "${TEST_DB}"

pg_restore -U postgres -d "${TEST_DB}" -v /tmp/test_backup.dump

# Sanity check row counts
USER_COUNT=$(psql -U postgres -d "${TEST_DB}" -t -c 'SELECT count(*) FROM "User";')
TICKET_COUNT=$(psql -U postgres -d "${TEST_DB}" -t -c 'SELECT count(*) FROM "Ticket";')

echo "Restore test SUCCESS: ${USER_COUNT} users, ${TICKET_COUNT} tickets restored."
dropdb -U postgres "${TEST_DB}"
rm -f /tmp/test_backup.dump
```

---

## 5. S3 / MinIO Production Bucket Policies & Access Controls

### 5.1 Bucket Security Posture
- **Private Access Only**: Block all public access (`BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`).
- **Encrypted at Rest**: Server-Side Encryption with KMS (SSE-KMS) or AES-256.
- **Access Model**: All file uploads and downloads are mediated by short-lived presigned URLs generated by the backend service. Users never receive long-lived direct S3 access.

### 5.2 Least-Privilege IAM Policy for Application Service

Attach this policy to the Help Desk backend service IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowHelpdeskAttachmentOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::exchange-helpdesk-attachments/*"
    },
    {
      "Sid": "AllowBucketListing",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::exchange-helpdesk-attachments"
    }
  ]
}
```

### 5.3 Bucket CORS Configuration
If client-direct uploads using presigned PUT URLs are enabled:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["https://helpdesk.internal.exchange.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 6. Zero-Downtime Deployment & Health Checks

### 6.1 Docker Compose Production Execution
To start all production containers with Docker Compose:

```bash
docker compose up -d --build
```

### 6.2 Service Health Monitoring
The service exposes standard health checks for load balancers:
- `GET /health`: Checks process uptime, environment, and returns HTTP 200 `UP`.
- `GET /api/ping`: Lightweight API heartbeat.

```bash
curl -f https://helpdesk.internal.exchange.com/health
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2026-11-09T20:45:00.000Z",
  "service": "helpdesk-server",
  "env": "production"
}
```

---

## 7. Incident Response & Troubleshooting Runbook

| Incident | Root Cause Investigation | Action |
|---|---|---|
| **High 409 Conflict Rate on Claims** | Normal concurrency behavior when 10+ technicians click "Claim" on high-priority tickets. | Advise technicians that atomic claiming is working as intended; inspect `TicketHistory` to review winning claimant. |
| **Sensitive Data Guard Blockages** | Employee attempted to paste credit card numbers or passwords in descriptions. | Check user notifications; clarify that financial exchange policy strictly prohibits sharing customer cards in ticket descriptions. |
| **Object Storage Disconnection** | S3 / MinIO unreachable or credentials expired. | Check `S3_ENDPOINT` connectivity; system logs alert to fallback secure local storage in development; in production verify IAM role STS tokens. |
| **Realtime Socket Disconnects** | Reverse proxy timeout or session expiry. | Ensure NGINX `proxy_read_timeout` is set to `86400s` and WebSocket headers (`Upgrade`, `Connection: Upgrade`) are enabled. |
