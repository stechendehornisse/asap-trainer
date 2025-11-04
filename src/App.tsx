import { useState } from "react";
import Quiz from "./modules/Quiz";
import HeaderCheck from "./modules/HeaderCheck";
import DmarcReader from "./modules/DmarcReader";
import RulesAudit from "./modules/RulesAudit";

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
      <h1>
        ASAP — Anti-BEC Skill Assessment Platform{" "}
        <span style={{ fontSize: 12 }}>v0.1.0 (2025-11-04)</span>
      </h1>
      <p>Учебный тренажёр для техперсонала: почтовая инфраструктура и BEC.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: active === t.key ? "2px solid black" : "1px solid #bbb",
              background: active === t.key ? "#f0f0f0" : "white",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "quiz" && <Quiz />}
      {active === "headers" && <HeaderCheck />}
      {active === "dmarc" && <DmarcReader />}
      {active === "rules" && <RulesAudit />}

      <hr style={{ margin: "24px 0" }} />
      <small>Все данные — учебные. Реальные корпоративные артефакты не используйте.</small>
    </div>
  );
}