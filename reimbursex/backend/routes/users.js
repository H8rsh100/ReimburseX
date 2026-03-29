import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db/connection.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

// GET /api/users — all users in company
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.manager_id, u.created_at,
              m.name AS manager_name
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.company_id = ?
       ORDER BY u.created_at DESC`,
      [req.user.company_id]
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// POST /api/users — create user (admin only)
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, email, password, role, manager_id } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password, role are required" });
  }
  try {
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).json({ message: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (company_id, name, email, password_hash, role, manager_id) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.company_id, name, email, hash, role, manager_id || null]
    );
    res.status(201).json({ message: "User created", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// PUT /api/users/:id — update user (admin only)
router.put("/:id", requireRole("admin"), async (req, res) => {
  const { name, email, password, role, manager_id } = req.body;
  const userId = req.params.id;
  try {
    // Verify user belongs to same company
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND company_id = ?",
      [userId, req.user.company_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET name=?, email=?, password_hash=?, role=?, manager_id=? WHERE id=?",
        [name, email, hash, role, manager_id || null, userId]
      );
    } else {
      await pool.query(
        "UPDATE users SET name=?, email=?, role=?, manager_id=? WHERE id=?",
        [name, email, role, manager_id || null, userId]
      );
    }
    res.json({ message: "User updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// DELETE /api/users/:id (admin only)
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const userId = req.params.id;
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ message: "Cannot delete yourself" });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND company_id = ?",
      [userId, req.user.company_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    await pool.query("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
