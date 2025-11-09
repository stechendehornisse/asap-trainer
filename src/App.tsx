import { useState } from "react";
import Quiz from "./modules/Quiz";
import HeaderCheck from "./modules/HeaderCheck";
import DmarcReader from "./modules/DmarcReader";
import RulesAudit from "./modules/RulesAudit";

const VERSION = "v0.2.1"; // версия без даты

const tabs = [
  { key: "quiz", label: "Quiz" },
  { key: "headers", label: "Header Check" },
  { key: "dmarc", label: "DMARC RUA Reader" },
  { key: "rules", label: "Rules Audit" },
];

export default function App() {
  const [active, setActive] = useState("quiz");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      {/* Шапка с логотипом слева */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="ASAP — anti-BEC trainer"
          style={{ height: 28 }}
        />
        <div style={{ fontWeight: 800 }}>
          ASAP — Anti-BEC Skill Assessment Platform
          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>{VERSION}</span>
        </div>
      </header>

      <p>Учебный тренажёр для техперсонала: почтовая инфраструктура и BEC.</p>

      {/* Вкладки */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: active === t.key ? "2px solid #111" : "1px solid #bbb",
              background: active === t.key ? "#f3f4f6" : "#fff",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Контент вкладок */}
      {active === "quiz" && <Quiz />}
      {active === "headers" && <HeaderCheck />}
      {active === "dmarc" && <DmarcReader />}
      {active === "rules" && <RulesAudit />}

      <hr style={{ margin: "24px 0" }} />
      <small>Все данные — учебные. Реальные корпоративные артефакты не используйте.</small>
    </div>
  );
}
