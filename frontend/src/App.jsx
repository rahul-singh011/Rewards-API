import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import mermaid from "mermaid";
import "./index.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  themeVariables: {
    primaryColor: "#eef2ff",
    primaryTextColor: "#312e81",
    primaryBorderColor: "#4f46e5",
    secondaryColor: "#f8fafc",
    secondaryTextColor: "#334155",
    secondaryBorderColor: "#cbd5e1",
    tertiaryColor: "#ecfdf5",
    tertiaryTextColor: "#065f46",
    tertiaryBorderColor: "#059669",
    lineColor: "#94a3b8",
    textColor: "#0f172a",
    mainBkg: "#ffffff",
    nodeBorder: "#e2e8f0",
    clusterBkg: "#f4f6fb",
    clusterBorder: "#e2e8f0",
    titleColor: "#0f172a",
    edgeLabelBackground: "#ffffff",
    actorBkg: "#eef2ff",
    actorBorder: "#4f46e5",
    actorTextColor: "#312e81",
    actorLineColor: "#94a3b8",
    signalColor: "#64748b",
    signalTextColor: "#0f172a",
    labelBoxBkgColor: "#ffffff",
    labelBoxBorderColor: "#e2e8f0",
    labelTextColor: "#0f172a",
    loopTextColor: "#475569",
    noteBkgColor: "#fffbeb",
    noteTextColor: "#92400e",
    noteBorderColor: "#fde68a",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "13px",
  },
  flowchart: {
    htmlLabels: false,
    curve: "basis",
    padding: 20,
    nodeSpacing: 50,
    rankSpacing: 60,
  },
  sequence: {
    diagramMarginX: 30,
    diagramMarginY: 20,
    actorMargin: 60,
    messageMargin: 40,
  },
});

const USERS = ["user_001", "user_002", "user_003", "user_004", "user_005"];

const SECTIONS = [
  { id: "transaction", label: "Transactions" },
  { id: "summary",     label: "User Summary" },
  { id: "ranking",     label: "Leaderboard" },
  { id: "flow",        label: "Flow Diagram" },
];

const FLOW_LEGEND = [
  { cls: "client",   label: "Client / Entry" },
  { cls: "decision", label: "Decision Gate" },
  { cls: "success",  label: "Success Path" },
  { cls: "error",    label: "Error Response" },
  { cls: "cache",    label: "Cached Result" },
  { cls: "db",       label: "Database Op" },
];

const SEQUENCE_DIAGRAM = `
sequenceDiagram
  participant C as Client
  participant A as API Server
  participant DB as SQLite DB

  C->>A: POST /transaction
  A->>DB: Check idempotency key
  alt duplicate key
    DB-->>A: cached response
    A-->>C: 200 OK
  else new request
    A->>DB: validate and write
    DB-->>A: committed
    A-->>C: 201 Created
  end
`;

export default function App() {
  const [tab, setTab]       = useState("transaction");
  const [active, setActive] = useState("transaction");

  useEffect(() => { setActive(tab); }, [tab]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">R</div>
          <div className="logo-text">
            <h1>Rewards<span>.</span>API</h1>
            <p>Points &amp; loyalty platform</p>
          </div>
        </div>
        <div className="status-pill">
          <span className="status-dot" />
          API Live
        </div>
      </header>

      <section className="hero">
        <h2>Manage rewards with <em>confidence</em></h2>
        <p>Idempotent transactions, real-time balances, ranked leaderboards, and live architecture diagrams.</p>
        <div className="feature-tags">
          <span className="feature-tag">Idempotent</span>
          <span className="feature-tag">Concurrent-safe</span>
          <span className="feature-tag">Ranked leaderboard</span>
          <span className="feature-tag">Flow diagrams</span>
        </div>
      </section>

      <div className="tabs-wrap">
        <nav className="tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`tab ${tab === s.id ? "active" : ""}`}
              onClick={() => setTab(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "transaction" && <TransactionTab />}
      {tab === "summary"     && <SummaryTab />}
      {tab === "ranking"     && <RankingTab />}
      {tab === "flow"        && <FlowTab />}

      <Minimap active={active} onSelect={setTab} />
    </div>
  );
}


function Minimap({ active, onSelect }) {
  return (
    <div className="minimap-wrap">
      <div className="minimap-title">Quick Nav</div>
      {SECTIONS.map((s) => (
        <div
          key={s.id}
          className={`minimap-item ${active === s.id ? "active" : ""}`}
          onClick={() => onSelect(s.id)}
        >
          <span className="minimap-dot" />
          {s.label}
        </div>
      ))}
    </div>
  );
}


function MermaidDiagram({ chart, id, variant = "default" }) {
  const displayRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const chartText = useMemo(() => chart?.trim() ?? "", [chart]);

  useEffect(() => {
    if (!chartText) return;

    let cancelled = false;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;width:1400px;height:900px;opacity:0;pointer-events:none;overflow:hidden";
    document.body.appendChild(host);

    setStatus("loading");
    const renderId = `mm-${id}-${Math.random().toString(36).slice(2)}`;

    mermaid
      .render(renderId, chartText, host)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !displayRef.current) return;
        if (svg.includes("Syntax error in text")) {
          setStatus("error");
          return;
        }
        displayRef.current.innerHTML = svg;
        bindFunctions?.(displayRef.current);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      })
      .finally(() => {
        host.remove();
        document.querySelectorAll('[id^="dmermaid-"], [id^="imermaid-"]').forEach((el) => {
          if (el.parentElement === document.body) el.remove();
        });
      });

    return () => {
      cancelled = true;
      host.remove();
    };
  }, [chartText, id]);

  if (!chartText) return null;

  return (
    <div className={`mermaid-wrap ${variant === "hero" ? "mermaid-wrap--hero" : ""}`}>
      {status === "loading" && (
        <div className="mermaid-loading">
          <div className="mermaid-loading-spinner" />
          Rendering diagram…
        </div>
      )}
      {status === "error" && (
        <div className="mermaid-error">Could not render this diagram.</div>
      )}
      <div ref={displayRef} className="mermaid-display" hidden={status !== "done"} />
    </div>
  );
}


function DiagramSection({ title, badge, chart, id }) {
  return (
    <div className="diagram-section">
      <div className="diagram-section-header">
        <h3>{title}</h3>
        {badge && <span className="diagram-badge">{badge}</span>}
      </div>
      <MermaidDiagram chart={chart} id={id} />
    </div>
  );
}


function TransactionTab() {
  const [form, setForm] = useState({
    user_id: "user_001",
    amount: "",
    type: "earn",
    idempotency_key: uuid(),
  });
  const [res, setRes]         = useState(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (keyOverride) => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setLoading(true);
    setRes(null);
    try {
      const body = {
        ...form,
        amount: Number(form.amount),
        idempotency_key: keyOverride ?? form.idempotency_key,
      };
      const r = await fetch(`${API}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setIsError(!r.ok);
      setRes(JSON.stringify(data, null, 2));
    } catch (e) {
      setIsError(true);
      setRes(`Network error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">New Transaction</p>
            <p className="card-subtitle">POST /transaction — earn or spend points for a user</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>User ID</label>
            <select value={form.user_id} onChange={(e) => set("user_id", e.target.value)}>
              {USERS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="earn">Earn</option>
              <option value="spend">Spend</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount (points)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 100"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Idempotency Key</label>
            <div className="idem-row">
              <input
                type="text"
                value={form.idempotency_key}
                onChange={(e) => set("idempotency_key", e.target.value)}
              />
              <button
                className="btn btn-secondary"
                onClick={() => set("idempotency_key", uuid())}
                title="Generate new key"
              >↺</button>
            </div>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => submit()} disabled={loading}>
            {loading ? "Sending…" : "Send Request"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => submit(form.idempotency_key)}
            disabled={loading}
            title="Same key — should return identical response"
          >
            Resend Same Key
          </button>
        </div>

        {res && (
          <div className={`response-box ${isError ? "error" : "success"}`}>{res}</div>
        )}

        <DiagramSection title="Request Sequence" badge="Live" chart={SEQUENCE_DIAGRAM} id="transaction-flow" />
      </div>
    </div>
  );
}


function SummaryTab() {
  const [userId, setUserId]   = useState("user_001");
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetch(`${API}/summary/${id}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || "Error");
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(userId); }, [userId]);

  const pieDiagram = useMemo(() => {
    if (!data) return null;
    return `
pie title "Points breakdown"
  "Balance" : ${Math.max(data.balance, 0.1)}
  "Spent"   : ${Math.max(data.total_spent, 0.1)}
`;
  }, [data]);

  const initial = data?.username?.charAt(0)?.toUpperCase() || "?";

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">User Summary</p>
            <p className="card-subtitle">GET /summary/:userId — balance and activity overview</p>
          </div>
        </div>

        <div className="toolbar">
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {USERS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => load(userId)} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error   && <div className="response-box error">{error}</div>}
        {loading && <div className="loading">Fetching user data</div>}

        {data && (
          <>
            <div className="user-header">
              <div className="user-avatar">{initial}</div>
              <div>
                <div className="user-name">{data.username}</div>
                <div className="user-id">{data.user_id}</div>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Balance</div>
                <div className="stat-value">{data.balance.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Total Earned</div>
                <div className="stat-value earn">+{data.total_earned.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Total Spent</div>
                <div className="stat-value spend">-{data.total_spent.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Transactions</div>
                <div className="stat-value">{data.txn_count}</div>
              </div>
              <div className="stat" style={{ gridColumn: "span 2" }}>
                <div className="stat-label">Last Active</div>
                <div className="stat-value sm">{data.last_active_at}</div>
              </div>
            </div>

            {(data.balance > 0 || data.total_spent > 0) && (
              <DiagramSection title="Points Distribution" badge="Chart" chart={pieDiagram} id="summary-pie" />
            )}
          </>
        )}
      </div>
    </div>
  );
}


function RankingTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/ranking`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || "Error");
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const barDiagram = useMemo(() => {
    if (!data?.users) return null;
    return `
xychart-beta
  title "Ranking scores"
  x-axis [${data.users.map((u) => `"${u.username}"`).join(", ")}]
  y-axis "Score" 0 --> 1
  bar [${data.users.map((u) => u.score.toFixed(3)).join(", ")}]
`;
  }, [data]);

  const badgeClass = (rank) => {
    if (rank === 1) return "rank-badge gold";
    if (rank === 2) return "rank-badge silver";
    if (rank === 3) return "rank-badge bronze";
    return "rank-badge";
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Leaderboard</p>
            <p className="card-subtitle">GET /ranking — users ranked by composite score</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? "…" : "↺ Refresh"}
          </button>
        </div>

        {data?.scoring_formula && (
          <div className="formula">
            <strong>Scoring formula</strong>
            {data.scoring_formula}
          </div>
        )}

        {error   && <div className="response-box error">{error}</div>}
        {loading && !data && <div className="loading">Computing ranks</div>}

        {data?.users && (
          <>
            <div className="table-wrap">
              <table className="rank-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Score</th>
                    <th>Earned</th>
                    <th>Balance</th>
                    <th>Txns</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.user_id}>
                      <td><span className={badgeClass(u.rank)}>{u.rank}</span></td>
                      <td>
                        <div className="cell-user-name">{u.username}</div>
                        <div className="cell-user-id">{u.user_id}</div>
                      </td>
                      <td>
                        <div className="score-bar-wrap">
                          <div className="score-bar">
                            <div className="score-bar-fill" style={{ width: `${u.score * 100}%` }} />
                          </div>
                          <span className="score-val">{u.score.toFixed(3)}</span>
                        </div>
                      </td>
                      <td className="cell-earn">+{u.total_earned}</td>
                      <td>{u.balance}</td>
                      <td>{u.txn_count}</td>
                      <td className="cell-muted">{u.last_active_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DiagramSection title="Score Comparison" badge="Chart" chart={barDiagram} id="ranking-bar" />
          </>
        )}
      </div>
    </div>
  );
}


const SYSTEM_FLOW = `
flowchart TB
  classDef client fill:#eef2ff,stroke:#4f46e5,color:#312e81
  classDef handler fill:#ffffff,stroke:#cbd5e1,color:#0f172a
  classDef decision fill:#fffbeb,stroke:#d97706,color:#92400e
  classDef success fill:#ecfdf5,stroke:#059669,color:#065f46
  classDef error fill:#fef2f2,stroke:#dc2626,color:#991b1b
  classDef cache fill:#f5f3ff,stroke:#7c3aed,color:#5b21b6
  classDef db fill:#f1f5f9,stroke:#64748b,color:#334155

  Client([Client Browser]):::client

  Client -->|POST transaction| TH[Transaction Handler]:::handler
  Client -->|GET summary| SH[Summary Handler]:::handler
  Client -->|GET ranking| RH[Ranking Handler]:::handler

  subgraph TXN["Transaction Pipeline"]
    TH --> IK{Idempotency key?}:::decision
    IK -->|yes| CR[Return cached 200]:::cache
    IK -->|no| UV{User valid?}:::decision
    UV -->|no| E1[404 Not Found]:::error
    UV -->|yes| VL{Velocity OK?}:::decision
    VL -->|no| E2[429 Rate Limited]:::error
    VL -->|yes| BL{Balance OK?}:::decision
    BL -->|no| E3[400 Bad Request]:::error
    BL -->|yes| WL[Write lock]:::db
    WL --> BI[BEGIN IMMEDIATE]:::db
    BI --> IT[Insert txn]:::db
    IT --> UB[Update balance]:::db
    UB --> SK[Store idempotency]:::db
    SK --> CM[COMMIT]:::db
    CM --> OK[201 Created]:::success
  end

  subgraph SUM["Summary Path"]
    SH --> PK[Primary key lookup]:::db
    PK --> AG[Aggregate stats]:::db
    AG --> SR[Return summary 200]:::success
  end

  subgraph RNK["Ranking Path"]
    RH --> AU[Fetch all users]:::db
    AU --> NM[Normalize factors]:::handler
    NM --> WS[Weighted score]:::handler
    WS --> SO[Sort and rank]:::handler
    SO --> RR[Return leaderboard]:::success
  end
`;

const RANKING_FLOW = `
flowchart LR
  classDef input fill:#eef2ff,stroke:#4f46e5,color:#312e81
  classDef process fill:#ffffff,stroke:#cbd5e1,color:#0f172a
  classDef weight fill:#fffbeb,stroke:#d97706,color:#92400e
  classDef output fill:#ecfdf5,stroke:#059669,color:#065f46

  TE[total earned]:::input
  TC[txn count]:::input
  RA[recency factor]:::input

  TE --> W1[weight 0.50]:::weight
  TC --> W2[weight 0.30]:::weight
  RA --> W3[weight 0.20]:::weight

  W1 --> NS[normalized score]:::process
  W2 --> NS
  W3 --> NS

  NS --> FS[final score]:::process
  FS --> RK[assign rank]:::output
`;

function FlowLegend() {
  return (
    <div className="flow-legend">
      {FLOW_LEGEND.map((item) => (
        <div key={item.cls} className="flow-legend-item">
          <span className={`flow-legend-swatch flow-legend-swatch--${item.cls}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}


function FlowTab() {
  return (
    <div className="flow-page">
      <div className="flow-banner">
        <div className="flow-banner-icon">⬡</div>
        <div>
          <h2>System Architecture</h2>
          <p>
            Visual map of every request path through the Rewards API — from client entry
            through validation gates, atomic database writes, and ranked scoring.
          </p>
          <div className="flow-pills">
            <span className="flow-pill">
              <span className="flow-pill-dot flow-pill-dot--post" />
              POST /transaction
            </span>
            <span className="flow-pill">
              <span className="flow-pill-dot flow-pill-dot--get" />
              GET /summary
            </span>
            <span className="flow-pill">
              <span className="flow-pill-dot flow-pill-dot--rank" />
              GET /ranking
            </span>
          </div>
        </div>
      </div>

      <div className="diagram-card">
        <div className="diagram-card-head">
          <div>
            <h3>Full Request Flow</h3>
            <p>End-to-end paths for all three API endpoints with decision gates and error branches</p>
          </div>
          <span className="diagram-card-tag">Architecture</span>
        </div>
        <div className="diagram-card-body">
          <FlowLegend />
          <MermaidDiagram chart={SYSTEM_FLOW} id="system-flow" variant="hero" />
        </div>
      </div>

      <div className="diagram-card">
        <div className="diagram-card-head">
          <div>
            <h3>Ranking Score Formula</h3>
            <p>How user activity is weighted and combined into a normalized 0–1 score</p>
          </div>
          <span className="diagram-card-tag">Scoring</span>
        </div>
        <div className="diagram-card-body">
          <div className="flow-formula-grid">
            <div className="flow-formula-card">
              <div className="flow-formula-weight">× 0.50</div>
              <div className="flow-formula-label">total_earned</div>
              <div className="flow-formula-desc">Lifetime points earned by the user</div>
            </div>
            <div className="flow-formula-card">
              <div className="flow-formula-weight">× 0.30</div>
              <div className="flow-formula-label">txn_count</div>
              <div className="flow-formula-desc">Total number of transactions</div>
            </div>
            <div className="flow-formula-card">
              <div className="flow-formula-weight">× 0.20</div>
              <div className="flow-formula-label">recency</div>
              <div className="flow-formula-desc">1 ÷ (1 + days since last active)</div>
            </div>
            <div className="flow-formula-result">
              Final Score = weighted sum → normalized 0→1 → sorted rank
            </div>
          </div>
          <MermaidDiagram chart={RANKING_FLOW} id="ranking-flow" variant="hero" />
        </div>
      </div>
    </div>
  );
}
