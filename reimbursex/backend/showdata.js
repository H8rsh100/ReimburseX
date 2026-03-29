import pool from "./db/connection.js";

async function showData() {
  const conn = await pool.getConnection();
  try {
    const [companies] = await conn.query("SELECT id, name, currency, country FROM companies");
    const [users]     = await conn.query("SELECT id, company_id, name, email, role, manager_id FROM users ORDER BY company_id, role");
    const [expenses]  = await conn.query("SELECT id, company_id, employee_id, amount, currency, category, description, expense_date, status FROM expenses ORDER BY company_id, expense_date");
    const [rules]     = await conn.query("SELECT * FROM approval_rules");
    const [steps]     = await conn.query("SELECT * FROM approval_rule_steps");
    const [actions]   = await conn.query("SELECT * FROM approval_actions");

    console.log("\n========== COMPANIES ==========");
    console.table(companies);

    console.log("\n========== USERS ==========");
    console.table(users);

    console.log("\n========== EXPENSES ==========");
    console.table(expenses);

    console.log("\n========== APPROVAL_RULES ==========");
    console.table(rules);

    console.log("\n========== APPROVAL_RULE_STEPS ==========");
    console.table(steps);

    console.log("\n========== APPROVAL_ACTIONS ==========");
    console.table(actions);
  } finally {
    conn.release();
    process.exit(0);
  }
}

showData().catch(e => { console.error(e); process.exit(1); });
