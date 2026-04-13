# WealthFlow X AI

WealthFlow X AI is a hackathon-ready personal finance platform with an AI advisor, portfolio and goal tracking, analytics dashboards, fraud signal monitoring, notifications, and exportable reports.

## Tech stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Framer Motion
- Backend: Django 5, Django REST Framework, Simple JWT, Channels, Celery, drf-spectacular
- Data layer: SQLite by default for zero-config local setup
- Optional services: Redis for async tasks and websocket scaling, Razorpay for payment flows
- DevOps: Docker, Docker Compose, Nginx, GitHub Actions CI

## Features

- JWT-based signup and login
- Finance dashboard, transactions, investments, and goals
- AI advisor and AI-generated insights
- Fraud/anomaly activity surfaces
- Notifications and monthly report exports
- Demo data seeding for fast local evaluation
- API schema and Swagger docs

## Repository structure

- `frontend/` - Next.js application
- `backend/` - Django API and business logic
- `deploy/` - Docker Compose and Nginx setup
- `.github/workflows/ci.yml` - CI pipeline

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.12+
- Git

Redis is optional for local development. If Redis is not configured, Celery runs tasks eagerly in-process so the core product still works.

## Environment setup

This repo includes service-level env examples:

- `backend/.env.example`
- `frontend/.env.example`

Copy them before running locally.

### PowerShell

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

### macOS/Linux

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## Run locally without Docker

### 1. Start the backend

#### PowerShell

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

#### macOS/Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8000`.

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

### 3. Optional: start Redis and Celery

If you want background workers and Redis-backed realtime behavior locally, start Redis and then run:

```bash
cd backend
celery -A config worker -l info
```

## Run with Docker

From the `deploy/` folder:

```bash
cd deploy
docker compose up --build
```

Services:

- App entrypoint: `http://localhost`
- Frontend container: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`
- Swagger docs: `http://localhost:8000/api/docs/`

## Demo login

- Email: `demo@wealthflow.ai`
- Password: `Demo@12345`

## API overview

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `GET /api/finance/dashboard/`
- `GET /api/finance/analytics/`
- `GET /api/finance/transactions/`
- `POST /api/finance/transactions/`
- `GET /api/finance/investments/`
- `POST /api/finance/investments/`
- `GET /api/finance/goals/`
- `POST /api/finance/goals/`
- `POST /api/ai/advisor/chat/`
- `GET /api/ai/predictions/`
- `GET /api/ai/insights/`
- `GET /api/ai/fraud-logs/`
- `GET /api/notifications/`
- `POST /api/notifications/`
- `GET /api/reports/monthly/`
- `GET /api/reports/export/csv/`
- `GET /api/docs/`

## Submission notes

- The app is configured for zero-config local development with SQLite.
- Redis and Razorpay are optional integrations, not mandatory for core evaluation.
- Demo data can be seeded with one command for quick judging.
- Local-only build artifacts, logs, databases, and virtual environments are ignored via `.gitignore`.

## Verification commands

```bash
cd backend
python -m compileall .

cd ../frontend
npm run build
```

## GitHub submission checklist

```bash
git init
git add .
git commit -m "Prepare WealthFlow X AI for hackathon submission"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

If a remote already exists, skip the `git remote add origin ...` step and push directly.
