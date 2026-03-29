import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const StatCard = ({ label, value, color, icon }) => (
  <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="stat-icon" style={{ color }}>{icon}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const STATUS_COLORS = {
  approved: "#22c55e",
  rejected: "#ef4444",
  pending: "#f59e0b",
  draft: "#6b7280",
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.role === "employee") {
          const res = await api.get("/expenses");
          setExpenses(res.data.expenses || []);
        } else if (user?.role === "manager") {
          const res = await api.get("/approvals/pending");
          setApprovals(res.data.approvals || []);
        } else if (user?.role === "admin") {
          const [expRes, apprRes] = await Promise.all([
            api.get("/expenses/all"),
            api.get("/approvals/pending"),
          ]);
          setExpenses(expRes.data.expenses || []);
          setApprovals(apprRes.data.approvals || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="page-loading">Loading...</div>;

  const total = expenses.length;
  const approved = expenses.filter(e => e.status === "approved").length;
  const rejected = expenses.filter(e => e.status === "rejected").length;
  const pending = expenses.filter(e => e.status === "pending").length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="page-subtitle">
            {user?.role === "employee" && "Track and manage your expense claims"}
            {user?.role === "manager" && "Review and approve your team's expenses"}
            {user?.role === "admin" && "Full overview of company reimbursements"}
          </p>
        </div>
        {(user?.role === "employee" || user?.role === "admin") && (
          <button className="btn btn-primary" onClick={() => navigate("/expenses/new")}>
            + New Expense
          </button>
        )}
      </div>

      {/* Employee / Admin stats */}
      {(user?.role === "employee" || user?.role === "admin") && (
        <div className="stats-grid">
          <StatCard label="Total Submitted" value={total} color="#6366f1" icon="📋" />
          <StatCard label="Approved" value={approved} color="#22c55e" icon="✅" />
          <StatCard label="Pending" value={pending} color="#f59e0b" icon="⏳" />
          <StatCard label="Rejected" value={rejected} color="#ef4444" icon="❌" />
        </div>
      )}

      {/* Manager pending */}
      {user?.role === "manager" && (
        <div className="stats-grid">
          <StatCard label="Pending Approvals" value={approvals.length} color="#f59e0b" icon="⏳" />
        </div>
      )}

      {/* Admin: pending approvals + all expenses */}
      {user?.role === "admin" && (
        <div className="stats-grid" style={{ marginTop: "1rem" }}>
          <StatCard label="Pending Approvals" value={approvals.length} color="#f59e0b" icon="⏳" />
        </div>
      )}

      {/* Recent expenses table */}
      {expenses.length > 0 && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <div className="card-header">
            <h2 className="card-title">Recent Expenses</h2>
            <button className="btn btn-ghost" onClick={() => navigate("/expenses")}>View all →</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 5).map(exp => (
                <tr key={exp.id}>
                  <td>{exp.description}</td>
                  <td><span className="badge">{exp.category}</span></td>
                  <td>{exp.currency} {parseFloat(exp.amount).toFixed(2)}</td>
                  <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                  <td>
                    <span className="status-badge" style={{ background: STATUS_COLORS[exp.status] + "22", color: STATUS_COLORS[exp.status] }}>
                      {exp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manager: pending approvals */}
      {(user?.role === "manager" || user?.role === "admin") && approvals.length > 0 && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <div className="card-header">
            <h2 className="card-title">Pending Approvals</h2>
            <button className="btn btn-ghost" onClick={() => navigate("/approvals")}>View all →</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {approvals.slice(0, 5).map(a => (
                <tr key={a.id}>
                  <td>{a.employee_name}</td>
                  <td>{a.description}</td>
                  <td>{a.company_currency} {parseFloat(a.converted_amount || a.amount).toFixed(2)}</td>
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
