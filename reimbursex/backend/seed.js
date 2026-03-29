/**
 * ReimburseX Demo Seed Script
 * Run once: node seed.js
 * Password for ALL users: Demo@123
 */

import bcrypt from "bcryptjs";
import pool from "./db/connection.js";

const HASH = await bcrypt.hash("Demo@123", 10);

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Company 1: Harsh (YOU) as Admin ─────────────────────────
    const [c1] = await conn.query(
      "INSERT INTO companies (name, currency, country) VALUES (?,?,?)",
      ["Nexus Technologies", "INR", "India"]
    );
    const C1 = c1.insertId;

    // Admin
    const [a1] = await conn.query(
      "INSERT INTO users (company_id,name,email,password_hash,role) VALUES (?,?,?,?,'admin')",
      [C1, "Harsh Patel", "harsh@nexus.com", HASH]
    );
    const HARSH = a1.insertId;

    // Manager
    const [m1] = await conn.query(
      "INSERT INTO users (company_id,name,email,password_hash,role,manager_id) VALUES (?,?,?,?,'manager',?)",
      [C1, "Riya Desai", "riya@nexus.com", HASH, HARSH]
    );
    const RIYA = m1.insertId;

    // 5 employees under Riya
    const emp1 = [
      ["Arjun Mehta",   "arjun@nexus.com"],
      ["Sneha Rao",     "sneha@nexus.com"],
      ["Kabir Singh",   "kabir@nexus.com"],
      ["Pooja Nair",    "pooja@nexus.com"],
      ["Dev Sharma",    "dev@nexus.com"],
    ];
    const empIds1 = [];
    for (const [name, email] of emp1) {
      const [r] = await conn.query(
        "INSERT INTO users (company_id,name,email,password_hash,role,manager_id) VALUES (?,?,?,?,'employee',?)",
        [C1, name, email, HASH, RIYA]
      );
      empIds1.push(r.insertId);
    }

    // Expenses for company 1
    const expenses1 = [
      [C1, empIds1[0], 4500,  "INR", "Travel",             "Flight to Mumbai for client pitch",        "2026-03-10", "approved"],
      [C1, empIds1[0], 1200,  "INR", "Food & Dining",      "Team lunch post-meeting",                  "2026-03-11", "approved"],
      [C1, empIds1[1], 8750,  "INR", "Accommodation",      "Hotel stay in Bangalore (2 nights)",       "2026-03-15", "pending"],
      [C1, empIds1[2], 25000, "INR", "Training",           "AWS Solutions Architect certification",    "2026-03-18", "pending"],
      [C1, empIds1[3], 350,   "INR", "Office Supplies",    "Notebooks & markers for sprint board",     "2026-03-05", "rejected"],
      [C1, empIds1[4], 3200,  "INR", "Client Entertainment","Dinner with Tata client team",            "2026-03-20", "approved"],
      [C1, empIds1[1], 980,   "INR", "Travel",             "Cab to airport (Ola outstation)",          "2026-03-22", "approved"],
      [C1, empIds1[2], 15000, "INR", "Medical",            "Health insurance co-pay reimbursement",    "2026-03-25", "pending"],
    ];
    for (const [cid,eid,amt,cur,cat,desc,date,status] of expenses1) {
      await conn.query(
        `INSERT INTO expenses (company_id,employee_id,amount,currency,converted_amount,company_currency,category,description,expense_date,status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [cid, eid, amt, cur, amt, cur, cat, desc, date, status]
      );
    }

    // ── Company 2: Ananya as Admin ───────────────────────────────
    const [c2] = await conn.query(
      "INSERT INTO companies (name, currency, country) VALUES (?,?,?)",
      ["Bloom Retail Pvt Ltd", "INR", "India"]
    );
    const C2 = c2.insertId;

    const [a2] = await conn.query(
      "INSERT INTO users (company_id,name,email,password_hash,role) VALUES (?,?,?,?,'admin')",
      [C2, "Ananya Krishnan", "ananya@bloom.com", HASH]
    );
    const ANANYA = a2.insertId;

    // 2 managers under Ananya
    const [mgr2a] = await conn.query(
      "INSERT INTO users (company_id,name,email,password_hash,role,manager_id) VALUES (?,?,?,?,'manager',?)",
      [C2, "Vikram Joshi", "vikram@bloom.com", HASH, ANANYA]
    );
    const VIK = mgr2a.insertId;

    const [mgr2b] = await conn.query(
      "INSERT INTO users (company_id,name,email,password_hash,role,manager_id) VALUES (?,?,?,?,'manager',?)",
      [C2, "Meera Iyer", "meera@bloom.com", HASH, ANANYA]
    );
    const MEERA = mgr2b.insertId;

    // 5 employees split across 2 managers
    const emp2 = [
      ["Ravi Kumar",    "ravi@bloom.com",    VIK],
      ["Sanya Gupta",   "sanya@bloom.com",   VIK],
      ["Aditya Bose",   "aditya@bloom.com",  VIK],
      ["Neha Malhotra", "neha@bloom.com",    MEERA],
      ["Rohan Tiwari",  "rohan@bloom.com",   MEERA],
    ];
    const empIds2 = [];
    for (const [name, email, mgr] of emp2) {
      const [r] = await conn.query(
        "INSERT INTO users (company_id,name,email,password_hash,role,manager_id) VALUES (?,?,?,?,'employee',?)",
        [C2, name, email, HASH, mgr]
      );
      empIds2.push(r.insertId);
    }

    // Expenses for company 2
    const expenses2 = [
      [C2, empIds2[0], 6200,  "INR", "Travel",          "Train to Delhi for vendor meet",          "2026-03-08", "approved"],
      [C2, empIds2[1], 2100,  "INR", "Food & Dining",   "Client breakfast at Marriott",            "2026-03-12", "approved"],
      [C2, empIds2[2], 45000, "INR", "Training",        "Salesforce Admin certification + exam",   "2026-03-14", "pending"],
      [C2, empIds2[3], 12000, "INR", "Accommodation",   "Hotel - Chennai retail summit",           "2026-03-17", "approved"],
      [C2, empIds2[4], 800,   "INR", "Office Supplies", "Printer cartridges",                      "2026-03-03", "rejected"],
      [C2, empIds2[0], 5500,  "INR", "Travel",          "Flight PNQ-BLR for Q1 review",           "2026-03-26", "pending"],
      [C2, empIds2[3], 3750,  "INR", "Medical",         "Eye surgery co-pay",                      "2026-03-27", "pending"],
    ];
    for (const [cid,eid,amt,cur,cat,desc,date,status] of expenses2) {
      await conn.query(
        `INSERT INTO expenses (company_id,employee_id,amount,currency,converted_amount,company_currency,category,description,expense_date,status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [cid, eid, amt, cur, amt, cur, cat, desc, date, status]
      );
    }

    await conn.commit();
    console.log("✅ Seed complete!");
    console.log("\n📋 Login credentials (password = Demo@123):");
    console.log("  Company 1 — Nexus Technologies");
    console.log("    Admin   : harsh@nexus.com");
    console.log("    Manager : riya@nexus.com");
    console.log("    Employee: arjun@nexus.com  |  sneha@nexus.com  |  kabir@nexus.com");
    console.log("              pooja@nexus.com  |  dev@nexus.com");
    console.log("\n  Company 2 — Bloom Retail Pvt Ltd");
    console.log("    Admin   : ananya@bloom.com");
    console.log("    Manager : vikram@bloom.com  |  meera@bloom.com");
    console.log("    Employee: ravi@bloom.com  |  sanya@bloom.com  |  aditya@bloom.com");
    console.log("              neha@bloom.com  |  rohan@bloom.com");
  } catch (err) {
    await conn.rollback();
    console.error("❌ Seed failed:", err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
