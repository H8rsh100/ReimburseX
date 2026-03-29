-- ReimburseX Database Schema
CREATE DATABASE IF NOT EXISTS reimbursex;
USE reimbursex;

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','employee') NOT NULL DEFAULT 'employee',
  manager_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  converted_amount DECIMAL(12,2),
  company_currency VARCHAR(10),
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  receipt_url VARCHAR(500),
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Approval Rules
CREATE TABLE IF NOT EXISTS approval_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  rule_type ENUM('sequential','percentage','specific_approver','hybrid') NOT NULL DEFAULT 'sequential',
  min_amount DECIMAL(12,2) DEFAULT NULL,
  max_amount DECIMAL(12,2) DEFAULT NULL,
  percentage_threshold INT DEFAULT NULL,
  specific_approver_id INT DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (specific_approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Approval Rule Steps (ordered approvers)
CREATE TABLE IF NOT EXISTS approval_rule_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_id INT NOT NULL,
  approver_id INT DEFAULT NULL,
  step_number INT NOT NULL,
  is_manager_approver TINYINT(1) DEFAULT 0,
  FOREIGN KEY (rule_id) REFERENCES approval_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Approval Actions (per-expense approval tracking)
CREATE TABLE IF NOT EXISTS approval_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  rule_id INT DEFAULT NULL,
  approver_id INT NOT NULL,
  step_number INT NOT NULL DEFAULT 1,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  comment TEXT,
  acted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES approval_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);
