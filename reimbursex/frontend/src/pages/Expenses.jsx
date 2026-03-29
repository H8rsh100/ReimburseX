import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  approved: "#22c55e",
  rejected: "#ef4444",
  pending: "#f59e0b",
  draft: "#6b7280",
};

const POLICY_LIMIT = 10000;

/* ── Lightweight PDF builder (no npm needed) ── */
function buildPDF(expenses, companyName, currency) {
  // We'll use the browser's print API for a formatted PDF
  const rows = expenses.map(e => `
    <tr>
      <td>${e.description?.slice(0, 40) || "—"}</td>
      <td>${e.category}</td>
      <td>${e.currency} ${parseFloat(e.amount).toFixed(2)}</td>
      <td>${new Date(e.expense_date).toLocaleDateString()}</td>
      <td style="color:${STATUS_COLORS[e.status]};font-weight:600;text-transform:capitalize">${e.status}</td>
      <td>${e.rejection_comment || "—"}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>Expense Report — ${companyName}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #6366f1; color: #fff; padding: 8px 10px; text-align: left; }
      td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafc; }
      .footer { margin-top: 24px; font-size: 11px; color: #999; }
      @media print { .no-print { display:none; } }
    </style>
    </head><body>
    <h1>💸 ReimburseX — Expense Report</h1>
    <div class="subtitle">${companyName} · Generated ${new Date().toLocaleString()}</div>
    <table>
      <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th><th>Comment</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Total entries: ${expenses.length}</div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) alert("Please allow pop-ups to export PDF.");
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.get("/expenses").then(r => {
      setExpenses(r.data.expenses || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? expenses : expenses.filter(e => e.status === filter);

  const exportCSV = () => {
    const header = ["Description","Category","Amount","Currency","Converted","Company Currency","Date","Status","Comment"];
    const rows = filtered.map(e => [
      `"${(e.description||"").replace(/"/g,'""')}"`,
      e.category, e.amount, e.currency,
      e.converted_amount || e.amount, e.company_currency || "",
      e.expense_date, e.status, e.rejection_comment||""
    ]);
    const csv = [header,...rows].map(r=>r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type:"text/csv" })),
      download: `expenses_${new Date().toISOString().split("T")[0]}.csv`
    });
    a.click();
  };

  const exportPDF = () => {
    buildPDF(filtered, user?.company_name || "Company", user?.company_currency || "INR");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Expenses</h1>
          <p className="page-subtitle">Submit and track your reimbursement claims</p>
        </div>
        <div style={{ display:"flex", gap:"0.6rem", flexWrap:"wrap" }}>
          <button className="btn btn-secondary" onClick={exportCSV} title="Download as CSV">
            ⬇ CSV
          </button>
          <button className="btn btn-secondary" onClick={exportPDF} title="Export branded PDF">
            🖨 PDF
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/expenses/new")}>
            ＋ New Expense
          </button>
        </div>
      </div>

      <div className="filter-tabs">
        {["all","pending","approved","rejected"].map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span style={{ marginLeft:"0.35rem", opacity:0.7, fontSize:"0.75rem" }}>
                ({expenses.filter(e => e.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No {filter === "all" ? "" : filter} expenses found.</p>
          <button className="btn btn-primary" onClick={() => navigate("/expenses/new")}>
            Submit your first expense
          </button>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id} style={parseFloat(exp.converted_amount||exp.amount)>POLICY_LIMIT?{background:"rgba(245,158,11,0.04)"}:{}}>
                  <td>
                    {parseFloat(exp.converted_amount||exp.amount)>POLICY_LIMIT&&(
                      <span title="Exceeds policy limit" style={{marginRight:"0.4rem",cursor:"help"}}>⚠️</span>
                    )}
                    {exp.description}
                  </td>
                  <td><span className="badge">{exp.category}</span></td>
                  <td>
                    <div style={{ fontWeight:600 }}>{exp.currency} {parseFloat(exp.amount).toFixed(2)}</div>
                    {exp.converted_amount && exp.currency !== exp.company_currency && (
                      <div style={{ fontSize:"0.73rem", color:"var(--text-muted)" }}>
                        ≈ {exp.company_currency} {parseFloat(exp.converted_amount).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                  <td>
                    <span className="status-badge" style={{ background:STATUS_COLORS[exp.status]+"22", color:STATUS_COLORS[exp.status] }}>
                      {exp.status}
                    </span>
                  </td>
                  <td style={{ color:"var(--text-muted)", fontSize:"0.83rem" }}>{exp.rejection_comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
