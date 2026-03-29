import { useEffect, useState } from "react";
import api from "../utils/api";

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState({});
  const [acting, setActing] = useState(null);
  const [msg, setMsg] = useState("");

  const fetchApprovals = () => {
    api.get("/approvals/pending").then(r => {
      setApprovals(r.data.approvals || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchApprovals(); }, []);

  const handleAction = async (approvalId, action) => {
    setActing(approvalId + action);
    setMsg("");
    try {
      await api.post(`/approvals/${approvalId}/${action}`, { comment: comment[approvalId] || "" });
      setMsg(`Expense ${action}d successfully.`);
      setApprovals(prev => prev.filter(a => a.approval_action_id !== approvalId));
    } catch (e) {
      setMsg(e.response?.data?.message || "Action failed.");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review and action pending expense requests</p>
        </div>
        <div className="badge" style={{ fontSize: "1rem", padding: "0.4rem 1rem" }}>
          {approvals.length} pending
        </div>
      </div>

      {msg && <div className={`alert ${msg.includes("failed") ? "alert-error" : "alert-success"}`}>{msg}</div>}

      {approvals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>All caught up! No pending approvals.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {approvals.map(a => (
            <div className="card approval-card" key={a.approval_action_id}>
              <div className="approval-header">
                <div>
                  <div className="approval-employee">{a.employee_name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{a.employee_email}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="approval-amount">
                    {a.company_currency} {parseFloat(a.converted_amount || a.amount).toFixed(2)}
                  </div>
                  {a.currency !== a.company_currency && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Original: {a.currency} {parseFloat(a.amount).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="approval-meta">
                <span className="badge">{a.category}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {new Date(a.expense_date).toLocaleDateString()}
                </span>
                {a.step_number && (
                  <span style={{ color: "var(--accent)", fontSize: "0.8rem" }}>Step {a.step_number}</span>
                )}
              </div>

              <p style={{ margin: "0.75rem 0", color: "var(--text-secondary)" }}>{a.description}</p>

              {a.receipt_url && (
                <a href={a.receipt_url} target="_blank" rel="noreferrer"
                  style={{ color: "var(--accent)", fontSize: "0.85rem", display: "block", marginBottom: "0.75rem" }}>
                  📎 View Receipt
                </a>
              )}

              <div className="form-group">
                <input
                  className="form-input"
                  placeholder="Add a comment (optional)..."
                  value={comment[a.approval_action_id] || ""}
                  onChange={e => setComment(c => ({ ...c, [a.approval_action_id]: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn-success"
                  disabled={acting}
                  onClick={() => handleAction(a.approval_action_id, "approve")}
                >
                  {acting === a.approval_action_id + "approve" ? "..." : "✅ Approve"}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={acting}
                  onClick={() => handleAction(a.approval_action_id, "reject")}
                >
                  {acting === a.approval_action_id + "reject" ? "..." : "❌ Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
