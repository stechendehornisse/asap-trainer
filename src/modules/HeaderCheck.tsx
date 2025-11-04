import { useState } from "react";
import { parseHeaders } from "../lib/parseHeaders";

export default function HeaderCheck() {
  const [raw, setRaw] = useState("");
  const [out, setOut] = useState<ReturnType<typeof parseHeaders> | null>(null);

  return (
    <div>
      <h2>Header Check</h2>
      <p>Вставьте «сырые» заголовки письма целиком и нажмите «Проанализировать».</p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={12}
        style={{ width: "100%", fontFamily: "monospace" }}
        placeholder="Вставьте заголовки письма..."
      />

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={() => setOut(parseHeaders(raw))}>Проанализировать</button>
        <button onClick={() => { setRaw(""); setOut(null); }}>Очистить</button>
      </div>

      {out && (
        <div style={{ marginTop: 16 }}>
          <h3>Результат</h3>
          <ul>
            <li>SPF: <b>{out.spf || "нет данных"}</b></li>
            <li>DKIM: <b>{out.dkim || "нет данных"}</b></li>
            <li>DMARC: <b>{out.dmarc || "нет данных"}</b></li>
            <li>Количество Received: <b>{out.receivedHops}</b></li>
            <li>Флаги: <b>{out.flags.join(", ") || "—"}</b></li>
          </ul>
        </div>
      )}
    </div>
  );
}
