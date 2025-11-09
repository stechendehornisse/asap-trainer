import { useMemo, useState } from "react";

/** Вспомогательные типы для результатов */
type Verdict = "pass" | "fail" | "softfail" | "neutral" | "none" | "missing" | "other";
type Finding = { level: "высокий" | "средний" | "низкий"; text: string };

function takeField(raw: string, name: string): string | null {
  const re = new RegExp(`^${name}\\s*:\\s*(.+)$`, "im");
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}
function takeAll(raw: string, name: string): string[] {
  const re = new RegExp(`^${name}\\s*:\\s*(.+)$`, "gim");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out.push(m[1].trim());
  return out;
}
function hostFromAddr(addr: string | null): string | null {
  if (!addr) return null;
  const emailMatch = addr.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : addr;
  const at = email.lastIndexOf("@");
  return at > -1 ? email.slice(at + 1).toLowerCase() : null;
}
function extractVerdict(s: string, key: "spf" | "dkim" | "dmarc"): Verdict {
  const re = new RegExp(`${key}\\s*=\\s*([a-z]+)`, "i");
  const m = s.match(re);
  if (!m) return "missing";
  const v = m[1].toLowerCase();
  if (["pass", "fail", "softfail", "neutral", "none"].includes(v)) return v as Verdict;
  return "other";
}

/** Простейший учебный анализ заголовков */
function analyze(raw: string) {
  const from = takeField(raw, "From");
  const to = takeField(raw, "To");
  const subject = takeField(raw, "Subject");
  const date = takeField(raw, "Date");
  const msgId = takeField(raw, "Message-ID");
  const rpath = takeField(raw, "Return-Path");
  const rto = takeField(raw, "Reply-To");

  const authLines = [
    ...takeAll(raw, "Authentication-Results"),
    ...takeAll(raw, "ARC-Authentication-Results")
  ];
  const received = takeAll(raw, "Received");
  const xRule = takeField(raw, "X-MS-Exchange-Transport-Rules");

  const spf: Verdict = authLines.map(l => extractVerdict(l, "spf")).find(v => v !== "missing") ?? "missing";
  const dkim: Verdict = authLines.map(l => extractVerdict(l, "dkim")).find(v => v !== "missing") ?? "missing";
  const dmarc: Verdict = authLines.map(l => extractVerdict(l, "dmarc")).find(v => v !== "missing") ?? "missing";

  const fromHost = hostFromAddr(from);
  const rpathHost = hostFromAddr(rpath);
  const replyHost = hostFromAddr(rto);

  const findings: Finding[] = [];

  if (xRule) {
    findings.push({
      level: "средний",
      text: "Обнаружен заголовок X-MS-Exchange-Transport-Rules: письмо модифицировалось транспортными правилами."
    });
  }

  if (rto && replyHost && fromHost && replyHost !== fromHost) {
    findings.push({
      level: "средний",
      text: "Домен Reply-To отличается от From: возможная переадресация ответа на сторонний адрес."
    });
  }

  if (rpath && rpathHost && fromHost && rpathHost !== fromHost) {
    findings.push({
      level: "низкий",
      text: "Return-Path отличается от домена From: допустимо в некоторых сценариях, требуется контекстная проверка."
    });
  }

  const dmarcFailLikely =
    (spf === "fail" || spf === "softfail" || spf === "neutral" || spf === "none" || spf === "missing") &&
    (dkim === "fail" || dkim === "neutral" || dkim === "none" || dkim === "missing");

  if (dmarcFailLikely && (dmarc === "fail" || dmarc === "missing" || dmarc === "none" || dmarc === "neutral")) {
    findings.push({
      level: "высокий",
      text: "Признаки провала DMARC (ни SPF, ни DKIM не подтверждены для домена From)."
    });
  }

  const probableForward =
    raw.match(/x-forwarded-for/i) ||
    (xRule && /redirect|forward/i.test(xRule));

  if (probableForward) {
    findings.push({
      level: "средний",
      text: "Замечены признаки возможной переадресации: проверьте правила ящика и транспорта."
    });
  }

  if (received.length === 0) {
    findings.push({
      level: "средний",
      text: "Отсутствуют заголовки Received: анализ цепочки доставки затруднён."
    });
  }

  return {
    fields: { from, to, subject, date, msgId, rpath, rto },
    auth: { spf, dkim, dmarc },
    counts: { received: received.length, authLines: authLines.length },
    findings
  };
}

export default function HeaderCheck() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ReturnType<typeof analyze> | null>(null);
  const [busy, setBusy] = useState(false);

  const hasInput = raw.trim().length > 0;
  const canAnalyze = hasInput && !busy;
  const canClear = (hasInput || !!result) && !busy;

  const summary = useMemo(() => {
    if (!result) return null;
    const { fields, auth, counts } = result;
    return [
      fields.from ? `From: ${fields.from}` : null,
      fields.to ? `To: ${fields.to}` : null,
      fields.subject ? `Subject: ${fields.subject}` : null,
      fields.date ? `Date: ${fields.date}` : null,
      fields.msgId ? `Message-ID: ${fields.msgId}` : null,
      fields.rpath ? `Return-Path: ${fields.rpath}` : null,
      fields.rto ? `Reply-To: ${fields.rto}` : null,
      `SPF: ${auth.spf}`, `DKIM: ${auth.dkim}`, `DMARC: ${auth.dmarc}`,
      `Получено (Received): ${counts.received}`
    ].filter(Boolean) as string[];
  }, [result]);

  function onAnalyze() {
    if (!canAnalyze) return;
    setBusy(true);
    try {
      const r = analyze(raw);
      setResult(r);
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    if (!canClear) return;
    setRaw("");
    setResult(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /\.txt$|\.eml$/i.test(f.name);
    if (!ok) {
      alert("Допустимые форматы: .txt или .eml");
      e.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result || ""));
    reader.readAsText(f);
  }

  return (
    <div>
      <h2>Header Check</h2>

      <p className="hero-sub" style={{ marginTop: 0 }}>
        Цель: первичная проверка заголовков электронного письма на признаки подмены домена отправителя,
        некорректного прохождения SPF/DKIM/DMARC и применения транспортных правил.
      </p>

      <div style={{ margin: "10px 0 14px", fontSize: 13, color: "#94a3b8" }}>
        Данные: полный набор исходных заголовков сообщения (без тела). Допустимые форматы: <code>.txt</code>, <code>.eml</code>.
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder={"Вставьте полный набор исходных заголовков (Received, Authentication-Results, Return-Path, From, Reply-To, Message-ID и др.)."}
          style={{
            width: "100%",
            resize: "vertical",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.10)",
            background: "var(--card)",
            color: "var(--text)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.45
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label className="btn ghost" style={{ cursor: "pointer" }}>
            Загрузить файл (.txt/.eml)
            <input type="file" accept=".txt,.eml" onChange={onPickFile} style={{ display: "none" }} />
          </label>
          <button className="btn primary" onClick={onAnalyze} disabled={!canAnalyze}>
            Проанализировать
          </button>
          <button className="btn ghost" onClick={onClear} disabled={!canClear} title="Очистить поле и результаты">
            Очистить
          </button>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="t">Итоги проверки</div>

          <ul style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
            {summary!.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ul>

          <div className="t" style={{ marginTop: 10 }}>Замечания</div>
          {result.findings.length === 0 ? (
            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Критичных индикаторов не выявлено по эвристикам прототипа.
            </p>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {result.findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <b style={{ textTransform: "uppercase" }}>{f.level}</b>: {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        Примечание: результаты носят учебный характер и не заменяют специализированные средства расследования.
      </p>
    </div>
  );
}
