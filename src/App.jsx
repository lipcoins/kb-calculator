import { useState, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const CATEGORIES = [
  { key: "gas",      label: "⛽ 주유소",       color: "#FF6B35" },
  { key: "woowa",    label: "🍔 우아한형제들",  color: "#FFAA00" },
  { key: "shopping", label: "🛍️ 쇼핑몰",       color: "#4ECDC4" },
  { key: "telecom",  label: "📱 통신요금",      color: "#45B7D1" },
  { key: "other",    label: "🔹 기타",          color: "#9E9E9E" },
];

const ALL_KEYS = ["gas", "woowa", "shopping", "telecom", "other"];

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
  const rows = [["월", "카테고리", "가맹점", "적립금(P)"]];
  for (const cat of CATEGORIES) {
    for (const item of result.totals[cat.key]?.items || []) {
      rows.push([result.month, cat.label, item.name, item.amount]);
    }
  }
  rows.push(["", "", "합계", result.grand]);
  const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `KB비즈티타늄_${result.month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const AI_IMG_PROMPT = `이 이미지는 KB국민카드 비즈티타늄 카드 이용내역입니다.
파란색 글씨로 표시된 "적립" 항목들만 찾아서 카테고리별로 분류해주세요.
카테고리: gas(주유소), woowa(우아한형제들), shopping(KB제휴몰/G마켓/옥션 등 쇼핑몰), telecom(통신요금/SK브로드밴드), other(기타)
JSON만 응답(설명 없이):
{"gas":[{"name":"가맹점명","amount":숫자}],"woowa":[...],"shopping":[...],"telecom":[...],"other":[...]}
amount는 숫자만. 없으면 빈 배열.`;

const AI_TXT_PROMPT = (text) => `다음 KB국민카드 비즈티타늄 카드 이용내역에서 "적립" 항목들을 카테고리별로 분류해주세요.
카테고리: gas(주유소), woowa(우아한형제들), shopping(KB제휴몰/G마켓/옥션 등 쇼핑몰), telecom(통신요금/SK브로드밴드), other(기타)
이용내역:\n${text}
JSON만 응답(설명 없이):
{"gas":[{"name":"가맹점명","amount":숫자}],"woowa":[...],"shopping":[...],"telecom":[...],"other":[...]}
amount는 숫자만. 없으면 빈 배열.`;

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

function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "9px 0", border: `1px solid ${active ? "#FFD700" : "rgba(255,255,255,0.12)"}`,
      borderRadius: 10, cursor: "pointer",
      background: active ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
      color: active ? "#FFD700" : "rgba(255,255,255,0.45)",
      fontSize: 13, fontWeight: active ? 700 : 400,
      transition: "all 0.2s", fontFamily: "'Noto Sans KR', sans-serif",
    }}>{children}</button>
  );
}

export default function App() {
  const [mainTab, setMainTab]     = useState("input");
  const [inputMode, setInputMode] = useState("image");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [history, setHistory]     = useState([]);
  const [chartType, setChartType] = useState("pie");
  const [month, setMonth]         = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setImageFile(file); setResult(null); setError(null);
    const r = new FileReader();
    r.onload = (e) => setImagePreview(e.target.result);
    r.readAsDataURL(file);
  };

  const analyze = async () => {
    const canGo = inputMode === "image" ? !!imageFile : textInput.trim().length > 0;
    if (!canGo) return;
    setLoading(true); setError(null);
    try {
      let messages;
      if (inputMode === "image") {
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(imageFile);
        });
        messages = [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: imageFile.type || "image/jpeg", data: base64 } },
          { type: "text", text: AI_IMG_PROMPT },
        ]}];
      } else {
        messages = [{ role: "user", content: AI_TXT_PROMPT(textInput.trim()) }];
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages }),
      });
      const data = await response.json();
      const text = data.content.map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const { totals, grand } = buildTotals(parsed);
      setResult({ totals, grand, month });
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
    alert(`${result.month} 저장 완료!`);
  };

  const deleteHistory = (m) => setHistory(prev => prev.filter(h => h.month !== m));

  const chartData = result
    ? CATEGORIES.filter(c => result.totals[c.key]?.sum > 0).map(c => ({
        name: c.label, value: result.totals[c.key].sum, color: c.color,
      }))
    : [];

  const canAnalyze = inputMode === "image" ? !!imageFile : textInput.trim().length > 0;

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
            {[["input","📷 분석"], ["result","📊 결과"], ["history","📅 히스토리"]].map(([k, l]) => (
              <TabBtn key={k} active={mainTab === k} onClick={() => setMainTab(k)}>{l}</TabBtn>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "22px 16px 56px" }}>

        {/* ── INPUT TAB ── */}
        {mainTab === "input" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>월 선택</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 15, outline: "none",
                width: "100%", boxSizing: "border-box",
              }} />
            </div>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <ModeBtn active={inputMode === "image"} onClick={() => setInputMode("image")}>📷 이미지 업로드</ModeBtn>
              <ModeBtn active={inputMode === "text"}  onClick={() => setInputMode("text")}>✏️ 텍스트 입력</ModeBtn>
            </div>

            {/* Image upload */}
            {inputMode === "image" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{
                  display: "block",
                  border: `2px dashed ${imagePreview ? "#FFD700" : "rgba(255,255,255,0.16)"}`,
                  borderRadius: 16, padding: "28px 20px", textAlign: "center", cursor: "pointer",
                  background: imagePreview ? "rgba(255,215,0,0.04)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.25s",
                }}>
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                  {imagePreview ? (
                    <div>
                      <img src={imagePreview} alt="preview" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 10, marginBottom: 10 }} />
                      <div style={{ fontSize: 13, color: "#FFD700" }}>✓ 이미지 선택됨 · 탭하여 변경</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>카드 이용내역 스크린샷</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>탭해서 사진 선택 또는 촬영</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 6 }}>파란색 "적립" 항목을 AI가 자동 인식합니다</div>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Text input */}
            {inputMode === "text" && (
              <div style={{ marginBottom: 18 }}>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder={"이용내역을 붙여넣기 하세요.\n예시:\n2024-01-05  GS칼텍스  적립  150P\n2024-01-07  배달의민족  적립  80P\n2024-01-10  G마켓  적립  200P\n2024-01-15  SK텔레콤  통신요금 적립  300P"}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14, padding: 16, color: "#e8eaf6", fontSize: 13, lineHeight: 1.75,
                    outline: "none", resize: "vertical", minHeight: 210, fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                />
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>
                  앱/웹에서 복사한 내역을 그대로 붙여넣기 하세요. AI가 적립 항목을 자동 분류합니다.
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.22)", borderRadius: 10, padding: 13, marginBottom: 14, fontSize: 13, color: "#ff8a80" }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={analyze} disabled={!canAnalyze || loading} style={{
              width: "100%", padding: 15, borderRadius: 14, border: "none",
              cursor: canAnalyze && !loading ? "pointer" : "not-allowed",
              background: canAnalyze && !loading ? "linear-gradient(135deg, #FFD700, #FFA000)" : "rgba(255,255,255,0.07)",
              color: canAnalyze && !loading ? "#0a0e1a" : "rgba(255,255,255,0.2)",
              fontSize: 15, fontWeight: 700, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.25s",
            }}>
              {loading ? "🔍 AI 분석 중..." : "✨ 적립금 분석하기"}
            </button>

            <div style={{ marginTop: 22, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#FFD700" }}>📌 분석 카테고리</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                {CATEGORIES.filter(c => c.key !== "other").map(c => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT TAB ── */}
        {mainTab === "result" && (
          <div>
            {!result ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.22)" }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>📊</div>
                <div style={{ fontSize: 14 }}>분석 탭에서 이미지를 분석하면<br />결과가 여기에 표시됩니다</div>
              </div>
            ) : (
              <div>
                {/* Grand total */}
                <div style={{ background: "linear-gradient(135deg, #1a237e, #0d47a1)", borderRadius: 18, padding: "22px 24px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{result.month} 총 적립금</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, color: "#FFD700", letterSpacing: 2, lineHeight: 1 }}>
                      {result.grand.toLocaleString()}<span style={{ fontSize: 22, marginLeft: 5 }}>P</span>
                    </div>
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

                {/* Chart */}
                {chartData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 14px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>카테고리별 비율</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["pie","bar"].map(t => (
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
                          <Tooltip formatter={v => `${v.toLocaleString()}P`} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                          <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                        </PieChart>
                      ) : (
                        <BarChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }} />
                          <Tooltip formatter={v => `${v.toLocaleString()}P`} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="value" radius={[5,5,0,0]}>
                            {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Breakdown */}
                {CATEGORIES.map(cat => {
                  const d = result.totals[cat.key];
                  if (!d || d.sum === 0) return null;
                  return (
                    <div key={cat.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 13, padding: "14px 16px", marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, color: cat.color, letterSpacing: 1 }}>{d.sum.toLocaleString()}P</div>
                      </div>
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

        {/* ── HISTORY TAB ── */}
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
                        <Tooltip formatter={v => `${v.toLocaleString()}P`} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="value" fill="#FFD700" radius={[5,5,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {history.map(h => (
                  <div key={h.month} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{h.month}</div>
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
