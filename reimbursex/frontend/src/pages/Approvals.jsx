import { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

const STATUS_COLORS = { approved:"#22c55e", rejected:"#ef4444", pending:"#f59e0b" };

/* ── Pure JS canvas confetti ────────────── */
function launchConfetti() {
  const colors = ["#6366f1","#22c55e","#f59e0b","#ec4899","#06b6d4","#a78bfa"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: ${Math.random() * -10}px;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

/* ── History Timeline Item ──────────────── */
function TimelineItem({ item }) {
  const isApproved = item.status === "approved";
  return (
    <div className="timeline-item">
      <div className="timeline-line"/>
      <div
        className="timeline-dot"
        style={{
          background: isApproved ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          color: isApproved ? "var(--success)" : "var(--danger)"
        }}
      >
        {isApproved ? "✓" : "✕"}
      </div>
      <div className="timeline-content">
        <div className="timeline-title">{item.employee_name} — {item.description}</div>
        <div className="timeline-meta">
          {item.company_currency} {parseFloat(item.converted_amount || item.amount).toFixed(2)}
          {" · "}{new Date(item.acted_at || item.created_at).toLocaleDateString()}
          {" · "}<span style={{ color: STATUS_COLORS[item.status], fontWeight:600 }}>{item.status}</span>
        </div>
        {item.comment && <div className="timeline-comment">"{item.comment}"</div>}
      </div>
    </div>
  );
}

export default function Approvals() {
  const [tab, setTab] = useState("pending"); // "pending" | "history"
  const [approvals, setApprovals] = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [comment, setComment]     = useState({});
  const [acting, setActing]       = useState(null);
  const [msg, setMsg]             = useState("");

  const fetchApprovals = useCallback(() => {
    api.get("/approvals/pending").then(r => {
      setApprovals(r.data.approvals || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fetchHistory = useCallback(() => {
    setHistLoading(true);
    api.get("/approvals/history").then(r => {
      setHistory(r.data.history || []);
    }).catch(console.error).finally(() => setHistLoading(false));
  }, []);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  useEffect(() => {
    if (tab === "history" && history.length === 0) fetchHistory();
  }, [tab, history.length, fetchHistory]);

  const handleAction = async (approvalId, action) => {
    setActing(approvalId + action);
    setMsg("");
    try {
      await api.post(`/approvals/${approvalId}/${action}`, { comment: comment[approvalId] || "" });
      if (action === "approve") launchConfetti();
      setMsg(`Expense ${action}d successfully.`);
      setApprovals(prev => prev.filter(a => a.approval_action_id !== approvalId));
      // Refresh history cache
      setHistory([]);
    } catch (e) {
      setMsg(e.response?.data?.message || "Action failed.");
    } finally {
      setActing(null);
    }
  };

  if (loading) return (
    <div className="page-loading"><div className="spinner"/><span>Loading...</span></div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review and action pending expense requests</p>
        </div>
        <div className="badge" style={{ fontSize:"1rem", padding:"0.4rem 1rem" }}>
          {approvals.length} pending
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-tabs">
        <button className={`filter-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          ⏳ Pending {approvals.length > 0 && `(${approvals.length})`}
        </button>
        <button className={`filter-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          📜 History
        </button>
      </div>

      {msg && <div className={`alert ${msg.includes("failed") || msg.includes("Failed") ? "alert-error" : "alert-success"}`}>{msg}</div>}

      {/* ── Pending Tab ── */}
      {tab === "pending" && (
        approvals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>All caught up! No pending approvals.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {approvals.map(a => (
              <div className="card approval-card" key={a.approval_action_id}>
                <div className="approval-header">
                  <div>
                    <div className="approval-employee">{a.employee_name}</div>
                    <div style={{ color:"var(--text-muted)", fontSize:"0.83rem" }}>{a.employee_email}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div className="approval-amount">{a.company_currency} {parseFloat(a.converted_amount || a.amount).toFixed(2)}</div>
                    {a.currency !== a.company_currency && (
                      <div style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>
                        Original: {a.currency} {parseFloat(a.amount).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="approval-meta">
                  <span className="badge">{a.category}</span>
                  <span style={{ color:"var(--text-muted)", fontSize:"0.83rem" }}>
                    {new Date(a.expense_date).toLocaleDateString()}
                  </span>
                  {a.step_number && (
                    <span style={{ color:"var(--accent)", fontSize:"0.78rem", fontWeight:600 }}>Step {a.step_number}</span>
                  )}
                </div>

                <p style={{ margin:"0.75rem 0", color:"var(--text-secondary)" }}>{a.description}</p>

                {a.receipt_url && (
                  <a href={a.receipt_url} target="_blank" rel="noreferrer"
                    style={{ color:"var(--accent)", fontSize:"0.85rem", display:"block", marginBottom:"0.75rem" }}>
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

                <div style={{ display:"flex", gap:"0.75rem", marginTop:"0.75rem" }}>
                  <button
                    className="btn btn-success"
                    disabled={!!acting}
                    onClick={() => handleAction(a.approval_action_id, "approve")}
                  >
                    {acting === a.approval_action_id + "approve" ? "..." : "✅ Approve"}
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={!!acting}
                    onClick={() => handleAction(a.approval_action_id, "reject")}
                  >
                    {acting === a.approval_action_id + "reject" ? "..." : "❌ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        histLoading ? (
          <div className="page-loading"><div className="spinner"/></div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No approval history yet.</p>
          </div>
        ) : (
          <div className="card">
            <div className="timeline">
              {history.map((item, i) => (
                <TimelineItem key={`${item.expense_id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
