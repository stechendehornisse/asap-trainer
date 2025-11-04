import { useState } from "react";
import { lintRules, RuleFinding } from "../lib/lintRules";

export default function RulesAudit() {
  const [text, setText] = useState("");
  const [findings, setFindings] = useState<RuleFinding[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
    setFindings(lintRules(t));
  }

  return (
    <div>
      <h2>Rules Audit</h2>
      <p>Загрузите CSV с правилами почтового ящика (перенаправления, перемещения, удаления).</p>
      <input type="file" accept=".csv" onChange={onFile} />
      {text && (
        <>
          <p style={{ marginTop: 8 }}>Загружено {Math.max(0, text.split(/\r?\n/).length - 1)} правил.</p>
          <h3>Находки</h3>
          <ul>
            {findings.length === 0 && <li>Подозрительных правил не обнаружено</li>}
            {findings.map((f) => (
              <li key={f.index}>
                Строка {f.index}: [{f.severity}] {f.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
