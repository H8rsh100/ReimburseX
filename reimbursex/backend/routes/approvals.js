import express from "express";
import pool from "../db/connection.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

// GET /api/approvals/pending — pending approvals for logged-in manager/admin
router.get("/pending", requireRole("manager", "admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT aa.id AS approval_action_id, aa.expense_id, aa.step_number, aa.rule_id,
              e.amount, e.currency, e.converted_amount, e.company_currency,
              e.category, e.description, e.expense_date, e.receipt_url,
              u.name AS employee_name, u.email AS employee_email
       FROM approval_actions aa
       JOIN expenses e ON aa.expense_id = e.id
       JOIN users u ON e.employee_id = u.id
       WHERE aa.approver_id = ?
         AND aa.status = 'pending'
         AND e.status = 'pending'
         AND e.company_id = ?
       ORDER BY aa.created_at ASC`,
      [req.user.id, req.user.company_id]
    );
    res.json({ approvals: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch approvals" });
  }
});

// GET /api/approvals/history — past approval decisions for this company
router.get("/history", requireRole("manager", "admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT aa.id, aa.expense_id, aa.status, aa.comment, aa.acted_at, aa.created_at,
              e.amount, e.currency, e.converted_amount, e.company_currency,
              e.category, e.description, e.expense_date,
              u.name AS employee_name, u.email AS employee_email,
              a.name AS approver_name
       FROM approval_actions aa
       JOIN expenses e ON aa.expense_id = e.id
       JOIN users u ON e.employee_id = u.id
       JOIN users a ON aa.approver_id = a.id
       WHERE aa.status IN ('approved','rejected')
         AND e.company_id = ?
       ORDER BY COALESCE(aa.acted_at, aa.created_at) DESC
       LIMIT 100`,
      [req.user.company_id]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch approval history" });
  }
});



// Core approval engine
async function processApproval(conn, actionId, approverId, action, comment, companyId) {
  // Fetch the action
  const [actions] = await conn.query(
    `SELECT aa.*, e.status AS expense_status, e.company_id
     FROM approval_actions aa
     JOIN expenses e ON aa.expense_id = e.id
     WHERE aa.id = ? AND aa.approver_id = ? AND aa.status = 'pending'`,
    [actionId, approverId]
  );
  if (actions.length === 0) throw new Error("Action not found or already processed");

  const action_row = actions[0];
  if (action_row.company_id !== companyId) throw new Error("Forbidden");

  const expenseId = action_row.expense_id;
  const ruleId = action_row.rule_id;
  const stepNumber = action_row.step_number;

  // Mark this action
  await conn.query(
    "UPDATE approval_actions SET status=?, comment=?, acted_at=NOW() WHERE id=?",
    [action, comment || null, actionId]
  );

  if (action === "rejected") {
    // Immediately reject expense
    await conn.query(
      "UPDATE expenses SET status='rejected', rejection_comment=? WHERE id=?",
      [comment || null, expenseId]
    );
    // Cancel all other pending actions for this expense
    await conn.query(
      "UPDATE approval_actions SET status='rejected' WHERE expense_id=? AND status='pending'",
      [expenseId]
    );
    return;
  }

  // action === "approved" — check if we need to advance or finalize
  if (!ruleId) {
    // No rule — single approval is enough
    await conn.query("UPDATE expenses SET status='approved' WHERE id=?", [expenseId]);
    return;
  }

  // Fetch the rule
  const [rules] = await conn.query("SELECT * FROM approval_rules WHERE id=?", [ruleId]);
  const rule = rules[0];

  // Fetch all steps for this rule
  const [steps] = await conn.query(
    "SELECT * FROM approval_rule_steps WHERE rule_id=? ORDER BY step_number ASC",
    [ruleId]
  );

  // Fetch all approval actions for this expense
  const [allActions] = await conn.query(
    "SELECT * FROM approval_actions WHERE expense_id=? AND rule_id=?",
    [expenseId, ruleId]
  );

  const approvedActions = allActions.filter(a => a.status === "approved");
  const totalSteps = steps.length;

  // --- Specific approver rule ---
  if (rule.rule_type === "specific_approver" || rule.rule_type === "hybrid") {
    if (rule.specific_approver_id && String(approverId) === String(rule.specific_approver_id)) {
      await conn.query("UPDATE expenses SET status='approved' WHERE id=?", [expenseId]);
      return;
    }
  }

  // --- Percentage rule ---
  if (rule.rule_type === "percentage" || rule.rule_type === "hybrid") {
    const threshold = rule.percentage_threshold || 100;
    const pct = (approvedActions.length / totalSteps) * 100;
    if (pct >= threshold) {
      await conn.query("UPDATE expenses SET status='approved' WHERE id=?", [expenseId]);
      return;
    }
    // Not yet at threshold — don't advance sequentially, just wait
    if (rule.rule_type === "percentage") return;
  }

  // --- Sequential rule: advance to next step ---
  if (rule.rule_type === "sequential" || rule.rule_type === "hybrid") {
    const nextStep = steps.find(s => s.step_number === stepNumber + 1);
    if (!nextStep) {
      // All steps done → approved
      await conn.query("UPDATE expenses SET status='approved' WHERE id=?", [expenseId]);
    } else {
      // Resolve approver (manager flag)
      let nextApproverId = nextStep.approver_id;
      if (nextStep.is_manager_approver) {
        const [empRows] = await conn.query(
          "SELECT manager_id FROM users WHERE id=(SELECT employee_id FROM expenses WHERE id=?)",
          [expenseId]
        );
        nextApproverId = empRows[0]?.manager_id || nextApproverId;
      }
      if (nextApproverId) {
        await conn.query(
          "INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status) VALUES (?,?,?,?,'pending')",
          [expenseId, ruleId, nextApproverId, nextStep.step_number]
        );
      }
    }
  }
}

// POST /api/approvals/:id/approve
router.post("/:id/approve", requireRole("manager", "admin"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await processApproval(conn, req.params.id, req.user.id, "approved", req.body.comment, req.user.company_id);
    await conn.commit();
    res.json({ message: "Expense approved" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ message: err.message || "Approval failed" });
  } finally {
    conn.release();
  }
});

// POST /api/approvals/:id/reject
router.post("/:id/reject", requireRole("manager", "admin"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await processApproval(conn, req.params.id, req.user.id, "rejected", req.body.comment, req.user.company_id);
    await conn.commit();
    res.json({ message: "Expense rejected" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ message: err.message || "Rejection failed" });
  } finally {
    conn.release();
  }
});

export default router;
