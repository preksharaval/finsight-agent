import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Sparkles, Activity,
  DollarSign, Wallet, Target, Zap, ArrowUpRight, ArrowDownRight, Loader2
} from "lucide-react";

/* ============================================================
   FinSight — Autonomous Financial Monitoring Agent
   A portfolio project demonstrating AI-driven FinOps:
   ingests transactions, computes P&L + runway, flags anomalies,
   and generates prioritized recommendations via Claude.
   ============================================================ */

// ---- MOCK COMPANY DATA (realistic seed-stage SaaS) ----------
const COMPANY = { name: "Northwind AI", stage: "Seed", cashOnHand: 1840000 };

const MONTHLY = [
  { month: "Jan", revenue: 82000, expense: 141000, headcount: 11 },
  { month: "Feb", revenue: 91000, expense: 148000, headcount: 12 },
  { month: "Mar", revenue: 104000, expense: 152000, headcount: 12 },
  { month: "Apr", revenue: 118000, expense: 167000, headcount: 14 },
  { month: "May", revenue: 129000, expense: 171000, headcount: 14 },
  { month: "Jun", revenue: 147000, expense: 198000, headcount: 16 },
  { month: "Jul", revenue: 163000, expense: 205000, headcount: 16 },
  { month: "Aug", revenue: 171000, expense: 241000, headcount: 18 },
];

const EXPENSE_BREAKDOWN = [
  { category: "Payroll & Contractors", amount: 142000, prior: 121000 },
  { category: "Cloud & Infrastructure", amount: 38500, prior: 24000 },
  { category: "SaaS Tooling", amount: 21000, prior: 13500 },
  { category: "Sales & Marketing", amount: 24000, prior: 28000 },
  { category: "Office & Ops", amount: 9500, prior: 9200 },
  { category: "Other", amount: 6000, prior: 5100 },
];

const INVESTMENTS = [
  { name: "Money Market (Treasury)", allocated: 900000, yield: 4.8, type: "Low risk" },
  { name: "Short-term T-Bills", allocated: 500000, yield: 5.1, type: "Low risk" },
  { name: "Operating Reserve", allocated: 440000, yield: 0.5, type: "Liquid" },
];

const PALETTE = ["#1f6feb", "#2ea043", "#d29922", "#db6d28", "#8957e5", "#57606a"];

const fmt = (n) =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M`
  : n >= 1000 ? `$${(n / 1000).toFixed(0)}K`
  : `$${n}`;
const fmtFull = (n) => `$${n.toLocaleString()}`;

export default function FinSightAgent() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("overview");

  // ---- DERIVED METRICS (the "agent" math layer) ----
  const metrics = useMemo(() => {
    const last = MONTHLY[MONTHLY.length - 1];
    const prev = MONTHLY[MONTHLY.length - 2];
    const totalRev = MONTHLY.reduce((s, m) => s + m.revenue, 0);
    const totalExp = MONTHLY.reduce((s, m) => s + m.expense, 0);
    const netBurn = last.expense - last.revenue;
    const runwayMonths = COMPANY.cashOnHand / netBurn;
    const revGrowth = ((last.revenue - prev.revenue) / prev.revenue) * 100;
    const expGrowth = ((last.expense - prev.expense) / prev.expense) * 100;
    const grossMargin = ((last.revenue - last.expense * 0.35) / last.revenue) * 100;

    const withPnl = MONTHLY.map((m) => ({ ...m, pnl: m.revenue - m.expense }));

    // anomaly detection: flag categories growing far faster than revenue
    const anomalies = EXPENSE_BREAKDOWN
      .map((c) => ({ ...c, delta: ((c.amount - c.prior) / c.prior) * 100 }))
      .filter((c) => c.delta > revGrowth + 15)
      .sort((a, b) => b.delta - a.delta);

    return {
      last, prev, totalRev, totalExp, netBurn, runwayMonths,
      revGrowth, expGrowth, grossMargin, withPnl, anomalies,
    };
  }, []);

  // ---- THE AGENT: calls Claude to generate recommendations ----
  const runAgent = async () => {
    setLoading(true); setErr(null);
    const brief = {
      company: COMPANY,
      monthly: MONTHLY,
      expenseBreakdown: EXPENSE_BREAKDOWN,
      investments: INVESTMENTS,
      computed: {
        netBurn: metrics.netBurn,
        runwayMonths: +metrics.runwayMonths.toFixed(1),
        revGrowthMoM: +metrics.revGrowth.toFixed(1),
        expGrowthMoM: +metrics.expGrowth.toFixed(1),
        grossMargin: +metrics.grossMargin.toFixed(1),
        flaggedCategories: metrics.anomalies.map((a) => ({ c: a.category, growth: +a.delta.toFixed(0) })),
      },
    };

    const prompt = `You are FinSight, an autonomous financial monitoring agent for a ${COMPANY.stage}-stage startup. Analyze this financial snapshot and respond ONLY with valid JSON (no markdown, no backticks).

DATA:
${JSON.stringify(brief, null, 2)}

Respond with this exact JSON shape:
{
  "health_score": <0-100 integer>,
  "headline": "<one sharp sentence on overall financial position>",
  "signals": [ {"label":"<metric>","status":"<good|watch|risk>","note":"<8-12 word insight>"} ],
  "recommendations": [ {"priority":"<P0|P1|P2>","title":"<short action>","rationale":"<1 sentence>","impact":"<$ or % estimate>"} ]
}

Give 4 signals and 4 recommendations. Be specific to the numbers. Prioritize runway and expense anomalies.`;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const text = (data.text || "").replace(/```json|```/g, "").trim();
      setAnalysis(JSON.parse(text));
    } catch (e) {
      setErr("Agent run failed: " + e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runAgent(); /* auto-run on load */ }, []);

  const statusColor = (s) =>
    s === "good" ? "#2ea043" : s === "watch" ? "#d29922" : "#f85149";
  const prioColor = (p) =>
    p === "P0" ? "#f85149" : p === "P1" ? "#d29922" : "#1f6feb";

  return (
    <div style={S.root}>
      <style>{KEYFRAMES}</style>

      {/* ===== HEADER ===== */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={S.logo}><Activity size={22} strokeWidth={2.4} color="#fff" /></div>
          <div>
            <div style={S.brand}>FinSight <span style={{ color: "#1f6feb" }}>Agent</span></div>
            <div style={S.sub}>Autonomous FinOps monitoring · {COMPANY.name} · {COMPANY.stage}</div>
          </div>
        </div>
        <button onClick={runAgent} disabled={loading} style={S.runBtn}>
          {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {loading ? "Agent analyzing…" : "Re-run agent"}
        </button>
      </header>

      {/* ===== KPI STRIP ===== */}
      <div style={S.kpiRow}>
        <Kpi icon={<Wallet size={16} />} label="Cash on hand" value={fmt(COMPANY.cashOnHand)}
             foot={`${metrics.runwayMonths.toFixed(1)} mo runway`} footColor={metrics.runwayMonths < 9 ? "#f85149" : "#2ea043"} />
        <Kpi icon={<DollarSign size={16} />} label="Net burn / mo" value={fmt(metrics.netBurn)}
             foot={`${metrics.expGrowth > metrics.revGrowth ? "outpacing" : "under"} revenue`} footColor={metrics.expGrowth > metrics.revGrowth ? "#d29922" : "#2ea043"} />
        <Kpi icon={<TrendingUp size={16} />} label="Revenue (Aug)" value={fmt(metrics.last.revenue)}
             foot={`+${metrics.revGrowth.toFixed(1)}% MoM`} footColor="#2ea043" arrow="up" />
        <Kpi icon={<TrendingDown size={16} />} label="Expense (Aug)" value={fmt(metrics.last.expense)}
             foot={`+${metrics.expGrowth.toFixed(1)}% MoM`} footColor="#f85149" arrow="down" />
        <Kpi icon={<Target size={16} />} label="Gross margin" value={`${metrics.grossMargin.toFixed(0)}%`}
             foot="est. blended" footColor="#8b949e" />
      </div>

      {/* ===== AGENT VERDICT ===== */}
      <div style={S.agentCard}>
        <div style={S.agentHead}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Zap size={16} color="#1f6feb" fill="#1f6feb" />
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.3, color: "#e6edf3" }}>
              AGENT VERDICT
            </span>
          </div>
          {analysis && (
            <div style={S.healthBadge}>
              <span style={{ fontSize: 11, color: "#8b949e" }}>HEALTH</span>
              <span style={{ fontSize: 20, fontWeight: 800,
                color: analysis.health_score >= 70 ? "#2ea043" : analysis.health_score >= 45 ? "#d29922" : "#f85149" }}>
                {analysis.health_score}
              </span>
            </div>
          )}
        </div>

        {loading && !analysis && (
          <div style={S.loadingBox}>
            <Loader2 size={20} className="spin" color="#1f6feb" />
            <span>Agent ingesting transactions, computing runway, scanning for anomalies…</span>
          </div>
        )}
        {err && <div style={S.errBox}>{err}</div>}
        {analysis && (
          <>
            <p style={S.headline}>{analysis.headline}</p>
            <div style={S.signalRow}>
              {analysis.signals.map((s, i) => (
                <div key={i} style={S.signal}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 9, background: statusColor(s.status) }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#e6edf3" }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4, lineHeight: 1.4 }}>{s.note}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== TABS ===== */}
      <div style={S.tabs}>
        {["overview", "expenses", "investments", "actions"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ===== PANELS ===== */}
      {tab === "overview" && (
        <div style={S.grid2}>
          <Panel title="Revenue vs. Expense" subtitle="Monthly, trailing 8 months">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={MONTHLY} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2ea043" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2ea043" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f85149" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f85149" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#21262d" vertical={false} />
                <XAxis dataKey="month" stroke="#6e7681" fontSize={11} tickLine={false} />
                <YAxis stroke="#6e7681" fontSize={11} tickFormatter={fmt} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => fmtFull(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#2ea043" strokeWidth={2.4} fill="url(#gR)" />
                <Area type="monotone" dataKey="expense" stroke="#f85149" strokeWidth={2.4} fill="url(#gE)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Net P&L" subtitle="Revenue minus expense, by month">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={metrics.withPnl} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#21262d" vertical={false} />
                <XAxis dataKey="month" stroke="#6e7681" fontSize={11} tickLine={false} />
                <YAxis stroke="#6e7681" fontSize={11} tickFormatter={fmt} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => fmtFull(v)} />
                <ReferenceLine y={0} stroke="#6e7681" />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {metrics.withPnl.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "#2ea043" : "#f85149"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {tab === "expenses" && (
        <div style={S.grid2}>
          <Panel title="Expense Breakdown" subtitle="Current month by category">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={EXPENSE_BREAKDOWN} dataKey="amount" nameKey="category"
                     cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {EXPENSE_BREAKDOWN.map((e, i) => <Cell key={i} fill={PALETTE[i]} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Spend Growth vs. Prior" subtitle="Agent flags categories outpacing revenue">
            <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 4 }}>
              {EXPENSE_BREAKDOWN.map((e, i) => {
                const delta = ((e.amount - e.prior) / e.prior) * 100;
                const flagged = delta > metrics.revGrowth + 15;
                return (
                  <div key={i} style={S.spendRow}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: PALETTE[i] }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: "#c9d1d9" }}>{e.category}</span>
                    <span style={{ fontSize: 12.5, color: "#8b949e", width: 64, textAlign: "right" }}>{fmt(e.amount)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, width: 58, textAlign: "right",
                      color: delta > 0 ? (flagged ? "#f85149" : "#d29922") : "#2ea043" }}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
                    </span>
                    {flagged && <AlertTriangle size={13} color="#f85149" />}
                    {!flagged && <span style={{ width: 13 }} />}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "investments" && (
        <Panel title="Treasury & Investment Allocation" subtitle="Idle cash deployment and yield">
          <div style={S.grid3}>
            {INVESTMENTS.map((inv, i) => (
              <div key={i} style={S.invCard}>
                <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.4 }}>{inv.type}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e6edf3", margin: "6px 0" }}>{inv.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1f6feb" }}>{fmt(inv.allocated)}</div>
                <div style={{ fontSize: 12, color: "#2ea043", marginTop: 4, fontWeight: 600 }}>{inv.yield}% APY</div>
                <div style={S.yieldBar}>
                  <div style={{ ...S.yieldFill, width: `${(inv.yield / 5.5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={S.invFoot}>
            Annualized yield on deployed cash: <b style={{ color: "#2ea043" }}>
              ~{fmt(INVESTMENTS.reduce((s, i) => s + i.allocated * i.yield / 100, 0))}/yr
            </b> · {fmt(INVESTMENTS.reduce((s, i) => s + i.allocated, 0))} total under management
          </div>
        </Panel>
      )}

      {tab === "actions" && (
        <Panel title="Agent Recommendations" subtitle="Prioritized actions generated from live analysis">
          {!analysis && <div style={S.loadingBox}><Loader2 size={18} className="spin" color="#1f6feb" /><span>Generating…</span></div>}
          {analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analysis.recommendations.map((rec, i) => (
                <div key={i} style={S.recCard}>
                  <span style={{ ...S.prioTag, background: prioColor(rec.priority) }}>{rec.priority}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e6edf3" }}>{rec.title}</div>
                    <div style={{ fontSize: 12, color: "#8b949e", marginTop: 3, lineHeight: 1.5 }}>{rec.rationale}</div>
                  </div>
                  <span style={S.impactTag}>{rec.impact}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <footer style={S.footer}>
        Portfolio project · Built by Preksha Raval · Powered by an LLM agent over mock seed-stage financials
      </footer>
    </div>
  );
}

/* ---------- small components ---------- */
function Kpi({ icon, label, value, foot, footColor, arrow }) {
  return (
    <div style={S.kpi}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e" }}>
        {icon}<span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: "#e6edf3", marginTop: 6 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: 11.5, fontWeight: 600, color: footColor }}>
        {arrow === "up" && <ArrowUpRight size={12} />}
        {arrow === "down" && <ArrowDownRight size={12} />}
        {foot}
      </div>
    </div>
  );
}
function Panel({ title, subtitle, children }) {
  return (
    <div style={S.panel}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#6e7681", marginTop: 2 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

/* ---------- styles ---------- */
const TT = { background: "#161b22", border: "1px solid #30363d", borderRadius: 8, fontSize: 12, color: "#e6edf3" };
const S = {
  root: { fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#0d1117", color: "#c9d1d9",
    minHeight: "100vh", padding: "22px 26px", maxWidth: 1080, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  logo: { width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#1f6feb,#388bfd)",
    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(31,111,235,0.4)" },
  brand: { fontSize: 20, fontWeight: 800, color: "#e6edf3", letterSpacing: -0.3 },
  sub: { fontSize: 11.5, color: "#6e7681", marginTop: 1 },
  runBtn: { display: "flex", alignItems: "center", gap: 7, background: "#1f6feb", color: "#fff", border: "none",
    padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 },
  kpi: { background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "14px 15px" },
  agentCard: { background: "linear-gradient(180deg,#11161d,#0f141a)", border: "1px solid #1f6feb44",
    borderRadius: 14, padding: 18, marginBottom: 18, animation: "fadeUp .5s ease" },
  agentHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  healthBadge: { display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #21262d",
    borderRadius: 9, padding: "4px 12px" },
  headline: { fontSize: 15, color: "#e6edf3", fontWeight: 600, lineHeight: 1.5, margin: "2px 0 14px" },
  signalRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 },
  signal: { background: "#0d1117", border: "1px solid #21262d", borderRadius: 9, padding: "10px 11px" },
  loadingBox: { display: "flex", alignItems: "center", gap: 10, padding: "16px 4px", fontSize: 13, color: "#8b949e" },
  errBox: { background: "#f8514922", border: "1px solid #f8514944", borderRadius: 8, padding: 12, fontSize: 12.5, color: "#ffa198" },
  tabs: { display: "flex", gap: 4, background: "#161b22", border: "1px solid #21262d", borderRadius: 10,
    padding: 4, marginBottom: 16, width: "fit-content" },
  tab: { background: "transparent", border: "none", color: "#8b949e", padding: "7px 16px", borderRadius: 7,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  tabActive: { background: "#1f6feb", color: "#fff" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 },
  panel: { background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 18 },
  spendRow: { display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid #1c2128" },
  invCard: { background: "#0d1117", border: "1px solid #21262d", borderRadius: 11, padding: 16 },
  yieldBar: { height: 5, background: "#21262d", borderRadius: 4, marginTop: 12, overflow: "hidden" },
  yieldFill: { height: "100%", background: "linear-gradient(90deg,#1f6feb,#2ea043)", borderRadius: 4 },
  invFoot: { marginTop: 16, paddingTop: 14, borderTop: "1px solid #21262d", fontSize: 12.5, color: "#8b949e" },
  recCard: { display: "flex", alignItems: "center", gap: 13, background: "#0d1117", border: "1px solid #21262d",
    borderRadius: 10, padding: "13px 15px" },
  prioTag: { color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6, letterSpacing: 0.5 },
  impactTag: { fontSize: 12, fontWeight: 700, color: "#2ea043", background: "#2ea04318", border: "1px solid #2ea04340",
    padding: "5px 10px", borderRadius: 7, whiteSpace: "nowrap" },
  footer: { marginTop: 22, textAlign: "center", fontSize: 11, color: "#484f58" },
};
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  * { box-sizing: border-box; }
`;
