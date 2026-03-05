import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// 1. 카테고리 및 키워드 정의 (주인님이 직접 튜닝 가능!)
const CATEGORIES = [
  { key: "gas",      label: "⛽ 주유소",       color: "#FF6B35", keywords: ["주유소", "SK엔크린", "GS칼텍스", "에쓰오일", "현대오일"] },
  { key: "mart",     label: "🛒 대형마트",      color: "#A78BFA", keywords: ["이마트", "홈플러스", "롯데마트", "하나로식자재", "트레이더스"] },
  { key: "shopping", label: "🛍️ 온라인 쇼핑", color: "#4ECDC4", keywords: ["G마켓", "옥션", "11번가", "인터파크", "롯데닷컴", "신세계몰", "SSG", "KB제휴몰"] },
  { key: "telecom",  label: "📱 통신/기타",     color: "#45B7D1", keywords: ["SK브로드밴드", "LiivM", "LGUPLUS", "LG유플러스", "SKT", "KT", "알뜰폰"] },
  { key: "delivery", label: "🍔 배달/외식",     color: "#FFAA00", keywords: ["우아한형제들", "배달의민족", "마켓컬리", "쿠팡이츠", "요기요"] },
  { key: "water",    label: "💧 정수기",       color: "#60A5FA", keywords: ["코웨이", "COWAY", "coway"] },
  { key: "other",    label: "🔹 기타",          color: "#9E9E9E", keywords: [] },
];

const TIER_LIMITS = {
  "40": { gas: 14000, mart: 15000, shopping: 15000, telecom: 10000, delivery: 10000, water: 10000 },
  "80": { gas: 24000, mart: 20000, shopping: 20000, telecom: 10000, delivery: 10000, water: 10000 },
};

// 2. 로컬 분석 엔진 (AI 없이 텍스트 파싱)
function parseTextLocally(text) {
  const lines = text.split('\n');
  const result = { gas: [], mart: [], shopping: [], telecom: [], delivery: [], water: [], other: [] };

  lines.forEach(line => {
    if (!line.trim()) return;

    // 가맹점명과 금액(P) 추출 (예: "이마트 적립 1,500P" -> name: 이마트, amount: 1500)
    const amountMatch = line.match(/([\d,]+)\s*P/);
    if (!amountMatch) return;

    const amount = parseInt(amountMatch[1].replace(/,/g, ''));
    const namePart = line.replace(amountMatch[0], '').replace(/적립/g, '').trim();

    // 키워드 매칭
    let matched = false;
    for (const cat of CATEGORIES) {
      if (cat.keywords.some(kw => namePart.includes(kw))) {
        result[cat.key].push({ name: namePart, amount });
        matched = true;
        break;
      }
    }
    if (!matched) result.other.push({ name: namePart, amount });
  });

  return result;
}

// UI 컴포넌트들 (기존과 동일)
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
  const [history, setHistory] = useState([]);
  const [chartType, setChartType] = useState("pie");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });

  // 3. 분석 함수 수정 (API 호출 삭제!)
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

  const effectiveGrand = result
    ? CATEGORIES.reduce((acc, cat) => {
        const sum = result.totals[cat.key]?.sum || 0;
        const limit = TIER_LIMITS[result.tier][cat.key];
        return acc + (limit ? Math.min(sum, limit) : sum);
      }, 0)
    : 0;

  const chartData = result
    ? CATEGORIES.filter(c => result.totals[c.key]?.sum > 0).map(c => ({
        name: c.label, value: result.totals[c.key].sum, color: c.color,
      }))
    : [];

  // (이후 렌더링 코드는 기존과 동일하되 로딩 상태 등은 삭제)
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'Noto Sans KR', sans-serif", color: "#e8eaf6" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a237e 0%, #0d47a1 60%, #01579b 100%)", padding: "22px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ background: "linear-gradient(135deg, #FFD700, #FFA000)", borderRadius: 10, padding: "7px 13px", fontFamily: "'Bebas Neue'", fontSize: 19, color: "#0a0e1a", letterSpacing: 1 }}>KB</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, letterSpacing: 2.5, color: "#fff" }}>BIZ TITANIUM</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5 }}>LOBSTER EDITION 🦞</div>
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
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 15, width: "100%", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 8 }}>전월 실적 구간</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["40", "💳 40만 이상"], ["80", "💎 80만 이상"]].map(([val, label]) => (
                  <button key={val} onClick={() => setTier(val)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid " + (tier === val ? "#FFD700" : "rgba(255,255,255,0.12)"), background: tier === val ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)", color: tier === val ? "#FFD700" : "rgba(255,255,255,0.45)", fontWeight: tier === val ? 700 : 400 }}>{label}</button>
                ))}
              </div>
            </div>

            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={"KB Pay 이용내역을 붙여넣으세요.\n예: 02월10일 GS칼텍스 적립 1,500P"}
              style={{ width: "100%", height: 200, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, color: "#fff", outline: "none", marginBottom: 20 }}
            />

            <button onClick={analyze} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a0e1a", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              ⚡ 0.1초 로컬 분석 실행
            </button>
          </div>
        )}

        {/* 결과 탭 (기존 UI 로직 유지) */}
        {mainTab === "result" && result && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "22px 24px", marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{result.month} · {result.tier}만 실적 기준</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700" }}>{effectiveGrand.toLocaleString()}P</div>
            </div>
            {/* ... 차트 및 상세 내역 렌더링 (기존 코드와 동일) ... */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14 }}>
               <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
