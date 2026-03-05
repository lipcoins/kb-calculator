import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// 1. 카테고리 정의 (순정 유지)
const CATEGORIES = [
  { key: "gas",      label: "⛽ 주유소",       color: "#FF6B35" },
  { key: "mart",     label: "🛒 대형마트",      color: "#A78BFA" },
  { key: "shopping", label: "🛍️ 온라인 쇼핑몰", color: "#4ECDC4" },
  { key: "telecom",  label: "📱 통신/기타",     color: "#45B7D1" },
  { key: "delivery", label: "🍔 배달/외식",     color: "#FFAA00" },
  { key: "water",    label: "💧 정수기",       color: "#60A5FA" },
  { key: "other",    label: "🔹 기타",          color: "#9E9E9E" },
];

const ALL_KEYS = ["gas", "mart", "shopping", "telecom", "delivery", "water", "other"];

const TIER_LIMITS = {
  "40": { gas: 10000, mart: 15000, shopping: 15000, telecom: 10000, delivery: 10000, water: 10000, other: null },
  "80": { gas: 20000, mart: 20000, shopping: 20000, telecom: 10000, delivery: 10000, water: 10000, other: null },
};

// 2. 보조 함수 (순정 유지)
function buildTotals(parsed) {
  const totals = {};
  let grand = 0;
  for (const key of ALL_KEYS) {
    const items = (parsed[key] || []).map(i => ({ ...i, amount: Number(i.amount) || 0 }));
    const sum = items.reduce((acc, i) => acc + i.amount, 0);
    totals[key] = { items, sum };
    grand += sum;
  }
  return { totals, grand };
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
      background: active ? "rgba(255,255,255,0.14)" : "transparent",
      color: active ? "#FFD700" : "rgba(255,255,255,0.5)",
      fontSize: 13, fontWeight: active ? 700 : 400,
      borderBottom: active ? "2px solid #FFD700" : "2px solid transparent",
      transition: "all 0.2s", fontFamily: "'Noto Sans KR', sans-serif",
    }}>{children}</button>
  );
}

export default function App() {
  const [mainTab, setMainTab] = useState("input");
  const [tier, setTier] = useState("40");
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [chartType, setChartType] = useState("pie");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });

  // 🛠️ [정밀 튜닝] 주인님이 주신 실제 텍스트 구조 맞춤형 파서
  const analyze = () => {
    if (!textInput.trim()) return;
    setError(null);
    
    const parsed = { gas: [], mart: [], shopping: [], telecom: [], delivery: [], water: [], other: [] };
    const lines = textInput.split("\n").map(l => l.trim()).filter(l => l !== "");
    let foundAny = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("적립") && lines[i].includes("P")) {
        const amountMatch = lines[i].match(/([\d,]+)/);
        if (amountMatch) {
          const amount = parseInt(amountMatch[0].replace(/,/g, ""), 10);
          
          // 가맹점명을 찾기 위해 위로 역추적 (KB Pay 복사본 특화)
          let name = "미분류 가맹점";
          for (let j = 1; j <= 5; j++) {
            const candidate = lines[i - j];
            if (!candidate) continue;
            // 금액, 시간, 카드명, 날짜 등이 아닌 줄을 가맹점명으로 인식
            if (!candidate.includes("원") && !candidate.includes(":") && !candidate.includes("탄탄대로") && !candidate.match(/^\d{2}월\d{2}일/)) {
              name = candidate.trim();
              break;
            }
          }
          foundAny = true;

          // 정밀 키워드 분류
          if (["주유", "SK", "GS", "오일"].some(k => name.includes(k))) parsed.gas.push({ name, amount });
          else if (["이마트", "홈플러스", "롯데마트", "식자재"].some(k => name.includes(k))) parsed.mart.push({ name, amount });
          else if (["G마켓", "옥션", "11번가", "온스타일", "SSG"].some(k => name.includes(k))) parsed.shopping.push({ name, amount });
          else if (["브로드밴드", "LiivM", "LGUPLUS", "LG유플", "SKT", "KT"].some(k => name.includes(k))) parsed.telecom.push({ name, amount });
          else if (["우아한형", "배달의민족", "마켓컬리"].some(k => name.includes(k))) parsed.delivery.push({ name, amount });
          else if (name.toLowerCase().includes("coway") || name.includes("코웨이")) parsed.water.push({ name, amount });
          else parsed.other.push({ name, amount });
        }
      }
    }

    if (!foundAny) {
      setError("적립 내역을 찾을 수 없습니다. 형식을 확인해주세요.");
      return;
    }

    const { totals, grand } = buildTotals(parsed);
    setResult({ totals, grand, month, tier });
    setMainTab("result");
  };

  const effectiveGrand = result ? ALL_KEYS.reduce((acc, key) => {
    const sum = result.totals[key]?.sum || 0;
    const limit = TIER_LIMITS[result.tier || "40"][key];
    return acc + (limit ? Math.min(sum, limit) : sum);
  }, 0) : 0;

  const chartData = result ? CATEGORIES.filter(c => result.totals[c.key]?.sum > 0).map(c => ({
    name: c.label, value: result.totals[c.key].sum, color: c.color,
  })) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'Noto Sans KR', sans-serif", color: "#e8eaf6" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a237e 0%, #0d47a1 60%, #01579b 100%)", padding: "22px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ background: "linear-gradient(135deg, #FFD700, #FFA000)", borderRadius: 10, padding: "7px 13px", fontFamily: "'Bebas Neue'", fontSize: 19, color: "#0a0e1a", letterSpacing: 1 }}>KB</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, letterSpacing: 2.5, color: "#fff" }}>BIZ TITANIUM</div>
          </div>
          <div style={{ display: "flex" }}>
            {[["input", "✏️ 입력"], ["result", "📊 결과"], ["history", "📅 히스토리"]].map(([k, l]) => (
              <TabBtn key={k} active={mainTab === k} onClick={() => setMainTab(k)}>{l}</TabBtn>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "22px 16px 56px" }}>

        {mainTab === "input" && (
          <div>
            {/* 🛠️ [복구] 월 선택 드롭다운 */}
            <div style={{ marginBottom: 16 }}>
              <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 16, outline: "none", appearance: "none" }}>
                <option value="2026-03">2026년 3월</option>
                <option value="2026-02">2026년 2월</option>
                <option value="2026-01">2026년 1월</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {[["40", "💳 전월 실적 40만 이상"], ["80", "💎 전월 실적 80만 이상"]].map(([val, label]) => (
                  <button key={val} onClick={() => setTier(val)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid " + (tier === val ? "#FFD700" : "rgba(255,255,255,0.12)"), background: tier === val ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)", color: tier === val ? "#FFD700" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 700 }}>{label}</button>
                ))}
              </div>
              
              {/* 🛠️ [수정] 한도 표시 (10,000 P 형식) */}
              <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {CATEGORIES.filter(c => c.key !== 'other').map(cat => (
                  <div key={cat.key} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px" }}>
                    <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4 }}>{cat.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>{TIER_LIMITS[tier][cat.key].toLocaleString()} P</div>
                  </div>
                ))}
              </div>
            </div>

            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={"KB Pay 내역을 붙여넣으세요..."} style={{ width: "100%", height: 250, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, color: "#fff", outline: "none", boxSizing: "border-box" }} />
            {error && <div style={{ color: "#ff8a80", fontSize: 13, marginTop: 10 }}>⚠️ {error}</div>}
            <button onClick={analyze} style={{ width: "100%", padding: 16, borderRadius: 14, background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a0e1a", fontWeight: 700, marginTop: 20, cursor: "pointer", border: "none" }}>✨ 적립금 분석하기</button>
          </div>
        )}

        {mainTab === "result" && result && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "24px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                   <div style={{ fontSize: 11, opacity: 0.5 }}>{result.month} · {result.tier}만 실적 기준</div>
                   <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700" }}>{effectiveGrand.toLocaleString()}<span style={{ fontSize: 22 }}>P</span></div>
                </div>
              </div>
            </div>
            
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={220}>
                {chartType === "pie" ? (
                  <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
                ) : (
                  <BarChart data={chartData}><XAxis dataKey="name" tick={{ fontSize: 10, fill: "#fff" }} /><YAxis /><Bar dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {CATEGORIES.map(cat => {
              const d = result.totals[cat.key];
              if (!d || d.sum === 0) return null;
              const limit = TIER_LIMITS[result.tier][cat.key];
              return (
                <div key={cat.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 600 }}>{cat.label}</span>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: d.sum > (limit || Infinity) ? "#ff8a80" : cat.color }}>{Math.min(d.sum, limit || Infinity).toLocaleString()}P</span>
                  </div>
                  {d.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                      <span>{it.name}</span><span>{it.amount.toLocaleString()}P</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
