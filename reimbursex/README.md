# ReimburseX — Full Stack Reimbursement Management

> Hackathon project for Odoo Reimbursement Management PS

---

## Project Structure

```
reimbursex/
├── backend/          ← Node.js + Express + MySQL API
└── frontend/         ← React + Vite SPA
```

---

## Quick Start

### Step 1 — MySQL Database

```sql
CREATE DATABASE reimbursex;
USE reimbursex;
SOURCE backend/db/schema.sql;
```

### Step 2 — Backend

```bash
cd backend
npm install

# Copy and fill in your values:
cp .env.example .env
# Edit .env with your MySQL credentials and a JWT secret

npm run dev
# Runs on http://localhost:5000
```

### Step 3 — Frontend

```bash
cd frontend
npm install

# Create frontend/.env:
echo "VITE_API_URL=http://localhost:5000/api" > .env
echo "VITE_GEMINI_API_KEY=your_gemini_key_here" >> .env

npm run dev
# Runs on http://localhost:5173
```

### Step 4 — Open browser

Go to **http://localhost:5173** → click **Sign Up** → creates your company + admin account automatically.

---

## Features

| Feature | Details |
|---------|---------|
| Auth | JWT, auto company creation on signup |
| Currency | RestCountries API for dropdown, ExchangeRate API for conversion |
| OCR | Gemini 1.5 Flash Vision reads receipt photos |
| Expenses | Submit in any currency, auto-converted to company currency |
| Approvals | Sequential, Percentage, Specific Approver, Hybrid rules |
| Roles | Admin / Manager / Employee with full RBAC |

---

## Roles

| Role | Can Do |
|------|--------|
| **Admin** | Manage users, configure approval rules, view all expenses |
| **Manager** | Approve/reject team expenses with comments |
| **Employee** | Submit expenses, scan receipts, track status |

---

## API Endpoints

```
POST   /api/auth/signup          Register (auto-creates company)
POST   /api/auth/login           Login → JWT

GET    /api/users                List company users (admin)
POST   /api/users                Create user (admin)
PUT    /api/users/:id            Update user (admin)
DELETE /api/users/:id            Delete user (admin)

GET    /api/expenses             My expenses (employee)
GET    /api/expenses/all         All company expenses (admin)
POST   /api/expenses             Submit expense (employee/admin)

GET    /api/approvals/pending    My pending approvals (manager/admin)
POST   /api/approvals/:id/approve  Approve
POST   /api/approvals/:id/reject   Reject

GET    /api/rules                List approval rules (admin)
POST   /api/rules                Create approval rule (admin)
DELETE /api/rules/:id            Delete rule (admin)
```

---

Built for the Odoo Hackathon 🚀
