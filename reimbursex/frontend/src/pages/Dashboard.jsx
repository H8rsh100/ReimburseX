import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import WardenAI from "../components/WardenAI";

const CHART_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#ec4899","#06b6d4"];
const STATUS_COLORS = { approved:"#22c55e", rejected:"#ef4444", pending:"#f59e0b", draft:"#6b7280" };

const StatCard = ({ label, value, color, icon }) => (
  <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="stat-icon" style={{ color }}>{icon}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 40, cx = 50, cy = 50, circ = 2 * Math.PI * r;
  let cum = 0;
  const segs = data.map((d, i) => {
    const pct = total ? d.value / total : 0;
    const s = { ...d, pct, rotation: cum * 360, dash: pct * circ, i };
    cum += pct; return s;
  });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"1.25rem", flexWrap:"wrap" }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={12}/>
        {segs.map(s => s.pct > 0 && (
          <circle key={s.i} cx={cx} cy={cy} r={r} fill="none"
            stroke={CHART_COLORS[s.i % CHART_COLORS.length]} strokeWidth={12}
            strokeDasharray={`${s.dash} ${circ}`}
            style={{ transform:`rotate(${s.rotation-90}deg)`, transformOrigin:`${cx}px ${cy}px`, transition:"all 0.4s" }}/>
        ))}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem" }}>
        {segs.map(s => (
          <div key={s.i} style={{ display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.78rem" }}>
            <div style={{ width:8, height:8, borderRadius:2, background:CHART_COLORS[s.i%CHART_COLORS.length], flexShrink:0 }}/>
            <span style={{ color:"var(--text-secondary)" }}>{s.label}</span>
            <span style={{ color:"var(--text-muted)", marginLeft:"auto", paddingLeft:"0.5rem" }}>{Math.round(s.pct*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  if (!data.length) return <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>No data yet.</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:"0.75rem", height:100, padding:"0 0.5rem", justifyContent:"center" }}>
      {data.map((d, i) => (
        <div key={i} style={{ width:48, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"0.3rem" }}>
          <div style={{ fontSize:"0.65rem", color:"var(--text-muted)" }}>₹{(d.value/1000).toFixed(1)}k</div>
          <div style={{ width:"100%", height:Math.max(Math.round((d.value/max)*72),4), background:CHART_COLORS[i%CHART_COLORS.length], borderRadius:"4px 4px 0 0", transition:"height 0.4s" }}/>
          <div style={{ fontSize:"0.62rem", color:"var(--text-muted)", textAlign:"center", whiteSpace:"nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === "employee") {
          const r = await api.get("/expenses");
          setExpenses(r.data.expenses || []);
        } else if (user?.role === "manager") {
          const r = await api.get("/approvals/pending");
          setApprovals(r.data.approvals || []);
        } else if (user?.role === "admin") {
          const [eR, aR] = await Promise.all([api.get("/expenses/all"), api.get("/approvals/pending")]);
          setExpenses(eR.data.expenses || []);
          setApprovals(aR.data.approvals || []);
        }
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const total    = expenses.length;
  const approved = expenses.filter(e => e.status==="approved").length;
  const rejected = expenses.filter(e => e.status==="rejected").length;
  const pending  = expenses.filter(e => e.status==="pending").length;

  const categoryData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const k = e.category || "Other";
      map[k] = (map[k]||0) + parseFloat(e.converted_amount||e.amount||0);
    });
    return Object.entries(map).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,5);
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      if (!e.expense_date) return;
      const key = new Date(e.expense_date).toLocaleDateString("en-IN",{month:"short",year:"2-digit"});
      map[key] = (map[key]||0) + parseFloat(e.converted_amount||e.amount||0);
    });
    return Object.entries(map).map(([label,value])=>({label,value})).slice(-5);
  }, [expenses]);

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="page-subtitle">
            {user?.role==="employee" && "Track and manage your expense claims"}
            {user?.role==="manager" && "Review and approve your team's expenses"}
            {user?.role==="admin"   && "Full overview of company reimbursements"}
          </p>
        </div>
        {(user?.role==="employee"||user?.role==="admin") && (
          <button className="btn btn-primary" onClick={()=>navigate("/expenses/new")}>+ New Expense</button>
        )}
      </div>

      {(user?.role==="employee"||user?.role==="admin") && (
        <div className="stats-grid">
          <StatCard label="Total Submitted" value={total}    color="#6366f1" icon="📋"/>
          <StatCard label="Approved"        value={approved} color="#22c55e" icon="✅"/>
          <StatCard label="Pending"         value={pending}  color="#f59e0b" icon="⏳"/>
          <StatCard label="Rejected"        value={rejected} color="#ef4444" icon="❌"/>
        </div>
      )}
      {user?.role==="manager" && (
        <div className="stats-grid">
          <StatCard label="Pending Approvals" value={approvals.length} color="#f59e0b" icon="⏳"/>
        </div>
      )}
      {user?.role==="admin" && (
        <div className="stats-grid" style={{ marginTop:"1rem" }}>
          <StatCard label="Pending Approvals" value={approvals.length} color="#f59e0b" icon="⏳"/>
        </div>
      )}

      {/* ── Charts ── */}
      {expenses.length > 0 && categoryData.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", margin:"1.5rem 0" }}>
          <div className="card">
            <div className="card-header"><h2 className="card-title">📊 Spend by Category</h2></div>
            <DonutChart data={categoryData}/>
          </div>
          <div className="card">
            <div className="card-header"><h2 className="card-title">📈 Monthly Spending</h2></div>
            {monthlyData.length > 0 ? <BarChart data={monthlyData}/> : <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>No data yet.</p>}
          </div>
        </div>
      )}

      {/* WardenAI — admin only */}
      {user?.role==="admin" && (
        <WardenAI
          companyName={user?.company_name || "Your Company"}
          currency={user?.company_currency || user?.currency || "INR"}
        />
      )}

      {/* Recent expenses */}
      {expenses.length > 0 && (
        <div className="card" style={{ marginTop:"1rem" }}>
          <div className="card-header">
            <h2 className="card-title">Recent Expenses</h2>
            <button className="btn btn-ghost" onClick={()=>navigate("/expenses")}>View all →</button>
          </div>
          <table className="table">
            <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {expenses.slice(0,5).map(exp=>(
                <tr key={exp.id}>
                  <td>{exp.description}</td>
                  <td><span className="badge">{exp.category}</span></td>
                  <td>{exp.currency} {parseFloat(exp.amount).toFixed(2)}</td>
                  <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                  <td><span className="status-badge" style={{background:STATUS_COLORS[exp.status]+"22",color:STATUS_COLORS[exp.status]}}>{exp.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending approvals */}
      {(user?.role==="manager"||user?.role==="admin") && approvals.length > 0 && (
        <div className="card" style={{ marginTop:"1.5rem" }}>
          <div className="card-header">
            <h2 className="card-title">Pending Approvals</h2>
            <button className="btn btn-ghost" onClick={()=>navigate("/approvals")}>View all →</button>
          </div>
          <table className="table">
            <thead><tr><th>Employee</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {approvals.slice(0,5).map(a=>(
                <tr key={a.approval_action_id}>
                  <td>{a.employee_name}</td>
                  <td>{a.description}</td>
                  <td>{a.company_currency} {parseFloat(a.converted_amount||a.amount).toFixed(2)}</td>
                  <td>{new Date(a.expense_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
