import express from "express";
import pool from "../db/connection.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate, requireRole("admin"));

// GET /api/rules
router.get("/", async (req, res) => {
  try {
    const [rules] = await pool.query(
      "SELECT * FROM approval_rules WHERE company_id=? ORDER BY created_at DESC",
      [req.user.company_id]
    );
    // Attach steps + approver names
    for (const rule of rules) {
      const [steps] = await pool.query(
        `SELECT ars.*, u.name AS approver_name
         FROM approval_rule_steps ars
         LEFT JOIN users u ON ars.approver_id = u.id
         WHERE ars.rule_id = ?
         ORDER BY ars.step_number ASC`,
        [rule.id]
      );
      rule.steps = steps;
    }
    res.json({ rules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch rules" });
  }
});

// POST /api/rules
router.post("/", async (req, res) => {
  const { name, rule_type, min_amount, max_amount, percentage_threshold, specific_approver_id, steps } = req.body;
  if (!name || !rule_type) return res.status(400).json({ message: "name and rule_type are required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ruleRes] = await conn.query(
      `INSERT INTO approval_rules (company_id, name, rule_type, min_amount, max_amount, percentage_threshold, specific_approver_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, name, rule_type, min_amount || null, max_amount || null, percentage_threshold || null, specific_approver_id || null]
    );
    const ruleId = ruleRes.insertId;

    if (steps && steps.length > 0) {
      for (const step of steps) {
        await conn.query(
          "INSERT INTO approval_rule_steps (rule_id, approver_id, step_number, is_manager_approver) VALUES (?,?,?,?)",
          [ruleId, step.approver_id || null, step.step_number, step.is_manager_approver ? 1 : 0]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: "Rule created", id: ruleId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Failed to create rule" });
  } finally {
    conn.release();
  }
});

// DELETE /api/rules/:id
router.delete("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM approval_rules WHERE id=? AND company_id=?",
      [req.params.id, req.user.company_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Rule not found" });
    await pool.query("DELETE FROM approval_rules WHERE id=?", [req.params.id]);
    res.json({ message: "Rule deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete rule" });
  }
});

export default router;
