import { useState } from "react";
import api from "../utils/api";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const COLORS = { "The Leak": "#ef4444", "The Bottleneck": "#f59e0b", "The Strategy": "#6366f1" };
const ICONS = { "The Leak": "🕳️", "The Bottleneck": "⏱️", "The Strategy": "🎯" };

function extractJsonObject(rawText) {
  const text = (rawText || "").replace(/```json|```/g, "").trim();
  if (!text) {
    throw new Error("AI returned an empty response");
  }

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (!objMatch) {
    throw new Error("AI returned an invalid response format");
  }

  try {
    return JSON.parse(objMatch[0]);
  } catch {
    const cleaned = objMatch[0]
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    return JSON.parse(cleaned);
  }
}

function normalizeInsights(payload, fallbackText) {
  const list = payload?.insights;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item, idx) => ({
      title: item?.title || `Insight ${idx + 1}`,
      headline: item?.headline || "No headline provided",
      detail: item?.detail || "• No additional details",
    }));
  }

  const line = (fallbackText || "").replace(/\s+/g, " ").trim();
  return [
    {
      title: "The Strategy",
      headline: line || "AI response received, but in an unexpected format.",
      detail: "• Try running the scan again for structured insights",
    },
  ];
}

function buildLocalInsights(expenses, currency) {
  const threshold = 10000;
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const highValue = expenses.filter((e) => (Number(e.amount) || 0) > threshold);
  const nearThreshold = expenses.filter((e) => {
    const amt = Number(e.amount) || 0;
    return amt >= 0.9 * threshold && amt <= threshold;
  });

  const pending = expenses.filter((e) => e.status === "pending");
  const now = Date.now();
  const avgPendingDays = pending.length
    ? Math.round(
      pending.reduce((sum, e) => {
        const ts = new Date(e.date).getTime();
        if (!Number.isFinite(ts)) return sum;
        return sum + Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
      }, 0) / pending.length
    )
    : 0;

  return [
    {
      title: "The Leak",
      headline: `${highValue.length} high-value claims exceed ${currency} ${threshold.toLocaleString()} with ${nearThreshold.length} near-threshold submissions.`,
      detail: `• Total analyzed spend: ${currency} ${total.toFixed(2)}\n• High-value claims: ${highValue.length}\n• Near-threshold claims (90%-100% of limit): ${nearThreshold.length}`,
    },
    {
      title: "The Bottleneck",
      headline: `${pending.length} requests are still pending with average pending age around ${avgPendingDays} days.`,
      detail: `• Pending approvals: ${pending.length}\n• Average pending age: ${avgPendingDays} days\n• Add SLA nudges for requests older than 3 days`,
    },
    {
      title: "The Strategy",
      headline: "Adopt a Hybrid rule: auto-approve low risk, route high risk in two steps.",
      detail: `• Auto-approve claims under ${currency} 2,000 with clean categories\n• Require manager + finance review above ${currency} ${threshold.toLocaleString()}\n• Flag repeated near-threshold patterns for audit`,
    },
  ];
}

async function generateGroqDeepScan(prompt) {
  if (!GROQ_KEY) {
    throw new Error("Missing VITE_GROQ_API_KEY");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are WardenAI. Return strict JSON only, never markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || "Groq API error";
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) {
    throw new Error("Groq returned an empty response");
  }
  return text;
}

export default function WardenAI({ companyName, currency }) {
  const [scanning, setScanning] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");

  const runScan = async () => {
    setScanning(true); setError(""); setInsights(null);
    try {
      const res = await api.get("/expenses/all");
      const normalized = (res.data.expenses || []).slice(0, 50).map((e) => ({
        employee: e.employee_name,
        category: e.category,
        amount: parseFloat(e.converted_amount || e.amount),
        currency: e.company_currency || currency,
        date: e.expense_date,
        status: e.status,
        description: e.description,
      }));
      const expenseJSON = JSON.stringify(normalized);

      const prompt = `You are 'WardenAI', the strategic financial auditor for ReimburseX. You are brilliant, slightly witty, and obsessed with company efficiency.

Company: ${companyName}
Policy: Flag expenses over ${currency} 10,000.
Last ${normalized.length} expenses: ${expenseJSON}

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

      try {
        const text = await generateGroqDeepScan(prompt);
        const parsed = extractJsonObject(text);
        setInsights(normalizeInsights(parsed, text));
      } catch (groqErr) {
        console.warn("Groq deep scan unavailable, using local analysis:", groqErr);
        setInsights(buildLocalInsights(normalized, currency));
      }
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
