# About ReimburseX

ReimburseX is a full-stack reimbursement management platform built for the Odoo Hackathon problem statement. It helps organizations handle expense submission, multi-step approvals, and policy-based controls from one dashboard.

## What the Project Solves

Teams often manage reimbursements through email and spreadsheets, which creates delays and poor visibility. ReimburseX centralizes that workflow with:

- role-based access for admins, managers, and employees
- configurable approval rules (sequential, percentage, specific approver, hybrid)
- expense submission with currency normalization
- live approval queues and status tracking
- AI-assisted receipt and spend insights

## High-Level Architecture

- Frontend: React + Vite single-page app
- Backend: Node.js + Express REST API
- Database: MySQL schema for companies, users, expenses, rules, and approval actions
- Authentication: JWT-based session handling

## Core Workflow

1. A company admin signs up and creates the company workspace.
2. Employees submit expenses with amount, currency, category, and date.
3. Backend converts amounts to company currency and applies the matching approval rule.
4. Approval actions are generated and processed by managers/admins.
5. Expense status transitions to approved or rejected with comments and audit trail.

## AI Features

- Receipt extraction support in expense submission flows.
- WardenAI admin scan for pattern detection, bottlenecks, and policy recommendations.

## Current Scope

This repository is optimized for local development and demo usage. For production hardening, the next priorities are:

- move all AI provider calls behind backend endpoints
- stricter CORS and security headers
- centralized logging and monitoring
- automated tests for approval rule edge cases
