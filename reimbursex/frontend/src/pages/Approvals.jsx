import { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
  const [aiSuggesting, setAiSuggesting] = useState(null); // holds approval_action_id while loading

  // ── AI: suggest a rejection reason for a given expense ──────────
  const suggestRejection = useCallback(async (a) => {
    if (!GEMINI_API_KEY) {
      setComment(c => ({ ...c, [a.approval_action_id]: "Insufficient documentation provided." }));
      return;
    }
    setAiSuggesting(a.approval_action_id);
    try {
      const prompt = `You are a corporate finance manager reviewing an expense claim. Write ONE concise, professional rejection reason (max 20 words) specific to this expense. Be direct and factual — no preamble, no quotes.

Expense details:
- Employee: ${a.employee_name}
- Category: ${a.category}
- Amount: ${a.company_currency} ${parseFloat(a.converted_amount || a.amount).toFixed(2)}
- Description: ${a.description}
- Date: ${a.expense_date?.slice(0,10)}

Return only the rejection reason sentence.`;

      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 80 },
        }),
      });

      if (!res.ok) throw new Error("Gemini error");
      const data = await res.json();
      const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (suggestion) {
        setComment(c => ({ ...c, [a.approval_action_id]: suggestion }));
      }
    } catch (err) {
      console.error("AI suggest failed:", err);
    } finally {
      setAiSuggesting(null);
    }
  }, []);

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

                <div className="form-group" style={{ position: "relative" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <input
                      className="form-input"
                      placeholder="Add a comment (optional)..."
                      value={comment[a.approval_action_id] || ""}
                      onChange={e => setComment(c => ({ ...c, [a.approval_action_id]: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      title="AI-suggest a rejection reason"
                      disabled={aiSuggesting === a.approval_action_id}
                      onClick={() => suggestRejection(a)}
                      style={{
                        flexShrink: 0,
                        padding: "0.55rem 0.8rem",
                        background: aiSuggesting === a.approval_action_id
                          ? "var(--surface)"
                          : "linear-gradient(135deg,#6366f1,#a78bfa)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "var(--radius)",
                        cursor: aiSuggesting === a.approval_action_id ? "not-allowed" : "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                      }}
                    >
                      {aiSuggesting === a.approval_action_id ? (
                        <>
                          <span className="spinner" style={{ width:12, height:12, border:"2px solid #ffffff44", borderTopColor:"#fff" }}/>
                          Thinking…
                        </>
                      ) : (
                        <>✦ AI Suggest</>
                      )}
                    </button>
                  </div>
                  {comment[a.approval_action_id] && (
                    <div style={{
                      marginTop: "0.4rem",
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      paddingLeft: "0.25rem"
                    }}>
                      ✦ AI-generated · edit freely before rejecting
                    </div>
                  )}
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
