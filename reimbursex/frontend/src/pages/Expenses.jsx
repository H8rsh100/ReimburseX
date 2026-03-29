import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const STATUS_COLORS = {
  approved: "#22c55e",
  rejected: "#ef4444",
  pending: "#f59e0b",
  draft: "#6b7280",
};

const POLICY_LIMIT = 10000; // ⚠️ Flag expenses above this (company currency)

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/expenses").then(r => {
      setExpenses(r.data.expenses || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? expenses : expenses.filter(e => e.status === filter);

  const exportCSV = () => {
    const header = ["Description","Category","Amount","Currency","Date","Status","Comment"];
    const rows = filtered.map(e => [
      `"${(e.description||"").replace(/"/g,'""')}"`,
      e.category, e.amount, e.currency,
      e.expense_date, e.status, e.rejection_comment||""
    ]);
    const csv = [header,...rows].map(r=>r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"),{
      href: URL.createObjectURL(new Blob([csv],{type:"text/csv"})),
      download: `expenses_${new Date().toISOString().split("T")[0]}.csv`
    });
    a.click();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Expenses</h1>
          <p className="page-subtitle">Submit and track your reimbursement claims</p>
        </div>
        <div style={{ display:"flex", gap:"0.75rem" }}>
          <button className="btn btn-secondary" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn btn-primary" onClick={() => navigate("/expenses/new")}>+ New Expense</button>
        </div>
      </div>

      <div className="filter-tabs">
        {["all","pending","approved","rejected"].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No {filter === "all" ? "" : filter} expenses found.</p>
          <button className="btn btn-primary" onClick={() => navigate("/expenses/new")}>Submit your first expense</button>
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
                      <span title="High value — exceeds policy limit" style={{marginRight:"0.4rem",cursor:"help"}}>⚠️</span>
                    )}
                    {exp.description}
                  </td>
                  <td><span className="badge">{exp.category}</span></td>
                  <td>
                    <div>{exp.currency} {parseFloat(exp.amount).toFixed(2)}</div>
                    {exp.converted_amount && exp.currency !== exp.company_currency && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        ≈ {exp.company_currency} {parseFloat(exp.converted_amount).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                  <td>
                    <span className="status-badge" style={{ background: STATUS_COLORS[exp.status] + "22", color: STATUS_COLORS[exp.status] }}>
                      {exp.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{exp.rejection_comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
