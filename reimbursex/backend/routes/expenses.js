import express from "express";
import pool from "../db/connection.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

// Currency conversion helper
async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return parseFloat(amount);
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    const data = await res.json();
    const rate = data.rates?.[toCurrency];
    if (!rate) return parseFloat(amount);
    return parseFloat((amount * rate).toFixed(2));
  } catch {
    return parseFloat(amount);
  }
}

// Find matching approval rule for an expense amount
async function findMatchingRule(companyId, convertedAmount) {
  const [rules] = await pool.query(
    `SELECT * FROM approval_rules WHERE company_id = ? AND is_active = 1
     ORDER BY COALESCE(min_amount, 0) DESC`,
    [companyId]
  );
  for (const rule of rules) {
    const min = rule.min_amount != null ? parseFloat(rule.min_amount) : null;
    const max = rule.max_amount != null ? parseFloat(rule.max_amount) : null;
    if (min !== null && convertedAmount < min) continue;
    if (max !== null && convertedAmount > max) continue;
    return rule;
  }
  return null;
}

// Create initial approval actions for an expense
async function createApprovalActions(conn, expense, rule, employeeManagerId) {
  if (!rule) return;

  const [steps] = await conn.query(
    "SELECT * FROM approval_rule_steps WHERE rule_id = ? ORDER BY step_number ASC",
    [rule.id]
  );

  // If manager approver flag and employee has a manager, inject manager as step 0
  const hasManagerStep = steps.some(s => s.is_manager_approver);
  let allSteps = [...steps];

  if (hasManagerStep && employeeManagerId) {
    // Manager approval is already encoded in the step; just resolve approver_id
    allSteps = allSteps.map(s => ({
      ...s,
      approver_id: s.is_manager_approver ? employeeManagerId : s.approver_id,
    }));
  }

  // For percentage rules, create ALL steps as pending upfront
  if (rule.rule_type === "percentage" || rule.rule_type === "hybrid") {
    for (const step of allSteps) {
      if (step.approver_id) {
        await conn.query(
          `INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [expense.id, rule.id, step.approver_id, step.step_number]
        );
      }
    }
  } else {
    // For sequential, only create the first step
    if (allSteps.length > 0) {
      const first = allSteps[0];
      if (first.approver_id) {
        await conn.query(
          `INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [expense.id, rule.id, first.approver_id, first.step_number]
        );
      }
    }
  }
}

// GET /api/expenses — employee's own expenses
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, c.currency AS company_currency
       FROM expenses e
       JOIN companies c ON e.company_id = c.id
       WHERE e.employee_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ expenses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// GET /api/expenses/all — all company expenses (admin only)
router.get("/all", requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, u.name AS employee_name, u.email AS employee_email, c.currency AS company_currency
       FROM expenses e
       JOIN users u ON e.employee_id = u.id
       JOIN companies c ON e.company_id = c.id
       WHERE e.company_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.company_id]
    );
    res.json({ expenses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// POST /api/expenses — submit new expense
router.post("/", requireRole("employee", "admin"), async (req, res) => {
  const { amount, currency, category, description, expense_date, receipt_url } = req.body;
  if (!amount || !currency || !category || !description || !expense_date) {
    return res.status(400).json({ message: "amount, currency, category, description, expense_date are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get company currency
    const [compRows] = await conn.query("SELECT currency FROM companies WHERE id = ?", [req.user.company_id]);
    const companyCurrency = compRows[0]?.currency || "USD";

    // Convert to company currency
    const convertedAmount = await convertCurrency(parseFloat(amount), currency, companyCurrency);

    // Insert expense
    const [expRes] = await conn.query(
      `INSERT INTO expenses (company_id, employee_id, amount, currency, converted_amount, company_currency, category, description, expense_date, receipt_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.company_id, req.user.id, amount, currency, convertedAmount, companyCurrency, category, description, expense_date, receipt_url || null]
    );
    const expenseId = expRes.insertId;

    // Get employee's manager
    const [userRows] = await conn.query("SELECT manager_id FROM users WHERE id = ?", [req.user.id]);
    const managerIdOfEmployee = userRows[0]?.manager_id || null;

    // Find matching approval rule
    const rule = await findMatchingRule(req.user.company_id, convertedAmount);

    // If no rule and employee has manager, enforce manager-first approval as default
    if (!rule && managerIdOfEmployee) {
      await conn.query(
        `INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status)
         VALUES (?, NULL, ?, 1, 'pending')`,
        [expenseId, managerIdOfEmployee]
      );
    } else {
      // Create approval actions
      await createApprovalActions(conn, { id: expenseId }, rule, managerIdOfEmployee);
    }

    await conn.commit();
    res.status(201).json({ message: "Expense submitted", id: expenseId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Failed to submit expense" });
  } finally {
    conn.release();
  }
});

// POST /api/expenses/:id/override — admin override status
router.post('/:id/override', requireRole('admin'), async (req, res) => {
  const expenseId = req.params.id;
  const { status, comment } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, company_id FROM expenses WHERE id = ? AND company_id = ?',
      [expenseId, req.user.company_id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Expense not found' });
    }

    await conn.query(
      'UPDATE expenses SET status = ?, rejection_comment = ? WHERE id = ?',
      [status, status === 'rejected' ? comment || null : null, expenseId]
    );

    await conn.query(
      "UPDATE approval_actions SET status = ?, comment = CONCAT('ADMIN OVERRIDE: ', COALESCE(?, '')), acted_at = NOW() WHERE expense_id = ? AND status = 'pending'",
      [status, comment || null, expenseId]
    );

    // record override action in audit trail
    await conn.query(
      `INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status, comment, acted_at)
       VALUES (?, NULL, ?, 0, ?, ?, NOW())`,
      [expenseId, req.user.id, status, `ADMIN OVERRIDE: ${comment || ''}`.trim()]
    );

    await conn.commit();
    res.json({ message: `Expense ${status} via admin override` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Failed to override expense status' });
  } finally {
    conn.release();
  }
});

// GET /api/expenses/:id/audit — admin expense audit trail
router.get('/:id/audit', requireRole('admin'), async (req, res) => {
  const expenseId = req.params.id;

  try {
    const [expenseRows] = await pool.query(
      `SELECT e.*, u.name AS employee_name, u.email AS employee_email, c.currency AS company_currency
       FROM expenses e
       JOIN users u ON e.employee_id = u.id
       JOIN companies c ON e.company_id = c.id
       WHERE e.id = ? AND e.company_id = ?`,
      [expenseId, req.user.company_id]
    );
    if (expenseRows.length === 0) return res.status(404).json({ message: 'Expense not found' });

    const [actions] = await pool.query(
      `SELECT aa.*, u.name AS approver_name, u.role AS approver_role
       FROM approval_actions aa
       LEFT JOIN users u ON aa.approver_id = u.id
       WHERE aa.expense_id = ?
       ORDER BY aa.acted_at ASC, aa.created_at ASC`,
      [expenseId]
    );

    res.json({ expense: expenseRows[0], audit: actions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch audit trail' });
  }
});

export default router;
