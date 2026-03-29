import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import api from "../utils/api";

const icons = {
  dashboard: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  expenses: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  approvals: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  users: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  rules: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  logout: (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending count for badge (manager/admin only)
  useEffect(() => {
    if (user?.role === "manager" || user?.role === "admin") {
      const fetchPending = async () => {
        try {
          const r = await api.get("/approvals/pending");
          setPendingCount(r.data.approvals?.length || 0);
        } catch { /* silent */ }
      };
      fetchPending();
      const interval = setInterval(fetchPending, 30000); // refresh every 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  const navItems = [
    { to: "/dashboard",  label: "Dashboard",      icon: "dashboard", roles: ["admin","manager","employee"] },
    { to: "/expenses",   label: "My Expenses",     icon: "expenses",  roles: ["employee","admin"] },
    { to: "/approvals",  label: "Approvals",       icon: "approvals", roles: ["manager","admin"], badge: pendingCount },
    { to: "/users",      label: "Users",           icon: "users",     roles: ["admin"] },
    { to: "/rules",      label: "Approval Rules",  icon: "rules",     roles: ["admin"] },
  ].filter(item => item.roles.includes(user?.role));

  const roleColors = { admin: "#f59e0b", manager: "#22c55e", employee: "#6366f1" };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">RX</div>
        <div>
          <div className="brand-name">ReimburseX</div>
          <div className="brand-company">{user?.company_name || "Company"}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">{icons[item.icon]}</span>
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role" style={{ color: roleColors[user?.role] || "#6366f1" }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={() => { logout(); navigate("/login"); }}
          title="Logout"
        >
          {icons.logout}
        </button>
      </div>
    </aside>
  );
}
