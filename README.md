# HustleHub+ | INSY7314 Part 3

**Antonio Bechev | ST10435330**

HustleHub+ connects freelancers who publish services with clients who book them.
Each successful booking records a simulated ZAR transaction. Freelancers can
view their recorded income, estimated tax and income after the estimate.

[Classroom repository](https://github.com/EMGPSD/insy7314-g1-2026-poe-final-group-12) |
[Verified Part 3 workflow run](https://github.com/ST10435330/INSY7314_POE_Part3/actions/runs/42615479635)

## Architecture

| Component | Responsibility |
| --- | --- |
| React and Vite | Authentication screens, gig management, bookings, transaction history and the freelancer dashboard |
| Express and Node.js | API routes, authentication, authorisation, input validation, tax estimation and audit events |
| MongoDB replica set | Accounts, gigs, bookings, transactions and revoked token digests |
| Nginx | Serves the built frontend and proxies `/api/` to Express in Docker Compose |

The API takes the price from the gig and saves the booking and its transaction
in one database transaction. Retrying with the same booking request ID
returns the original result. Later gig price changes leave recorded amounts intact.

## Run with Docker Compose

Start Docker Desktop. From the repository root, run:

```powershell
if (-not (Test-Path .env.compose)) {
    $jwtSecret = node -p "require('node:crypto').randomBytes(32).toString('hex')"
    "JWT_SECRET=$jwtSecret" | Set-Content -Encoding ascii .env.compose
}

docker compose --env-file .env.compose up --build -d --wait --wait-timeout 120
docker compose --env-file .env.compose ps -a
```

Open [HustleHub+](http://localhost:8080). `/api/health` checks API liveness.
`/api/ready` checks database readiness and returns `503` if the check fails.
The `mongo-init` container should exit with code `0` after initialising the
replica set.

```powershell
node scripts/part3-smoke.mjs http://127.0.0.1:8080
docker compose --env-file .env.compose logs --no-color --no-log-prefix api
docker compose --env-file .env.compose down
```

The [API Dockerfile](Dockerfile) builds the Express bundle. The
[frontend Dockerfile](frontend/Dockerfile) builds React and serves it through
Nginx. [Docker Compose](compose.yaml) binds the gateway to loopback and keeps
Express and MongoDB on its internal network.

## Run locally without Docker

Use Node.js 24 and npm. Copy the example files, set a random `JWT_SECRET` of
at least 32 characters in `.env`, and generate the localhost certificate.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
npm ci
npm ci --prefix frontend
npm run setup:cert
```

Run `npm run db`, `npm run dev`, and `npm run dev --prefix frontend` in separate
terminals. The frontend runs at `https://localhost:5173` and the API at
`https://localhost:3443`. The development database downloads MongoDB on its
first run.

## Income and estimated tax

`GET /api/income` returns income for the signed-in freelancer. The API totals
recorded simulated earnings in integer cents, applies an illustrative flat
rate of 20%, rounds to the nearest cent and subtracts the estimate from gross
income. For example, R1,250 gross yields R250 estimated tax and R1,000 after
the estimate. The dashboard labels this as a lifetime platform simulation.

## Security review

| Threat | Control |
| --- | --- |
| Injection | Express validates request types and fields. Mongoose uses strict queries and filter sanitisation. |
| Cross-site scripting and framing | The API sanitises gig input, React escapes rendered text, and Nginx applies a Content Security Policy. |
| Authentication weaknesses | Passwords are hashed with bcrypt. Login is throttled. The API verifies JWT signatures, issuer, audience and expiry. |
| Broken access control | The server checks the current database role and enforces listing ownership and booking or transaction participation. |
| Token reuse after logout | The API stores an expiring SHA-256 digest of the revoked token. A replay gets `401`, while separate sessions stay active. |
| Income endpoint abuse | Each freelancer account can make 30 income requests per minute per API instance. Excess requests get `429`. |
| Duplicate bookings | A client-scoped request ID and an atomic booking and transaction write prevent duplicate financial records. |

The Compose profile is intended for local assessment. A public deployment
would require a trusted HTTPS gateway, managed secrets and authenticated
MongoDB. Multi-instance rate limiting would require a shared counter store.

## Logging and monitoring

The API writes JSON events for login outcomes, logout, booking creation and
replays, recorded transactions, and API errors. Events carry request IDs so
related records can be matched. The logger omits passwords, bearer tokens,
email addresses and raw request bodies. Repeated `401` and `429` responses
help identify authentication and rate-limit issues. Readiness failures and
`5xx` responses help identify operational issues.

## Tests and CI

```powershell
npm test
npm test --prefix frontend
npm run build
npm run build --prefix frontend
npm run --silent lint:ci
```

The [GitHub Actions workflow](.github/workflows/part3-ci.yml) installs locked
dependencies, runs Oxlint and both test suites, then builds the API and
frontend. Its second job starts the Compose stack and exercises the app
through Nginx. Both jobs passed on the linked workflow run. The run provides
the `static-analysis` and `container-evidence` artifacts.

## Evidence and demonstration

| Evidence | File |
| --- | --- |
| Static analysis | [Oxlint JSON report](evidence/part3/static-analysis.json) |
| Container smoke test | [Smoke output](evidence/part3/compose-smoke.txt) |
| Container status | [Compose status](evidence/part3/compose-status.txt) |
| Logging | [API audit events](evidence/part3/audit-log.jsonl) |

The separate `HustleHub_Part3_Demo.mp4` walkthrough shows authentication,
gig creation, booking, transaction history and the freelancer tax summary.
