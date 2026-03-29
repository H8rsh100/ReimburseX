import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/connection.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// POST /api/auth/signup
// Auto-creates company + admin user
router.post("/signup", async (req, res) => {
  const { name, email, password, company_name, country, currency } = req.body;
  if (!name || !email || !password || !company_name) {
    return res.status(400).json({ message: "name, email, password, company_name are required" });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check duplicate email
    const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: "Email already registered" });
    }

    // Create company
    const [compRes] = await conn.query(
      "INSERT INTO companies (name, currency, country) VALUES (?, ?, ?)",
      [company_name, currency || "USD", country || ""]
    );
    const companyId = compRes.insertId;

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create admin user
    const [userRes] = await conn.query(
      "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      [companyId, name, email, hash]
    );
    const userId = userRes.insertId;

    await conn.commit();

    const token = jwt.sign(
      { id: userId, company_id: companyId, role: "admin", name, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user: { id: userId, name, email, role: "admin", company_name, currency: currency || "USD" } });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Signup failed" });
  } finally {
    conn.release();
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const [rows] = await pool.query(
      `SELECT u.*, c.name AS company_name, c.currency AS company_currency
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.email = ?`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, company_id: user.company_id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, company_name: user.company_name,
        company_currency: user.company_currency,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
