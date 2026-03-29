# ReimburseX Local Start Guide

This guide explains how to run ReimburseX on localhost.

## 1) Prerequisites

- Node.js 18+ and npm
- MySQL 8+

Check versions:

```powershell
node -v
npm -v
mysql --version
```

## 2) Install dependencies

Dependencies are already installed in this workspace, but use these commands again if needed:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## 3) Create database and tables

From MySQL shell:

```sql
CREATE DATABASE reimbursex;
USE reimbursex;
SOURCE backend/db/schema.sql;
```

If `SOURCE` path does not work from your MySQL shell, give the full absolute path to `schema.sql`.

## 4) Configure environment files

### Backend

Create `backend/.env` (or copy from `backend/.env.example`) and set:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=reimbursex
JWT_SECRET=your_long_random_secret
```

### Frontend

Create/update `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## 5) Start backend and frontend

Open 2 terminals from repo root.

Terminal 1 (backend):

```powershell
cd backend
npm run dev
```

Backend runs at: `http://localhost:5000`

Terminal 2 (frontend):

```powershell
cd frontend
npm run dev
```

Frontend runs at: `http://localhost:5173`

## 6) Open app

Visit `http://localhost:5173` and sign up/login.

## Troubleshooting

- Port already in use:
  - Change `PORT` in `backend/.env`.
- MySQL auth/connection error:
  - Recheck `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `backend/.env`.
- Frontend cannot hit API:
  - Ensure `VITE_API_URL=http://localhost:5000/api` in `frontend/.env`.
- Windows path issue for schema import:
  - Use full path with forward slashes in MySQL `SOURCE` command.