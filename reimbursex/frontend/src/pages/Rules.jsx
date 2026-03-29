import { useEffect, useState } from "react";
import api from "../utils/api";

const RULE_TYPES = ["sequential", "percentage", "specific_approver", "hybrid"];

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", rule_type: "sequential", min_amount: "", max_amount: "",
    percentage_threshold: "", specific_approver_id: "",
    steps: [{ approver_id: "", step_number: 1, is_manager_approver: false }],
  });

  const fetchAll = async () => {
    try {
      const [rRes, uRes] = await Promise.all([api.get("/rules"), api.get("/users")]);
      setRules(rRes.data.rules || []);
      setUsers(uRes.data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const approvers = users.filter(u => u.role === "manager" || u.role === "admin");

  const addStep = () => setForm(f => ({
    ...f,
    steps: [...f.steps, { approver_id: "", step_number: f.steps.length + 1, is_manager_approver: false }]
  }));

  const removeStep = idx => setForm(f => ({
    ...f,
    steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 }))
  }));

  const updateStep = (idx, field, val) => setForm(f => ({
    ...f,
    steps: f.steps.map((s, i) => i === idx ? { ...s, [field]: val } : s)
  }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(""); setMsg("");
    try {
      const payload = {
        name: form.name,
        rule_type: form.rule_type,
        min_amount: form.min_amount || null,
        max_amount: form.max_amount || null,
        percentage_threshold: form.percentage_threshold || null,
        specific_approver_id: form.specific_approver_id || null,
        steps: form.steps,
      };
      await api.post("/rules", payload);
      setMsg("Approval rule created!");
      setShowForm(false);
      setForm({ name:"", rule_type:"sequential", min_amount:"", max_amount:"", percentage_threshold:"", specific_approver_id:"", steps:[{approver_id:"",step_number:1,is_manager_approver:false}] });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed.");
    }
  };

  const handleDelete = async id => {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await api.delete(`/rules/${id}`);
      setMsg("Rule deleted.");
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed.");
    }
  };

  const ruleTypeColor = { sequential: "#6366f1", percentage: "#f59e0b", specific_approver: "#22c55e", hybrid: "#ec4899" };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval Rules</h1>
          <p className="page-subtitle">Configure multi-level approval workflows and thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Rule</button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Approval Rule</h2>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Rule Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
              </div>

              <div className="form-group">
                <label className="form-label">Rule Type *</label>
                <select className="form-input" value={form.rule_type} onChange={e => setForm(f=>({...f,rule_type:e.target.value}))}>
                  {RULE_TYPES.map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Min Amount (optional)</label>
                  <input className="form-input" type="number" value={form.min_amount} onChange={e => setForm(f=>({...f,min_amount:e.target.value}))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Max Amount (optional)</label>
                  <input className="form-input" type="number" value={form.max_amount} onChange={e => setForm(f=>({...f,max_amount:e.target.value}))} />
                </div>
              </div>

              {(form.rule_type === "percentage" || form.rule_type === "hybrid") && (
                <div className="form-group">
                  <label className="form-label">Approval Threshold % (e.g., 60)</label>
                  <input className="form-input" type="number" min="1" max="100" value={form.percentage_threshold}
                    onChange={e => setForm(f=>({...f,percentage_threshold:e.target.value}))} />
                </div>
              )}

              {(form.rule_type === "specific_approver" || form.rule_type === "hybrid") && (
                <div className="form-group">
                  <label className="form-label">Key Approver (auto-approves on their action)</label>
                  <select className="form-input" value={form.specific_approver_id} onChange={e => setForm(f=>({...f,specific_approver_id:e.target.value}))}>
                    <option value="">— Select —</option>
                    {approvers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <label className="form-label" style={{ margin: 0 }}>Approval Steps</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addStep}>+ Add Step</button>
                </div>
                {form.steps.map((step, idx) => (
                  <div key={idx} className="step-row">
                    <span className="step-number">Step {step.step_number}</span>
                    <select className="form-input" value={step.approver_id} onChange={e => updateStep(idx, "approver_id", e.target.value)} style={{ flex: 1 }}>
                      <option value="">— Select approver —</option>
                      {approvers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={step.is_manager_approver}
                        onChange={e => updateStep(idx, "is_manager_approver", e.target.checked)} />
                      Manager approver
                    </label>
                    {form.steps.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStep(idx)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Rule</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⚙️</div>
          <p>No approval rules configured yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create your first rule</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {rules.map(rule => (
            <div className="card" key={rule.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <h3 style={{ color: "var(--text-primary)" }}>{rule.name}</h3>
                    <span className="status-badge" style={{ background: (ruleTypeColor[rule.rule_type]||"#6366f1") + "22", color: ruleTypeColor[rule.rule_type]||"#6366f1" }}>
                      {rule.rule_type?.replace("_"," ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {rule.min_amount && <span>Min: {rule.min_amount}</span>}
                    {rule.max_amount && <span>Max: {rule.max_amount}</span>}
                    {rule.percentage_threshold && <span>Threshold: {rule.percentage_threshold}%</span>}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id)}>Delete</button>
              </div>

              {rule.steps && rule.steps.length > 0 && (
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {rule.steps.sort((a,b) => a.step_number - b.step_number).map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ background: "var(--surface-hover)", borderRadius: "6px", padding: "0.35rem 0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {s.step_number}. {s.approver_name || `User #${s.approver_id}`}
                        {s.is_manager_approver && <span style={{ color: "var(--accent)", marginLeft: "0.3rem" }}>★</span>}
                      </div>
                      {i < rule.steps.length - 1 && <span style={{ color: "var(--text-muted)" }}>→</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
