import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"];

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company_name: "",
    country: "",
    currency: "USD",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Derive currency from country
  useEffect(() => {
    if (form.country) {
      fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(form.country)}?fields=currencies`)
        .then(r => r.json())
        .then(data => {
          if (data[0]?.currencies) {
            const currencyCode = Object.keys(data[0].currencies)[0];
            setForm(f => ({ ...f, currency: currencyCode || "USD" }));
          }
        })
        .catch(() => {});
    }
  }, [form.country]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="brand-icon">₹</div>
          <div>
            <div className="brand-name">ReimburseX</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              Expense Management
            </div>
          </div>
        </div>

        <div>
          <div className="auth-title">Create your company</div>
          <div className="auth-sub">Set up your workspace in seconds</div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Your Full Name *</label>
            <input
              className="form-input"
              name="name"
              placeholder="Harsh Patel"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Work Email *</label>
            <input
              className="form-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              className="form-input"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input
              className="form-input"
              name="company_name"
              placeholder="Acme Corp"
              value={form.company_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Country</label>
              <input
                className="form-input"
                name="country"
                placeholder="India"
                value={form.country}
                onChange={handleChange}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Base Currency</label>
              <select
                className="form-input"
                name="currency"
                value={form.currency}
                onChange={handleChange}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
          >
            {loading ? "Creating workspace..." : "Create workspace"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
