import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// 1. 카테고리 정의 (원본 그대로 유지)
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

// 2. 보조 함수 (원본 그대로 유지)
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
  rows.push(["", "", "", "합계", result.grand]);
  const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "KB비즈티타늄_" + result.month + ".csv"; a.click();
  URL.revokeObjectURL(url);
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

  // 🛠️ 핵심 변경: AI 통신 대신 로컬 정규식 파서 탑재
  const analyze = () => {
    if (!textInput.trim()) return;
    setError(null);
    
    try {
      const parsed = { gas: [], mart: [], shopping: [], telecom: [], delivery: [], water: [], other: [] };
      const lines = textInput.split("\n");

      lines.forEach(line => {
        if (!line.trim()) return;
        // KB Pay 적립 내역 정규식: (가맹점명) 적립 (금액)P
        const match = line.match(/(.*?)\s+적립\s+([\d,]+)P/);
        if (match) {
          const name = match[1].trim();
          const amount = parseInt(match[2].replace(/,/g, ""), 10);

          if (["주유", "SK", "GS", "에쓰", "오일"].some(k => name.includes(k))) parsed.gas.push({ name, amount });
          else if (["이마트", "홈플러스", "롯데마트", "하나로", "식자재"].some(k => name.includes(k))) parsed.mart.push({ name, amount });
          else if (["G마켓", "옥션", "11번가", "인터파크", "롯데닷컴", "신세계몰", "KB제휴몰", "SSG"].some(k => name.includes(k))) parsed.shopping.push({ name, amount });
          else if (["SK브로드", "LiivM", "LGUPLUS", "LG유플", "SKT", "KT"].some(k => name.includes(k))) parsed.telecom.push({ name, amount });
          else if (["우아한형", "배달의민족", "마켓컬리"].some(k => name.includes(k))) parsed.delivery.push({ name, amount });
          else if (name.toLowerCase().includes("coway") || name.includes("코웨이")) parsed.water.push({ name, amount });
          else parsed.other.push({ name, amount });
        }
      });

      const { totals, grand } = buildTotals(parsed);
      setResult({ totals, grand, month, tier });
      setMainTab("result");
    } catch (e) {
      setError("데이터 분류 중 오류가 발생했습니다.");
    }
  };

  // 나머지 UI 렌더링 코드 (원본 그대로 유지)
  const saveHistory = () => {
    if (!result) return;
    setHistory(prev => {
      const filtered = prev.filter(h => h.month !== result.month);
      return [{ ...result }, ...filtered].sort((a, b) => b.month.localeCompare(a.month));
    });
    alert(result.month + " 저장 완료!");
  };

  const deleteHistory = (m) => setHistory(prev => prev.filter(h => h.month !== m));

  const chartData = result
    ? CATEGORIES.filter(c => result.totals[c.key]?.sum > 0).map(c => ({
        name: c.label, value: result.totals[c.key].sum, color: c.color,
      }))
    : [];

  const effectiveGrand = result
    ? ALL_KEYS.reduce((acc, key) => {
        const sum = result.totals[key]?.sum || 0;
        const limit = TIER_LIMITS[result.tier || "40"][key];
        return acc + (limit ? Math.min(sum, limit) : sum);
      }, 0)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'Noto Sans KR', sans-serif", color: "#e8eaf6" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Bebas+Neue&display=swap" rel="stylesheet" />
      
      {/* Header - 원본 UI 복구 */}
      <div style={{ background: "linear-gradient(135deg, #1a237e 0%, #0d47a1 60%, #01579b 100%)", padding: "22px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ background: "linear-gradient(135deg, #FFD700, #FFA000)", borderRadius: 10, padding: "7px 13px", fontFamily: "'Bebas Neue'", fontSize: 19, color: "#0a0e1a", letterSpacing: 1 }}>KB</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, letterSpacing: 2.5, color: "#fff" }}>BIZ TITANIUM</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5 }}>적립금 계산기</div>
            </div>
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
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>월 선택</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 8 }}>전월 실적 구간</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["40", "💳 전월 실적 40만 이상"], ["80", "💎 전월 실적 80만 이상"]].map(([val, label]) => (
                  <button key={val} onClick={() => setTier(val)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid " + (tier === val ? "#FFD700" : "rgba(255,255,255,0.12)"), background: tier === val ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)", color: tier === val ? "#FFD700" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: tier === val ? 700 : 400 }}>{label}</button>
                ))}
              </div>
              <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[{ label: "⛽ 주유", key: "gas" }, { label: "🛒 마트", key: "mart" }, { label: "🛍️ 쇼핑", key: "shopping" }, { label: "📱 통신", key: "telecom" }, { label: "🍔 배달", key: "delivery" }, { label: "💧 정수기", key: "water" }].map(({ label, key }) => (
                    <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 4px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>{(TIER_LIMITS[tier][key] / 10000).toFixed(0)}만P</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={"KB Pay 이용내역을 붙여넣으세요..."} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, color: "#fff", fontSize: 13, minHeight: 220, outline: "none" }} />
            <button onClick={analyze} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a0e1a", fontSize: 15, fontWeight: 700, marginTop: 20, cursor: "pointer" }}>✨ 적립금 분석하기</button>
          </div>
        )}

        {/* RESULT TAB - 상세 프로그레스 바 로직 복구 */}
        {mainTab === "result" && result && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "22px 24px", marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{result.month} · {result.tier}만 실적 기준</div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700", letterSpacing: 2 }}>{effectiveGrand.toLocaleString()}<span style={{ fontSize: 22 }}>P</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={saveHistory} style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.35)", fontSize: 12, cursor: "pointer" }}>💾 저장</button>
                  <button onClick={() => exportCSV(result)} style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(78,205,196,0.08)", color: "#4ECDC4", border: "1px solid rgba(78,205,196,0.35)", fontSize: 12, cursor: "pointer" }}>📥 CSV</button>
                </div>
              </div>
            </div>

            {CATEGORIES.map(cat => {
              const d = result.totals[cat.key];
              if (!d || d.sum === 0) return null;
              const limit = TIER_LIMITS[result.tier][cat.key];
              const isOver = limit && d.sum > limit;
              const pct = limit ? Math.min(Math.round((d.sum / limit) * 100), 100) : 100;

              return (
                <div key={cat.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 13, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div></div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: isOver ? "#ff8a80" : cat.color }}>{Math.min(d.sum, limit || Infinity).toLocaleString()}P</div>
                    </div>
                  </div>
                  {limit && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: isOver ? "#ff8a80" : cat.color, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.3, marginTop: 3 }}>{d.sum.toLocaleString()}P / {limit.toLocaleString()}P 한도</div>
                    </div>
                  )}
                  {d.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12, opacity: 0.6 }}>
                      <span>{item.name}</span><span>{item.amount.toLocaleString()}P</span>
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
