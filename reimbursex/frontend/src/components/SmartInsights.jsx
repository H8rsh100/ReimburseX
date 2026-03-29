import { useMemo } from "react";

const POLICY_LIMIT = 10000;
const MONTHLY_BUDGET = 500000; // configurable — 5 lakh INR default

function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

export default function SmartInsights({ expenses = [], approvals = [], currency = "INR" }) {
  const insights = useMemo(() => {
    const total = expenses.length;
    const approved = expenses.filter(e => e.status === "approved").length;
    const pending = expenses.filter(e => e.status === "pending").length;
    const approvalRate = pct(approved, total - pending);

    // Top category by spend
    const catMap = {};
    expenses.forEach(e => {
      const k = e.category || "Other";
      catMap[k] = (catMap[k] || 0) + parseFloat(e.converted_amount || e.amount || 0);
    });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    const totalSpend = Object.values(catMap).reduce((s, v) => s + v, 0);

    // Policy violations (high value)
    const violations = expenses.filter(e => parseFloat(e.converted_amount || e.amount) > POLICY_LIMIT).length;

    // Monthly burn
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlySpend = thisMonth.reduce((s, e) => s + parseFloat(e.converted_amount || e.amount || 0), 0);
    const burnPct = Math.min(pct(monthlySpend, MONTHLY_BUDGET), 100);

    return { total, approved, approvalRate, topCat, totalSpend, violations, monthlySpend, burnPct, pendingCount: approvals.length };
  }, [expenses, approvals]);

  const fmtAmt = (n) => {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toFixed(0);
  };

  return (
    <div className="card insights-card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{
            background: "linear-gradient(135deg, #6366f1, #a78bfa)",
            borderRadius: "8px", padding: "4px 8px", fontSize: "0.85rem"
          }}>✦</span>
          Smart Insights
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: "0.25rem" }}>
            · AI-powered analysis
          </span>
        </h2>
        <span style={{
          fontSize: "0.72rem", padding: "0.2rem 0.65rem", borderRadius: "20px",
          background: "rgba(99,102,241,0.15)", color: "#a78bfa", fontWeight: 600
        }}>LIVE</span>
      </div>

      <div className="insights-grid">
        {/* Tile 1: Approval Rate */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>📊</span> Approval Rate
          </div>
          <div className="insight-tile-value" style={{
            color: insights.approvalRate >= 80 ? "var(--success)" : insights.approvalRate >= 50 ? "var(--warning)" : "var(--danger)"
          }}>
            {isNaN(insights.approvalRate) ? "—" : `${insights.approvalRate}%`}
          </div>
          <div className="insight-tile-sub">
            {insights.approved} of {insights.total - insights.pendingCount} resolved
          </div>
          <div className="insight-bar">
            <div className="insight-bar-fill" style={{ width: `${insights.approvalRate}%`, background: insights.approvalRate >= 80 ? "linear-gradient(90deg,#22c55e,#86efac)" : "linear-gradient(90deg,#f59e0b,#fcd34d)" }} />
          </div>
        </div>

        {/* Tile 2: Top Category */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>📂</span> Top Spend Category
          </div>
          <div className="insight-tile-value" style={{ fontSize: "1.1rem" }}>
            {insights.topCat ? insights.topCat[0] : "—"}
          </div>
          <div className="insight-tile-sub">
            {insights.topCat
              ? `${currency} ${fmtAmt(insights.topCat[1])} · ${pct(insights.topCat[1], insights.totalSpend)}% of total spend`
              : "No expense data yet"}
          </div>
          {insights.topCat && (
            <div className="insight-bar">
              <div className="insight-bar-fill" style={{ width: `${pct(insights.topCat[1], insights.totalSpend)}%` }} />
            </div>
          )}
        </div>

        {/* Tile 3: Monthly Burn */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>🔥</span> Monthly Budget Burn
          </div>
          <div className="insight-tile-value" style={{
            color: insights.burnPct > 90 ? "var(--danger)" : insights.burnPct > 70 ? "var(--warning)" : "var(--text-primary)"
          }}>
            {insights.burnPct}%
          </div>
          <div className="insight-tile-sub">
            {currency} {fmtAmt(insights.monthlySpend)} this month
          </div>
          <div className="insight-bar">
            <div className="insight-bar-fill" style={{
              width: `${insights.burnPct}%`,
              background: insights.burnPct > 90 ? "linear-gradient(90deg,#ef4444,#fca5a5)" : "linear-gradient(90deg,#6366f1,#a78bfa)"
            }} />
          </div>
        </div>

        {/* Tile 4: Pending Queue */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>⏳</span> Pending Queue
          </div>
          <div className="insight-tile-value" style={{ color: insights.pendingCount > 5 ? "var(--warning)" : "var(--text-primary)" }}>
            {insights.pendingCount}
          </div>
          <div className="insight-tile-sub">
            {insights.pendingCount === 0 ? "All clear! No pending approvals." : `${insights.pendingCount} expense${insights.pendingCount > 1 ? "s" : ""} awaiting review`}
          </div>
        </div>

        {/* Tile 5: Policy Violations */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>⚠️</span> Policy Flags
          </div>
          <div className="insight-tile-value" style={{ color: insights.violations > 0 ? "var(--danger)" : "var(--success)" }}>
            {insights.violations}
          </div>
          <div className="insight-tile-sub">
            {insights.violations === 0
              ? "No high-value expense flags"
              : `${insights.violations} expense${insights.violations > 1 ? "s" : ""} exceed policy limit`}
          </div>
        </div>

        {/* Tile 6: Total Submitted */}
        <div className="insight-tile">
          <div className="insight-tile-label">
            <span>📋</span> Total Submitted
          </div>
          <div className="insight-tile-value">{insights.total}</div>
          <div className="insight-tile-sub">
            {currency} {fmtAmt(insights.totalSpend)} overall spend across all claims
          </div>
        </div>
      </div>
    </div>
  );
}
