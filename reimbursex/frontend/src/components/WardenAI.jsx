import { useState } from "react";
import api from "../utils/api";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const COLORS = { "The Leak": "#ef4444", "The Bottleneck": "#f59e0b", "The Strategy": "#6366f1" };
const ICONS = { "The Leak": "🕳️", "The Bottleneck": "⏱️", "The Strategy": "🎯" };

function extractJsonObject(rawText) {
  const text = (rawText || "").replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI returned an invalid response format");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export default function WardenAI({ companyName, currency }) {
  const [scanning, setScanning] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");

  const runScan = async () => {
    if (!GEMINI_KEY) {
      setError("Missing VITE_GEMINI_API_KEY in frontend/.env");
      return;
    }

    setScanning(true); setError(""); setInsights(null);
    try {
      const res = await api.get("/expenses/all");
      const raw = (res.data.expenses || []).slice(0, 50);
      const expenseJSON = JSON.stringify(raw.map((e) => ({
        employee: e.employee_name,
        category: e.category,
        amount: parseFloat(e.converted_amount || e.amount),
        currency: e.company_currency || currency,
        date: e.expense_date,
        status: e.status,
        description: e.description,
      })));

      const prompt = `You are 'WardenAI', the strategic financial auditor for ReimburseX. You are brilliant, slightly witty, and obsessed with company efficiency.

Company: ${companyName}
Policy: Flag expenses over ${currency} 10,000.
Last ${raw.length} expenses: ${expenseJSON}

Perform a "Deep Scan" and return EXACTLY this JSON (no markdown, no backticks, raw JSON only):
{
  "insights": [
    {
      "title": "The Leak",
      "headline": "<one sharp sentence about wasteful spending or threshold-dodging>",
      "detail": "• <point 1>\n• <point 2>\n• <point 3>"
    },
    {
      "title": "The Bottleneck",
      "headline": "<one sharp sentence about approval slowdowns>",
      "detail": "• <point 1>\n• <point 2>\n• <point 3>"
    },
    {
      "title": "The Strategy",
      "headline": "<one sharp sentence proposing a specific Hybrid Approval Rule>",
      "detail": "• <rule suggestion>\n• <expected benefit>\n• <implementation tip>"
    }
  ]
}`;

      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );
      const data = await gemRes.json();
      if (!gemRes.ok) {
        const msg = data.error?.message || JSON.stringify(data.error) || "Gemini API error";
        throw new Error(msg);
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extractJsonObject(text);
      setInsights(parsed.insights);
    } catch (err) {
      setError(`Scan failed — ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="card warden-card">
      <div className="card-header">
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"1.6rem" }}>🛡️</span>
          <div>
            <h2 className="card-title" style={{ fontSize:"1.05rem" }}>WardenAI</h2>
            <p style={{ fontSize:"0.76rem", color:"var(--text-muted)", marginTop:2 }}>
              Proactive financial intelligence — {companyName}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={runScan} disabled={scanning} style={{ minWidth:150 }}>
          {scanning
            ? <span style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <span className="spinner" style={{ width:14, height:14, borderWidth:2 }}/> Scanning...
              </span>
            : "🔍 Run Deep Scan"}
        </button>
      </div>

      {!insights && !scanning && !error && (
        <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", paddingTop:"0.5rem" }}>
          Click <strong style={{ color:"var(--text-secondary)" }}>Run Deep Scan</strong> to detect spending leaks, slow approvers, and get AI-suggested policy rules.
        </p>
      )}

      {error && <div className="alert alert-error" style={{ marginTop:"1rem" }}>{error}</div>}

      {insights && (
        <div className="warden-grid">
          {insights.map((ins, i) => (
            <div key={i} className="warden-insight" style={{ borderTop:`3px solid ${COLORS[ins.title]||"#6366f1"}` }}>
              <div className="warden-insight-title">
                <span>{ICONS[ins.title]||"💡"}</span>
                <span style={{ color:COLORS[ins.title]||"#6366f1", fontWeight:700 }}>{ins.title}</span>
              </div>
              <p className="warden-insight-headline">{ins.headline}</p>
              <div className="warden-insight-detail">
                {ins.detail.split("•").filter(Boolean).map((pt, j) => (
                  <div key={j} style={{ display:"flex", gap:"0.4rem", marginBottom:"0.3rem" }}>
                    <span style={{ color:COLORS[ins.title]||"#6366f1", flexShrink:0 }}>•</span>
                    <span>{pt.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
