import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// 카테고리 정의
const CATEGORIES = [
  { key: "gas",      label: "⛽ 주유소",       color: "#FF6B35" },
  { key: "mart",     label: "🛒 대형마트",      color: "#A78BFA" },
  { key: "shopping", label: "🛍️ 온라인 쇼핑몰", color: "#4ECDC4" },
  { key: "telecom",  label: "📱 통신/기타",     color: "#45B7D1" },
  { key: "delivery", label: "🍔 배달/외식",     color: "#FFAA00" },
  { key: "water",    label: "💧 정수기",         color: "#60A5FA" },
  { key: "other",    label: "🔹 기타",          color: "#9E9E9E" },
];

const ALL_KEYS = ["gas", "mart", "shopping", "telecom", "delivery", "water", "other"];

// 전월 실적 구간별 월 한도
const TIER_LIMITS = {
  "40": { gas: 14000, mart: 15000, shopping: 15000, telecom: 10000, delivery: 10000, water: 10000, other: null },
  "80": { gas: 24000, mart: 20000, shopping: 20000, telecom: 10000, delivery: 10000, water: 10000, other: null },
};

// AI 분류 프롬프트 - 카테고리 키워드 명시
const AI_PROMPT = (text) =>
  "다음은 KB국민카드 비즈티타늄 카드 이용내역입니다.\n" +
  "적립 항목들을 아래 카테고리 기준으로 분류해주세요.\n\n" +
  "카테고리 기준 (키워드 매칭):\n" +
  "- gas: '주유소' 단어가 포함된 항목 (SK엔크린, GS칼텍스 등)\n" +
  "- mart: 이마트, 홈플러스, 롯데마트, 하나로식자재 포함 항목\n" +
  "- shopping: G마켓, 옥션, 11번가, 인터파크, 롯데닷컴, 신세계몰, KB제휴몰, SSG 포함 항목\n" +
  "- telecom: SK브로드밴드, 국민은행LiivM, LGUPLUS, LG유플러스, SKT, KT 포함 항목\n" +
  "- delivery: 우아한형제들, 배달의민족, 마켓컬리 포함 항목\n" +
  "- water: 코웨이, coway, COWAY 포함 항목\n" +
  "- other: 위 어디에도 해당 안 되는 항목\n\n" +
  "이용내역:\n" + text + "\n\n" +
  "JSON만 응답 (설명 없이):\n" +
  "{\"gas\":[{\"name\":\"가맹점명\",\"amount\":숫자}],\"mart\":[...],\"shopping\":[...],\"telecom\":[...],\"delivery\":[...],\"water\":[...],\"other\":[...]}\n" +
  "amount는 적립 포인트 숫자만. 없으면 빈 배열.";

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [chartType, setChartType] = useState("pie");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });

  const analyze = async () => {
    if (!textInput.trim()) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: AI_PROMPT(textInput.trim()) }],
        }),
      });
      const data = await response.json();
      const text = data.content.map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const { totals, grand } = buildTotals(parsed);
      setResult({ totals, grand, month, tier });
      setMainTab("result");
    } catch (e) {
      setError("분석 중 오류가 발생했습니다. 내용을 다시 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

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

  // 한도 적용된 실제 총합
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

      {/* Header */}
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

        {/* INPUT TAB */}
        {mainTab === "input" && (
          <div>
            {/* 월 선택 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>월 선택</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 15, outline: "none",
                width: "100%", boxSizing: "border-box",
              }} />
            </div>

            {/* 전월 실적 구간 선택 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 8 }}>전월 실적 구간</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["40", "💳 전월 실적 40만 이상"], ["80", "💎 전월 실적 80만 이상"]].map(([val, label]) => (
                  <button key={val} onClick={() => setTier(val)} style={{
                    flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid " + (tier === val ? "#FFD700" : "rgba(255,255,255,0.12)"),
                    background: tier === val ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)",
                    color: tier === val ? "#FFD700" : "rgba(255,255,255,0.45)",
                    fontSize: 13, fontWeight: tier === val ? 700 : 400,
                    fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.2s",
                  }}>{label}</button>
                ))}
              </div>
              {/* 구간별 한도 요약 */}
              <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>선택된 구간 월 적립 한도</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { label: "⛽ 주유", key: "gas" },
                    { label: "🛒 대형마트", key: "mart" },
                    { label: "🛍️ 쇼핑몰", key: "shopping" },
                    { label: "📱 통신", key: "telecom" },
                    { label: "🍔 배달", key: "delivery" },
                    { label: "💧 정수기", key: "water" },
                  ].map(({ label, key }) => (
                    <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 4px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>
                        {(TIER_LIMITS[tier][key] / 10000).toFixed(0)}만P
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 이용내역 입력 */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>이용내역 붙여넣기</label>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={"KB Pay 앱에서 이용내역을 복사해서 붙여넣기 하세요.\n\n예시:\n02월28일  우아한형제들  적립 2,630P\n02월25일  KB페이SSG  적립 1,490P\n02월21일  SK브로드밴드  적립 3,200P\n02월10일  GS칼텍스 주유소  적립 150P"}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14, padding: 16, color: "#e8eaf6", fontSize: 13, lineHeight: 1.8,
                  outline: "none", resize: "vertical", minHeight: 220, fontFamily: "'Noto Sans KR', sans-serif",
                }}
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>
                적립 항목이 포함된 내역을 그대로 붙여넣으면 AI가 자동 분류해요.
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.22)", borderRadius: 10, padding: 13, marginBottom: 14, fontSize: 13, color: "#ff8a80" }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={analyze} disabled={!textInput.trim() || loading} style={{
              width: "100%", padding: 15, borderRadius: 14, border: "none",
              cursor: textInput.trim() && !loading ? "pointer" : "not-allowed",
              background: textInput.trim() && !loading ? "linear-gradient(135deg, #FFD700, #FFA000)" : "rgba(255,255,255,0.07)",
              color: textInput.trim() && !loading ? "#0a0e1a" : "rgba(255,255,255,0.2)",
              fontSize: 15, fontWeight: 700, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.25s",
              marginBottom: 20,
            }}>
              {loading ? "🔍 AI 분석 중..." : "✨ 적립금 분석하기"}
            </button>
          </div>
        )}

        {/* RESULT TAB */}
        {mainTab === "result" && (
          <div>
            {!result ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.22)" }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>📊</div>
                <div style={{ fontSize: 14 }}>입력 탭에서 이용내역을 붙여넣고<br />분석하면 결과가 여기에 표시됩니다</div>
              </div>
            ) : (
              <div>
                {/* 총합 카드 */}
                <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "22px 24px", marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{result.month} · 전월실적 {result.tier}만 이상</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>한도 적용 총 적립금</div>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700", letterSpacing: 2, lineHeight: 1 }}>
                        {effectiveGrand.toLocaleString()}<span style={{ fontSize: 22, marginLeft: 5 }}>P</span>
                      </div>
                      {effectiveGrand !== result.grand && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                          원래 합계 {result.grand.toLocaleString()}P (한도 초과분 제외)
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button onClick={saveHistory} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,215,0,0.35)", background: "rgba(255,215,0,0.08)", color: "#FFD700", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif", whiteSpace: "nowrap" }}>
                        💾 저장
                      </button>
                      <button onClick={() => exportCSV(result)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(78,205,196,0.35)", background: "rgba(78,205,196,0.08)", color: "#4ECDC4", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif", whiteSpace: "nowrap" }}>
                        📥 CSV
                      </button>
                    </div>
                  </div>
                </div>

                {/* 차트 */}
                {chartData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 14px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>카테고리별 비율</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["pie", "bar"].map(t => (
                          <button key={t} onClick={() => setChartType(t)} style={{
                            padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                            background: chartType === t ? "rgba(255,215,0,0.18)" : "rgba(255,255,255,0.06)",
                            color: chartType === t ? "#FFD700" : "rgba(255,255,255,0.38)",
                            fontSize: 11, fontFamily: "'Noto Sans KR', sans-serif",
                          }}>{t === "pie" ? "원형" : "막대"}</button>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      {chartType === "pie" ? (
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                            {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={v => v.toLocaleString() + "P"} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                          <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                        </PieChart>
                      ) : (
                        <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }} />
                          <Tooltip formatter={v => v.toLocaleString() + "P"} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                            {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 카테고리별 상세 */}
                {CATEGORIES.map(cat => {
                  const d = result.totals[cat.key];
                  if (!d || d.sum === 0) return null;
                  const limit = TIER_LIMITS[result.tier || "40"][cat.key];
                  const isOver = limit && d.sum > limit;
                  const effectiveSum = limit ? Math.min(d.sum, limit) : d.sum;
                  const pct = limit ? Math.min(Math.round((d.sum / limit) * 100), 100) : null;

                  return (
                    <div key={cat.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 13, padding: "14px 16px", marginBottom: 10 }}>
                      {/* 카테고리 헤더 */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                          {limit && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                              월 {limit.toLocaleString()}P 한도 / 계산된 포인트 {d.sum.toLocaleString()}P
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: isOver ? "#ff8a80" : cat.color, letterSpacing: 1 }}>
                            {effectiveSum.toLocaleString()}P
                          </div>
                          {isOver && (
                            <div style={{ fontSize: 10, color: "#ff8a80" }}>⚠️ 한도 초과</div>
                          )}
                        </div>
                      </div>

                      {/* 프로그레스 바 */}
                      {limit && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: pct + "%",
                              background: isOver ? "#ff8a80" : cat.color,
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                            {pct}% 사용{isOver ? " (한도 초과 — " + (d.sum - limit).toLocaleString() + "P 미적립)" : ""}
                          </div>
                        </div>
                      )}

                      {/* 항목 리스트 */}
                      {d.items.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.52)" }}>
                          <span>{item.name}</span>
                          <span style={{ color: cat.color }}>{item.amount.toLocaleString()}P</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {mainTab === "history" && (
          <div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.22)" }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>📅</div>
                <div style={{ fontSize: 14 }}>저장된 히스토리가 없습니다<br /><span style={{ fontSize: 12, opacity: 0.7 }}>결과 탭에서 💾 저장 버튼을 눌러주세요</span></div>
              </div>
            ) : (
              <>
                {history.length > 1 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16, marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "rgba(255,255,255,0.65)" }}>월별 적립금 추이</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={[...history].reverse().map(h => ({ name: h.month.slice(5) + "월", value: h.grand }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }} />
                        <Tooltip formatter={v => v.toLocaleString() + "P"} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="value" fill="#FFD700" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {history.map(h => (
                  <div key={h.month} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{h.month}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>전월실적 {h.tier}만 이상</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "#FFD700" }}>{h.grand.toLocaleString()}P</div>
                        <button onClick={() => exportCSV(h)} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(78,205,196,0.3)", background: "transparent", color: "#4ECDC4", fontSize: 11, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" }}>CSV</button>
                        <button onClick={() => deleteHistory(h.month)} style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid rgba(255,80,80,0.25)", background: "transparent", color: "rgba(255,100,100,0.65)", fontSize: 11, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      {CATEGORIES.map(cat => {
                        const d = h.totals[cat.key];
                        if (!d || d.sum === 0) return null;
                        return (
                          <div key={cat.key} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 9, padding: "8px 11px" }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{cat.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: cat.color }}>{d.sum.toLocaleString()}P</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
