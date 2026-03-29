# ReimburseX — Reimbursement Management System

> Hackathon submission for the Odoo Reimbursement Management PS

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, React Router v6 |
| Backend | Node.js + Express |
| Database | MySQL |
| Auth | JWT (RS256) |
| OCR | Claude Vision API (claude-sonnet-4-20250514) |
| Currency | RestCountries API + ExchangeRate API |

---

## Project Structure

```
reimbursement-management/
├── backend/
│   ├── db/
│   │   ├── schema.sql
│   │   └── connection.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── expenses.js
│   │   ├── approvals.js
│   │   └── rules.js
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/                   ← this folder
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Expenses.jsx
    │   │   ├── ExpenseForm.jsx
    │   │   ├── Approvals.jsx
    │   │   ├── Users.jsx
    │   │   └── Rules.jsx
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup Instructions

### 1. Database

```sql
-- Create the database
CREATE DATABASE reimbursex;
USE reimbursex;

-- Run the schema
SOURCE backend/db/schema.sql;
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=reimbursex
JWT_SECRET=your_super_secret_key_here
```

Start the backend:
```bash
npm run dev
# or
node server.js
```

Backend runs on: `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:
```bash
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## Features

### Authentication & User Management
- Signup auto-creates a Company with the correct currency (via RestCountries API)
- JWT-based authentication with role-based access control
- Admin can create/edit/delete users, assign roles (Employee, Manager, Admin), and set manager relationships

### Expense Submission (Employee)
- Submit expenses in any currency — auto-converted to company currency via ExchangeRate API
- Fields: Amount, Currency, Category, Description, Date, Receipt URL
- **AI OCR**: Upload a receipt photo → Claude Vision auto-extracts all fields
- View expense history with status tracking (Pending / Approved / Rejected)

### Approval Workflow (Manager/Admin)
- Sequential multi-step approvals (Step 1 → Step 2 → Step 3)
- Manager approval first (if IS_MANAGER_APPROVER is checked)
- Approve/Reject with comments
- Amounts shown in company's default currency

### Conditional Approval Rules (Admin)
- **Sequential**: Steps in order, all must approve
- **Percentage**: e.g., 60% of approvers must approve
- **Specific Approver**: CFO approves → auto-approved
- **Hybrid**: Percentage OR specific approver
- Amount thresholds (min/max) per rule

### Dashboard
- Role-specific dashboards with live stats
- Employee: total, approved, pending, rejected expenses
- Manager: pending approval queue
- Admin: full company overview

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/signup | — | Register (creates company) |
| POST | /api/auth/login | — | Login, returns JWT |
| GET | /api/users | Admin | List all users |
| POST | /api/users | Admin | Create user |
| PUT | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |
| GET | /api/expenses | Employee | My expenses |
| GET | /api/expenses/all | Admin | All company expenses |
| POST | /api/expenses | Employee | Submit expense |
| GET | /api/approvals/pending | Manager/Admin | Pending approvals |
| POST | /api/approvals/:id/approve | Manager/Admin | Approve |
| POST | /api/approvals/:id/reject | Manager/Admin | Reject |
| GET | /api/rules | Admin | List rules |
| POST | /api/rules | Admin | Create rule |
| DELETE | /api/rules/:id | Admin | Delete rule |

---

## OCR Feature Note

The OCR feature calls the Anthropic Claude API directly from the browser. For production, proxy this through your backend to protect your API key:

1. Add `ANTHROPIC_API_KEY` to your backend `.env`
2. Create a `/api/ocr` endpoint in the backend that forwards to Anthropic
3. Update `ExpenseForm.jsx` to call `/api/ocr` instead of the Anthropic URL directly

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Admin** | Everything: manage users, rules, view all expenses, override approvals |
| **Manager** | Approve/reject team expenses, view team expenses |
| **Employee** | Submit expenses, view own expenses & status |

---

Built with ❤️ for the Odoo Hackathon
