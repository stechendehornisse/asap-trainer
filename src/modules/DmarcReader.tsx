import { useState } from "react";
import { parseDmarcXml, DmarcStat } from "../lib/parseDmarc";

export default function DmarcReader() {
  const [stat, setStat] = useState<DmarcStat | null>(null);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr("");
    setStat(null);
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const s = parseDmarcXml(text);
      setStat(s);
    } catch (ex: any) {
      setErr("Ошибка парсинга XML: " + (ex?.message || ""));
    }
  }

  return (
    <div>
      <h2>DMARC RUA Reader</h2>
      <p>Загрузите XML-отчёт RUA (агрегированный).</p>
      <input type="file" accept=".xml" onChange={onFile} />
      {err && <p style={{ color: "red" }}>{err}</p>}
      {stat && (
        <div style={{ marginTop: 12 }}>
          <p>Всего сообщений: <b>{stat.total}</b></p>
          <p>Pass: <b>{stat.pass}</b> | Fail: <b>{stat.fail}</b></p>
          <h3>Топ источники</h3>
          <ul>
            {Object.entries(stat.bySource).slice(0, 10).map(([ip, cnt]) => (
              <li key={ip}>{ip}: {cnt}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
