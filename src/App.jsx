import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// [원본 유지] 카테고리 정의
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
  "40": { gas: 14000, mart: 15000, shopping: 15000, telecom: 10000, delivery: 10000, water: 10000, other: null },
  "80": { gas: 24000, mart: 20000, shopping: 20000, telecom: 10000, delivery: 10000, water: 10000, other: null },
};

// [원본 유지] 데이터 빌드 로직
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

function exportCSV(result) {
  const rows = [["월", "전월실적구간", "카테고리", "가맹점", "적립금(P)"]];
  for (const cat of CATEGORIES) {
    for (const item of result.totals[cat.key]?.items || []) {
      rows.push([result.month, result.tier + "만이상", cat.label, item.name, item.amount]);
    }
  }
  const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `KB_Biz_Titanium_${result.month}.csv`; a.click();
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

  // 🛠️ [튜닝] 사용 금액 추출 로직 추가
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
          
          let name = "기타 가맹점";
          let usedAmount = "";
          for (let j = 1; j <= 5; j++) {
            const candidate = lines[i - j];
            if (!candidate) continue;
            // "원"이 포함된 줄을 사용 금액으로 인식
            if (candidate.includes("원") && !usedAmount) {
              usedAmount = candidate.trim();
            }
            // 가맹점 이름 추출
            if (!candidate.includes("원") && !candidate.includes(":") && !candidate.includes("일시불") && !candidate.match(/^\d{2}월\d{2}일/)) {
              name = candidate.replace("KB Pay", "").trim();
              break;
            }
          }
          
          // 가맹점명 옆에 사용 금액 병합 (결과 페이지 소스코드를 건드리지 않기 위함)
          const displayName = usedAmount ? `${name} ${usedAmount}` : name;
          foundAny = true;

          if (["주유", "SK", "GS", "에쓰", "오일"].some(k => name.includes(k))) parsed.gas.push({ name: displayName, amount });
          else if (["이마트", "홈플러스", "롯데마트", "하나로", "식자재"].some(k => name.includes(k))) parsed.mart.push({ name: displayName, amount });
          else if (["G마켓", "옥션", "11번가", "인터파크", "온스타일", "SSG", "KB제휴"].some(k => name.includes(k))) parsed.shopping.push({ name: displayName, amount });
          else if (["SK브로드", "LiivM", "LGUPLUS", "LG유플", "SKT", "KT", "통신"].some(k => name.includes(k))) parsed.telecom.push({ name: displayName, amount });
          else if (["우아한형", "배달의민족", "배민", "마켓컬리"].some(k => name.includes(k))) parsed.delivery.push({ name: displayName, amount });
          else if (name.toLowerCase().includes("coway") || name.includes("코웨이")) parsed.water.push({ name: displayName, amount });
          else parsed.other.push({ name: displayName, amount });
        }
      }
    }

    if (!foundAny) {
      setError("적립 내역을 찾을 수 없습니다.");
      return;
    }

    const { totals, grand } = buildTotals(parsed);
    setResult({ totals, grand, month, tier });
    setMainTab("result");
  };

  const saveHistory = () => {
    if (!result) return;
    setHistory(prev => [{ ...result }, ...prev.filter(h => h.month !== result.month)]);
    alert("저장 완료!");
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
            {/* 🛠️ [변경 1] 월 선택 UI 추가 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ position: "relative", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center" }}>
                <span style={{ marginRight: 12, fontSize: 18 }}>📅</span>
                <input 
                  type="month" 
                  value={month} 
                  onChange={e => setMonth(e.target.value)} 
                  style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 16, outline: "none", colorScheme: "dark" }} 
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {["40", "80"].map(val => (
                  <button key={val} onClick={() => setTier(val)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid " + (tier === val ? "#FFD700" : "rgba(255,255,255,0.12)"), background: tier === val ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)", color: tier === val ? "#FFD700" : "rgba(255,255,255,0.45)", fontWeight: 700 }}>{val}만 이상</button>
                ))}
              </div>
              
              {/* 🛠️ [변경 2] 한도 표기 수정 (10,000P 형식) */}
              <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {["gas", "mart", "shopping", "telecom", "delivery", "water"].map(key => (
                  <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px" }}>
                    <div style={{ fontSize: 10, opacity: 0.4 }}>{CATEGORIES.find(c => c.key === key).label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>{TIER_LIMITS[tier][key].toLocaleString()}P</div>
                  </div>
                ))}
              </div>
            </div>

            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={"KB Pay 앱에서 이용내역을 통째로 복사해 붙여넣으세요..."} style={{ width: "100%", height: 280, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, color: "#fff", outline: "none", resize: "none" }} />
            {error && <div style={{ color: "#ff8a80", fontSize: 13, marginTop: 10 }}>⚠️ {error}</div>}
            <button onClick={analyze} style={{ width: "100%", padding: 15, borderRadius: 14, background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a0e1a", fontWeight: 700, marginTop: 20, cursor: "pointer", border: "none" }}>✨ 적립금 분석하기</button>
          </div>
        )}

        {/* [원본 보존] RESULT TAB - 결과 페이지 소스코드는 절대 건드리지 않았습니다 */}
        {mainTab === "result" && result && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "24px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{result.month} · {result.tier}만 실적 기준</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700" }}>{effectiveGrand.toLocaleString()}<span style={{ fontSize: 22 }}>P</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveHistory} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,215,0,0.1)", color: "#FFD700", border: "1px solid #FFD700", fontSize: 12 }}>💾 저장</button>
                  <button onClick={() => exportCSV(result)} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontSize: 12 }}>📥 CSV</button>
                </div>
              </div>
            </div>
            
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
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
                  {limit && (
                    <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((d.sum/limit)*100, 100)}%`, background: d.sum > limit ? "#ff8a80" : cat.color }} />
                    </div>
                  )}
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
