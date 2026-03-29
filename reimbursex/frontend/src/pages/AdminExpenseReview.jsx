import { useEffect, useState } from "react";
import api from "../utils/api";

const STATUS_COLORS = { approved: "#22c55e", rejected: "#ef4444", pending: "#f59e0b" };

export default function AdminExpenseReview() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [audit, setAudit] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  const exportAuditPDF = () => {
    if (!selected) {
      alert("Select an expense first.");
      return;
    }

    const title = `Audit_Report_Expense_${selected.id}_${new Date().toISOString().split("T")[0]}`;
    const rows = audit.map(a => (
      `<tr>
         <td>${new Date(a.acted_at || a.created_at).toLocaleString()}</td>
         <td>${a.status}</td>
         <td>${a.approver_name || "System"}</td>
         <td>${a.comment || "-"}</td>
       </tr>`
    )).join("");

    const payload = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; }
            h1,h2 { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>Expense Audit Report</h1>
          <h2>${selected.description}</h2>
          <p><strong>Employee:</strong> ${selected.employee_name}<br />
             <strong>Amount:</strong> ${selected.company_currency} ${Number(selected.converted_amount || selected.amount).toFixed(2)}<br />
             <strong>Status:</strong> ${selected.status}</p>
          <h3>Audit History</h3>
          <table>
            <thead>
              <tr>
                <th>Date/Time</th><th>Status</th><th>Approver</th><th>Comment</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" style="text-align:center;">No audit entries</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (printWindow) {
      printWindow.document.write(payload);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      alert("Unable to open print window. Please allow popups and try again.");
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const r = await api.get("/expenses/all");
      setExpenses(r.data.expenses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (expenseId) => {
    try {
      const r = await api.get(`/expenses/${expenseId}/audit`);
      setSelected(r.data.expense);
      setAudit(r.data.audit || []);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load audit trail");
    }
  };

  const handleAdminOverride = async (expenseId, newStatus) => {
    if (!window.confirm(`Are you sure you want to ${newStatus} this expense?`)) return;
    const comment = window.prompt("Optional override comment:", "") || "";

    setActionLoading(`${expenseId}-${newStatus}`);
    try {
      await api.post(`/expenses/${expenseId}/override`, { status: newStatus, comment });
      await loadExpenses();
      if (selected?.id === expenseId) await loadAudit(expenseId);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Override failed.");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const getfiltered = () => expenses;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Expense Review</h1>
          <p className="page-subtitle">Full company expense audit and override controls</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1rem" }}>
        <div className="card">
          {loading ? (
            <div className="page-loading">Loading...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getfiltered().map((e, idx) => (
                  <tr key={e.id}>
                    <td>{idx + 1}</td>
                    <td>{e.employee_name}</td>
                    <td>{e.description}</td>
                    <td>{e.company_currency} {Number(e.converted_amount || e.amount).toFixed(2)}</td>
                    <td>
                      <span className="status-badge" style={{ background: STATUS_COLORS[e.status] + "22", color: STATUS_COLORS[e.status] }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => loadAudit(e.id)}>History</button>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAdminOverride(e.id, "approved")}
                        disabled={actionLoading === `${e.id}-approved` || e.status === "approved"}
                      >{actionLoading === `${e.id}-approved` ? "..." : "Approve"}</button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleAdminOverride(e.id, "rejected")}
                        disabled={actionLoading === `${e.id}-rejected` || e.status === "rejected"}
                      >{actionLoading === `${e.id}-rejected` ? "..." : "Reject"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3>Audit Trail</h3>
            <button className="btn btn-secondary btn-sm" onClick={exportAuditPDF} disabled={!selected}>
              📄 Export PDF
            </button>
          </div>
          {selected ? (
            <>
              <div style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                <strong>{selected.description}</strong><br />
                {selected.employee_name} • {selected.company_currency} {Number(selected.converted_amount || selected.amount).toFixed(2)}
              </div>
              {audit.length === 0 ? (
                <div style={{ color: "var(--text-muted)" }}>No actions recorded yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {audit.map((a) => (
                    <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.83rem" }}>
                        <span>{a.status.toUpperCase()} by {a.approver_name || "System"}</span>
                        <span>{a.acted_at ? new Date(a.acted_at).toLocaleString() : new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop: "0.25rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {a.comment || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "var(--text-muted)" }}>Select an expense to see audit details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
