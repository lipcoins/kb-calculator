import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// 1. 카테고리 및 정밀 키워드 정의
const CATEGORIES = [
  { key: "gas",      label: "⛽ 주유소",       color: "#FF6B35", keywords: ["주유", "SK엔", "GS칼", "에쓰오", "현대오"] },
  { key: "mart",     label: "🛒 대형마트",      color: "#A78BFA", keywords: ["이마트", "홈플러스", "롯데마트", "하나로", "식자재", "트레이더스"] },
  { key: "shopping", label: "🛍️ 온라인 쇼핑", color: "#4ECDC4", keywords: ["G마켓", "옥션", "11번가", "인터파크", "롯데닷컴", "신세계몰", "SSG", "KB제휴몰", "G마켓", "쿠팡"] },
  { key: "telecom",  label: "📱 통신/기타",     color: "#45B7D1", keywords: ["SK브로드", "LiivM", "LGUPLUS", "LG유플", "SKT", "KT", "알뜰폰", "전기", "도시가스", "아파트"] },
  { key: "delivery", label: "🍔 배달/외식",     color: "#FFAA00", keywords: ["우아한형", "배달의민", "마켓컬리", "쿠팡이츠", "요기요"] },
  { key: "water",    label: "💧 정수기",       color: "#60A5FA", keywords: ["코웨이", "COWAY", "coway", "렌탈"] },
  { key: "other",    label: "🔹 기타/실적용",    color: "#9E9E9E", keywords: [] },
];

const TIER_LIMITS = {
  "40": { gas: 14000, mart: 15000, shopping: 15000, telecom: 10000, delivery: 10000, water: 10000 },
  "80": { gas: 24000, mart: 20000, shopping: 20000, telecom: 10000, delivery: 10000, water: 10000 },
};

// 2. 유틸리티 함수들 (로직 복구)
function parseTextLocally(text) {
  const lines = text.split('\n');
  const result = { gas: [], mart: [], shopping: [], telecom: [], delivery: [], water: [], other: [] };

  lines.forEach(line => {
    if (!line.trim()) return;
    const amountMatch = line.match(/([\d,]+)\s*P/);
    if (!amountMatch) return;
    const amount = parseInt(amountMatch[1].replace(/,/g, ''));
    const namePart = line.replace(amountMatch[0], '').replace(/적립/g, '').trim();

    let matched = false;
    for (const cat of CATEGORIES) {
      if (cat.keywords.some(kw => namePart.includes(kw))) {
        result[cat.key].push({ name: namePart, amount });
        matched = true; break;
      }
    }
    if (!matched) result.other.push({ name: namePart, amount });
  });
  return result;
}

function exportCSV(result) {
  const rows = [["월", "실적구간", "카테고리", "가맹점", "적립금(P)"]];
  CATEGORIES.forEach(cat => {
    (result.totals[cat.key]?.items || []).forEach(item => {
      rows.push([result.month, result.tier + "만", cat.label, item.name, item.amount]);
    });
  });
  const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `KB_Biz_${result.month}.csv`; a.click();
}

// 3. UI 컴포넌트
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
      background: active ? "rgba(255,255,255,0.14)" : "transparent",
      color: active ? "#FFD700" : "rgba(255,255,255,0.5)",
      fontSize: 14, fontWeight: active ? 700 : 400,
      borderBottom: active ? "3px solid #FFD700" : "3px solid transparent",
      transition: "all 0.2s",
    }}>{children}</button>
  );
}

export default function App() {
  const [mainTab, setMainTab] = useState("input");
  const [tier, setTier] = useState("40");
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [chartType, setChartType] = useState("pie");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const analyze = () => {
    if (!textInput.trim()) return;
    const parsed = parseTextLocally(textInput);
    const totals = {};
    let grand = 0;
    CATEGORIES.forEach(cat => {
      const items = parsed[cat.key] || [];
      const sum = items.reduce((acc, i) => acc + i.amount, 0);
      totals[cat.key] = { items, sum };
      grand += sum;
    });
    setResult({ totals, grand, month, tier });
    setMainTab("result");
  };

  const saveHistory = () => {
    if (!result) return;
    setHistory(prev => [{ ...result }, ...prev.filter(h => h.month !== result.month)]);
    alert("저장되었습니다!");
  };

  const effectiveGrand = result ? CATEGORIES.reduce((acc, cat) => {
    const sum = result.totals[cat.key]?.sum || 0;
    const limit = TIER_LIMITS[result.tier][cat.key];
    return acc + (limit ? Math.min(sum, limit) : sum);
  }, 0) : 0;

  const chartData = result ? CATEGORIES.filter(c => result.totals[c.key]?.sum > 0).map(c => ({
    name: c.label, value: result.totals[c.key].sum, color: c.color,
  })) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf6", fontFamily: "'Noto Sans KR', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a237e, #01579b)", padding: "20px 20px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#FFD700", color: "#000", padding: "5px 10px", borderRadius: 8, fontFamily: "'Bebas Neue'", fontSize: 20 }}>KB</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, letterSpacing: 2 }}>BIZ TITANIUM 🦞</div>
          </div>
          <div style={{ display: "flex" }}>
            <TabBtn active={mainTab === "input"} onClick={() => setMainTab("input")}>✏️ 입력</TabBtn>
            <TabBtn active={mainTab === "result"} onClick={() => setMainTab("result")}>📊 결과</TabBtn>
            <TabBtn active={mainTab === "history"} onClick={() => setMainTab("history")}>📅 기록</TabBtn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
        {mainTab === "input" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, opacity: 0.6 }}>월 선택</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: "100%", padding: 12, background: "#161b2a", border: "1px solid #30363d", color: "#fff", borderRadius: 10, marginTop: 5 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, opacity: 0.6 }}>실적 구간</label>
              <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                {["40", "80"].map(v => (
                  <button key={v} onClick={() => setTier(v)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid " + (tier === v ? "#FFD700" : "#30363d"), background: tier === v ? "rgba(255,215,0,0.1)" : "transparent", color: tier === v ? "#FFD700" : "#8b949e", cursor: "pointer" }}>{v}만 이상</button>
                ))}
              </div>
            </div>
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="KB Pay 내역을 붙여넣으세요..." style={{ width: "100%", height: 250, background: "#161b2a", border: "1px solid #30363d", borderRadius: 12, padding: 15, color: "#fff", outline: "none" }} />
            <button onClick={analyze} style={{ width: "100%", padding: 16, background: "#FFD700", color: "#000", border: "none", borderRadius: 12, fontWeight: 700, marginTop: 20, cursor: "pointer" }}>⚡ 즉시 분석 (Local)</button>
          </div>
        )}

        {mainTab === "result" && result && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 20, padding: 25, marginBottom: 20 }}>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{result.month} · {result.tier}만 실적 기준</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 50, color: "#FFD700" }}>{effectiveGrand.toLocaleString()} <span style={{ fontSize: 20 }}>P</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveHistory} style={{ padding: "8px 15px", borderRadius: 8, background: "rgba(255,215,0,0.2)", color: "#FFD700", border: "none", cursor: "pointer" }}>💾 저장</button>
                  <button onClick={() => exportCSV(result)} style={{ padding: "8px 15px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer" }}>📥 CSV</button>
                </div>
              </div>
            </div>

            {/* 차트 영역 복구 */}
            <div style={{ background: "#161b2a", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>카테고리 비율</span>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => setChartType("pie")} style={{ fontSize: 11, background: chartType === "pie" ? "#FFD700" : "#30363d", color: chartType === "pie" ? "#000" : "#fff", border: "none", padding: "3px 8px", borderRadius: 5 }}>원형</button>
                  <button onClick={() => setChartType("bar")} style={{ fontSize: 11, background: chartType === "bar" ? "#FFD700" : "#30363d", color: chartType === "bar" ? "#000" : "#fff", border: "none", padding: "3px 8px", borderRadius: 5 }}>막대</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                {chartType === "pie" ? (
                  <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /><Legend /></PieChart>
                ) : (
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#30363d" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* 상세 리스트 및 프로그레스 바 복구 */}
            {CATEGORIES.map(cat => {
              const d = result.totals[cat.key];
              if (!d || d.sum === 0) return null;
              const limit = TIER_LIMITS[result.tier][cat.key];
              const pct = limit ? Math.min((d.sum / limit) * 100, 100) : 0;
              return (
                <div key={cat.key} style={{ background: "#161b2a", borderRadius: 15, padding: 18, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700 }}>{cat.label}</span>
                    <span style={{ color: d.sum > limit ? "#ff7b72" : cat.color, fontWeight: 700 }}>{Math.min(d.sum, limit || Infinity).toLocaleString()}P</span>
                  </div>
                  {limit && (
                    <div style={{ marginBottom: 15 }}>
                      <div style={{ height: 6, background: "#30363d", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: d.sum > limit ? "#ff7b72" : cat.color, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 5 }}>{d.sum.toLocaleString()}P / {limit.toLocaleString()}P 한도</div>
                    </div>
                  )}
                  {d.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, padding: "4px 0", borderTop: "1px solid #30363d" }}>
                      <span>{it.name}</span><span>{it.amount.toLocaleString()}P</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {mainTab === "history" && (
          <div style={{ textAlign: history.length ? "left" : "center", padding: history.length ? 0 : 50 }}>
            {history.length ? history.map(h => (
              <div key={h.month} style={{ background: "#161b2a", borderRadius: 15, padding: 20, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 700 }}>{h.month}</div><div style={{ fontSize: 12, opacity: 0.5 }}>실적 {h.tier}만</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#FFD700" }}>{h.grand.toLocaleString()}P</div>
                  <button onClick={() => setHistory(history.filter(p => p.month !== h.month))} style={{ background: "none", border: "none", color: "#ff7b72", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            )) : "저장된 기록이 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}
