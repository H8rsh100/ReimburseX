/**
 * ReimburseX — Add Approval Rules + wire up pending expenses
 * Run: node addRules.js
 *
 * Creates one "All-expenses" sequential rule for each company,
 * with Harsh (Company 1 admin) and Ananya (Company 2 admin) as the sole approver.
 * Then creates approval_actions for every currently pending expense.
 */

import pool from "./db/connection.js";

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Get company + admin IDs ──────────────────────────────────
    const [companies] = await conn.query("SELECT id, name FROM companies ORDER BY id ASC");

    for (const company of companies) {
      const cid = company.id;

      // Get the admin user for this company
      const [admins] = await conn.query(
        "SELECT id, name FROM users WHERE company_id=? AND role='admin' LIMIT 1", [cid]
      );
      if (!admins.length) continue;
      const adminId = admins[0].id;

      // Create a catch-all sequential rule (no amount limits)
      const [ruleRes] = await conn.query(
        `INSERT INTO approval_rules (company_id, name, rule_type, is_active)
         VALUES (?, 'Standard Approval', 'sequential', 1)`, [cid]
      );
      const ruleId = ruleRes.insertId;

      // Add admin as step 1 approver
      await conn.query(
        "INSERT INTO approval_rule_steps (rule_id, approver_id, step_number, is_manager_approver) VALUES (?,?,1,0)",
        [ruleId, adminId]
      );

      // Wire up every PENDING expense in this company with an approval_action
      const [pending] = await conn.query(
        "SELECT id FROM expenses WHERE company_id=? AND status='pending'", [cid]
      );
      for (const exp of pending) {
        // Skip if already has an action
        const [existing] = await conn.query(
          "SELECT id FROM approval_actions WHERE expense_id=?", [exp.id]
        );
        if (existing.length) continue;

        await conn.query(
          `INSERT INTO approval_actions (expense_id, rule_id, approver_id, step_number, status)
           VALUES (?,?,?,1,'pending')`,
          [exp.id, ruleId, adminId]
        );
      }

      console.log(`✅ [${company.name}] Rule created, ${pending.length} pending expense(s) wired to admin #${adminId}`);
    }

    await conn.commit();
    console.log("\n🎉 Done! Log in as admin and go to Approvals to approve expenses.");
  } catch (err) {
    await conn.rollback();
    console.error("❌ Failed:", err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
