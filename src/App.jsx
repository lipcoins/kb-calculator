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
      borderBottom: active ? "3px solid #FFD700" : "
