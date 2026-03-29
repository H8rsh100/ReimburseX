import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const CATEGORIES = ["Travel", "Food & Dining", "Accommodation", "Office Supplies", "Client Entertainment", "Training", "Medical", "Other"];
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const OCR_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Retry up to 2 times for 429 rate-limit
async function ocrRequest(body, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(OCR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "Gemini rate limit reached — please wait ~30 seconds and try again."
          : `Gemini API error (${res.status})`
      );
    }
    return res.json();
  }
}

export default function ExpenseForm() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({
    amount: "", currency: "USD", category: "Travel",
    description: "", expense_date: new Date().toISOString().split("T")[0], receipt_url: "",
  });
  const [currencies, setCurrencies] = useState(["USD","EUR","GBP","INR","JPY","AUD","CAD"]);
  const [loading, setLoading]       = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError]           = useState("");
  const [ocrError, setOcrError]     = useState("");
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [dragOver, setDragOver]     = useState(false);

  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=name,currencies")
      .then(r => r.json())
      .then(data => {
        const all = new Set();
        data.forEach(c => { if (c.currencies) Object.keys(c.currencies).forEach(k => all.add(k)); });
        setCurrencies([...all].sort());
      }).catch(() => {});
  }, []);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const processFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setOcrError("Please upload an image file.");
      return;
    }

    // Preview
    const previewReader = new FileReader();
    previewReader.onload = ev => setReceiptPreview(ev.target.result);
    previewReader.readAsDataURL(file);

    if (!GEMINI_API_KEY) {
      setOcrError("No Gemini API key set (VITE_GEMINI_API_KEY). Please fill fields manually.");
      return;
    }

    setOcrLoading(true);
    setOcrError("");

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const data = await ocrRequest({
        contents: [{
          parts: [
            { inline_data: { mime_type: file.type, data: base64 } },
            { text: `Extract expense details from this receipt. Respond ONLY with raw JSON:\n{\n  "amount": <number>,\n  "currency": "<3-letter ISO code>",\n  "description": "<e.g. Dinner at Taj>",\n  "category": "<one of: Travel, Food & Dining, Accommodation, Office Supplies, Client Entertainment, Training, Medical, Other>",\n  "expense_date": "<YYYY-MM-DD>"\n}` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
      });

      const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setForm(f => ({
        ...f,
        amount:       parsed.amount       != null  ? String(parsed.amount)  : f.amount,
        currency:     parsed.currency              || f.currency,
        description:  parsed.description           || f.description,
        category:     parsed.category              || f.category,
        expense_date: parsed.expense_date          || f.expense_date,
      }));
    } catch (err) {
      console.error("OCR failed:", err);
      setOcrError(err.message || "Could not read receipt. Fill in fields manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileInput = (e) => { processFile(e.target.files[0]); };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.amount || !form.description) { setError("Amount and description are required."); return; }
    setLoading(true);
    try {
      await api.post("/expenses", form);
      navigate("/expenses");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit expense.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Expense</h1>
          <p className="page-subtitle">Submit a new reimbursement claim</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/expenses")}>← Back</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem" }}>
        {/* ── Form ── */}
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"1.2rem" }}>
            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <div className="form-row">
              <div className="form-group" style={{ flex:2 }}>
                <label className="form-label">Amount *</label>
                <input className="form-input" name="amount" type="number" step="0.01" min="0"
                  value={form.amount} onChange={handleChange} placeholder="0.00" required />
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Currency *</label>
                <select className="form-input" name="currency" value={form.currency} onChange={handleChange}>
                  {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-input" name="description" value={form.description}
                onChange={handleChange} rows={3} placeholder="What was this expense for?" required />
            </div>

            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" name="expense_date" type="date"
                value={form.expense_date} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt URL (optional)</label>
              <input className="form-input" name="receipt_url" type="url"
                value={form.receipt_url} onChange={handleChange} placeholder="https://..." />
            </div>

            <div style={{ display:"flex", gap:"1rem", marginTop:"0.5rem" }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex:1 }}>
                {loading ? "Submitting..." : "💸 Submit Expense"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/expenses")}>Cancel</button>
            </div>
          </form>
        </div>

        {/* ── Receipt Scanner ── */}
        <div className="card" style={{ display:"flex", flexDirection:"column" }}>
          <div style={{ marginBottom:"0.75rem" }}>
            <h3 style={{ color:"var(--text-primary)", fontSize:"0.95rem", fontWeight:700, marginBottom:"0.3rem" }}>
              📷 Scan Receipt
            </h3>
            <p style={{ fontSize:"0.8rem", color:"var(--text-muted)", lineHeight:1.5 }}>
              Drop or upload a receipt and Gemini Vision auto-fills all fields.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileInput} />

          <div
            className={`receipt-drop-zone ${dragOver ? "drag-over" : ""} ${ocrLoading ? "scanning-border" : ""}`}
            onClick={() => { if (!ocrLoading) { setOcrError(""); fileRef.current.click(); } }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ flex:1, minHeight:120 }}
          >
            {ocrLoading ? (
              <>
                <span className="drop-icon">🔍</span>
                <div className="drop-label">Reading your receipt...</div>
                <div className="spinner" style={{ marginTop:"0.75rem" }}/>
              </>
            ) : (
              <>
                <span className="drop-icon">{dragOver ? "📥" : "📂"}</span>
                <div className="drop-label">
                  Drop image here or <span>click to browse</span>
                </div>
                <div style={{ fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"0.4rem" }}>
                  JPG, PNG, WEBP supported
                </div>
              </>
            )}
          </div>

          {ocrError && (
            <div className="alert alert-error" style={{ marginTop:"0.75rem", fontSize:"0.8rem" }}>{ocrError}</div>
          )}

          {receiptPreview && !ocrLoading && (
            <div style={{ marginTop:"1rem" }}>
              <img src={receiptPreview} alt="Receipt" style={{ width:"100%", borderRadius:"10px", border:"1px solid var(--border)" }} />
              {!ocrError && (
                <p style={{ marginTop:"0.5rem", fontSize:"0.75rem", color:"var(--success)", textAlign:"center", fontWeight:600 }}>
                  ✅ Fields auto-filled from receipt
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
