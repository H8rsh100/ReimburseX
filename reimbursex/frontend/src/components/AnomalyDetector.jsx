import { useState, useCallback } from "react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Retry up to 2 times with exponential back-off for 429 rate-limit errors
async function geminiRequest(body, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const errText = res.status === 429
        ? "Rate limit reached. Wait ~30 s and try again."
        : `Gemini error ${res.status}`;
      throw new Error(errText);
    }
    return res.json();
  }
}

const SEV_CONFIG = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   icon: "🚨", label: "High Risk" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  icon: "⚠️", label: "Warning"   },
  low:    { color: "#6366f1", bg: "rgba(99,102,241,0.10)",  icon: "💡", label: "Info"       },
};

export default function AnomalyDetector({ expenses = [], currency = "INR" }) {
  const [anomalies, setAnomalies] = useState(null); // null = not run yet
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState(null);

  const runAnalysis = useCallback(async () => {
    if (!GEMINI_API_KEY) {
      setError("Gemini API key missing (VITE_GEMINI_API_KEY).");
      return;
    }
    if (!expenses.length) {
      setError("No expenses to analyse.");
      return;
    }

    setLoading(true);
    setError("");
    setAnomalies(null);

    // Trim to essentials so we stay within token limits
    const slim = expenses.slice(0, 60).map(e => ({
      id:           e.id,
      employee:     e.employee_name || `emp-${e.employee_id}`,
      amount:       parseFloat(e.converted_amount || e.amount),
      currency:     e.company_currency || e.currency,
      category:     e.category,
      description:  e.description,
      date:         e.expense_date?.slice(0, 10),
      status:       e.status,
    }));

    const prompt = `
You are an expert corporate expense-audit AI for a company using ${currency} as base currency.
Analyse the following expense claims and identify up to 6 anomalies or red-flags.

Rules to flag:
1. Duplicate/very-similar claims (same employee, same amount within 3 days, or nearly identical description).
2. High-value outliers (amounts far above average for their category).
3. Weekend or holiday submissions that look suspicious (Sat/Sun dates).
4. Round-number fraud risk (e.g., exactly 5000, 10000 – no odd cents).
5. Mismatched category & description (e.g., "dog food" under Training).
6. Stale claims (expense date more than 60 days old).
7. Unusually frequent claims from one employee.

Return ONLY a valid JSON array (no markdown, no extra text):
[
  {
    "severity": "high | medium | low",
    "expense_id": <number or null>,
    "employee": "<name or null>",
    "title": "<very short flag title, max 6 words>",
    "detail": "<one sentence explanation, specific to the data>"
  }
]

If no anomalies found, return: []

Expense data:
${JSON.stringify(slim)}
`.trim();

    try {
      const data = await geminiRequest({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      });
      const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnomalies(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.error("Anomaly analysis failed:", err);
      setError(err.message || "AI analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [expenses, currency]);

  const hasRun = anomalies !== null;

  return (
    <div className="card" style={{ marginTop: "1.5rem", overflow: "hidden" }}>
      {/* Header */}
      <div className="card-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{
            background: "linear-gradient(135deg,#ef4444,#f97316)",
            borderRadius: "8px", padding: "4px 8px", fontSize: "0.85rem"
          }}>🛡️</span>
          AI Anomaly Detector
          <span style={{
            fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: "0.2rem"
          }}>· Gemini-powered risk analysis</span>
        </h2>

        <button
          className={`btn ${loading ? "btn-ghost" : "btn-primary"}`}
          onClick={runAnalysis}
          disabled={loading}
          style={{
            background: loading
              ? undefined
              : "linear-gradient(135deg,#ef4444,#f97316)",
            border: "none",
            minWidth: 160,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="spinner" style={{ width: 14, height: 14, border: "2px solid #fff3", borderTopColor: "#fff" }} />
              Scanning...
            </span>
          ) : hasRun ? "🔄 Re-run Analysis" : "🔍 Run AI Analysis"}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "1rem 1.25rem" }}>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>
        )}

        {/* Pre-run state */}
        {!hasRun && !loading && !error && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "2rem 1rem", gap: "0.75rem",
            color: "var(--text-muted)", textAlign: "center"
          }}>
            <span style={{ fontSize: "2.5rem" }}>🛡️</span>
            <p style={{ fontSize: "0.9rem", maxWidth: 420, lineHeight: 1.6 }}>
              Click <strong style={{ color: "var(--text-primary)" }}>Run AI Analysis</strong> to let Gemini scan your
              expense claims for duplicates, outliers, policy violations, and fraud signals.
            </p>
          </div>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem 0" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 68, borderRadius: 10,
                background: "linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
                opacity: 1 - i * 0.2,
              }} />
            ))}
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Gemini is analysing {expenses.length} expense records…
            </p>
          </div>
        )}

        {/* Results */}
        {hasRun && !loading && (
          anomalies.length === 0 ? (
            <div style={{
              display: "flex", alignItems: "center", gap: "1rem",
              padding: "1.25rem", borderRadius: 12,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)"
            }}>
              <span style={{ fontSize: "2rem" }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--success)", fontSize: "0.95rem" }}>
                  All Clear — No Anomalies Detected
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  {expenses.length} expenses scanned. Everything looks compliant.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                Found <strong style={{ color: "var(--text-primary)" }}>{anomalies.length}</strong> potential issue{anomalies.length !== 1 ? "s" : ""} across {expenses.length} expense records.
              </p>

              {anomalies.map((a, i) => {
                const cfg = SEV_CONFIG[a.severity] || SEV_CONFIG.low;
                const isOpen = expanded === i;
                return (
                  <div
                    key={i}
                    onClick={() => setExpanded(isOpen ? null : i)}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${cfg.color}44`,
                      background: cfg.bg,
                      padding: "0.85rem 1.1rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{cfg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: "0.06em", color: cfg.color,
                            background: `${cfg.color}22`, borderRadius: 20,
                            padding: "0.15rem 0.55rem"
                          }}>{cfg.label}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                            {a.title}
                          </span>
                          {a.employee && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              · {a.employee}
                            </span>
                          )}
                          {a.expense_id && (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              #EXP-{a.expense_id}
                            </span>
                          )}
                        </div>
                        {isOpen && (
                          <p style={{
                            marginTop: "0.5rem", fontSize: "0.83rem",
                            color: "var(--text-secondary)", lineHeight: 1.55
                          }}>
                            {a.detail}
                          </p>
                        )}
                      </div>
                      <span style={{
                        color: "var(--text-muted)", fontSize: "0.75rem", flexShrink: 0,
                        transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none"
                      }}>▼</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
