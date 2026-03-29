import { useEffect, useState } from "react";
import api from "../utils/api";

const ROLES = ["employee", "manager", "admin"];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", manager_id: "" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = () => {
    api.get("/users").then(r => setUsers(r.data.users || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const managers = users.filter(u => u.role === "manager" || u.role === "admin");

  const handleSubmit = async e => {
    e.preventDefault();
    setError(""); setMsg("");
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editId) {
        await api.put(`/users/${editId}`, payload);
        setMsg("User updated.");
      } else {
        await api.post("/users", payload);
        setMsg("User created.");
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: "", email: "", password: "", role: "employee", manager_id: "" });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed.");
    }
  };

  const handleEdit = user => {
    setEditId(user.id);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, manager_id: user.manager_id || "" });
    setShowForm(true);
    setMsg(""); setError("");
  };

  const handleDelete = async id => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      setMsg("User deleted.");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed.");
    }
  };

  const roleColor = { admin: "#6366f1", manager: "#f59e0b", employee: "#22c55e" };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Create and manage company users and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ name:"",email:"",password:"",role:"employee",manager_id:"" }); }}>
          + Add User
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? "Edit User" : "Create User"}</h2>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{editId ? "New Password (leave blank to keep)" : "Password *"}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} required={!editId} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.role === "employee" && (
                <div className="form-group">
                  <label className="form-label">Manager</label>
                  <select className="form-input" value={form.manager_id} onChange={e => setForm(f=>({...f,manager_id:e.target.value}))}>
                    <option value="">— No manager —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editId ? "Update" : "Create"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Manager</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: roleColor[u.role] + "33", color: roleColor[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      {u.name}
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{u.email}</td>
                  <td>
                    <span className="status-badge" style={{ background: roleColor[u.role] + "22", color: roleColor[u.role] }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {users.find(m => m.id === u.manager_id)?.name || "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(u)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
