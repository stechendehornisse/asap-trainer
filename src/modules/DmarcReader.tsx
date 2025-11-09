import { useMemo, useState } from "react";

/** Лёгкий DOM-парсер DMARC RUA (учебный, без внешних библиотек) */
function text(el: Element | null, sel: string): string | null {
  if (!el) return null;
  const n = el.querySelector(sel);
  return n?.textContent?.trim() || null;
}
function num(el: Element | null, sel: string): number | null {
  const t = text(el, sel);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Разбор RUA-отчёта и сводка */
type DmarcSummary = {
  org?: string;
  email?: string;
  reportId?: string;
  dateFrom?: string;
  dateTo?: string;

  domain?: string;
  adkim?: string;
  aspf?: string;
  polP?: string;
  polSp?: string;
  pct?: number | undefined;
  fo?: string | undefined;

  total: number;          // суммарный count
  passAligned: number;    // где SPF=pass или DKIM=pass
  failBoth: number;       // где ни SPF, ни DKIM не pass
  sources: number;        // число уникальных source_ip
};

function parseDmarcXml(xml: string): DmarcSummary {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  // возможные ошибки парсера
  if (doc.querySelector("parsererror")) {
    throw new Error("Некорректный XML: проверьте структуру отчёта.");
  }

  const fb = doc.querySelector("feedback") || doc.documentElement; // некоторые провайдеры без <feedback>
  if (!fb) throw new Error("Не найден корневой элемент DMARC-отчёта.");

  // report_metadata
  const meta = fb.querySelector("report_metadata");
  const org = text(meta, "org_name") || undefined;
  const email = text(meta, "email") || undefined;
  const reportId = text(meta, "report_id") || undefined;
  const begin = num(fb.querySelector("date_range"), "begin");
  const end = num(fb.querySelector("date_range"), "end");

  const dateFrom = begin ? new Date(begin * 1000).toISOString() : undefined;
  const dateTo = end ? new Date(end * 1000).toISOString() : undefined;

  // policy_published
  const pol = fb.querySelector("policy_published");
  const domain = text(pol, "domain") || undefined;
  const adkim = text(pol, "adkim") || undefined; // s/r
  const aspf = text(pol, "aspf") || undefined;   // s/r
  const polP = text(pol, "p") || undefined;      // none/quarantine/reject
  const polSp = text(pol, "sp") || undefined;
  const pct = num(pol, "pct") || undefined;
  const fo = text(pol, "fo") || undefined;

  // records
  const recs = [...fb.querySelectorAll("record")];
  let total = 0;
  let passAligned = 0;
  let failBoth = 0;
  const ips = new Set<string>();

  for (const r of recs) {
    const count = num(r, "row > count") || 0;
    total += count;

    const src = text(r, "row > source_ip");
    if (src) ips.add(src);

    const vSpf = text(r, "row > policy_evaluated > spf")?.toLowerCase();
    const vDkim = text(r, "row > policy_evaluated > dkim")?.toLowerCase();

    const spfPass = vSpf === "pass";
    const dkimPass = vDkim === "pass";

    if (spfPass || dkimPass) passAligned += count;
    if (!spfPass && !dkimPass) failBoth += count;
  }

  return {
    org,
    email,
    reportId,
    dateFrom,
    dateTo,
    domain,
    adkim,
    aspf,
    polP,
    polSp,
    pct,
    fo,
    total,
    passAligned,
    failBoth,
    sources: ips.size,
  };
}

/** Форматирование процентов */
function pctStr(part: number, whole: number) {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** Нормативная оговорка про «ослабленное/строгое» */
function alignLabel(code?: string) {
  if (!code) return "не указано";
  return code === "s" ? "строгое (strict)" : code === "r" ? "ослабленное (relaxed)" : code;
}

export default function DmarcReader() {
  const [xml, setXml] = useState("");
  const [res, setRes] = useState<DmarcSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasInput = xml.trim().length > 0;
  const canAnalyze = hasInput && !busy;
  const canClear = (hasInput || !!res || !!err) && !busy;

  const sampleHref = `${import.meta.env.BASE_URL}samples/dmarc.xml`;

  const findings = useMemo(() => {
    if (!res) return [];
    const out: string[] = [];

    // Политика домена
    if (!res.polP || res.polP === "none") {
      out.push("Опубликована политика p=none или политика отсутствует: для защиты домена рекомендуется переход на p=quarantine/p=reject с контролируемым увеличением покрытия (pct).");
    }
    if (typeof res.pct === "number" && res.pct < 100) {
      out.push(`Поле pct=${res.pct}: политика применяется к части трафика (этапное внедрение).`);
    }
    if (res.adkim && res.adkim !== "s") {
      out.push(`adkim=${res.adkim}: выравнивание DKIM установлено как ${alignLabel(res.adkim)} (рекомендуется оценить целесообразность строгого режима).`);
    }
    if (res.aspf && res.aspf !== "s") {
      out.push(`aspf=${res.aspf}: выравнивание SPF установлено как ${alignLabel(res.aspf)} (рекомендуется оценить целесообразность строгого режима).`);
    }
    if (!res.fo) {
      out.push("Параметр fo не указан: целесообразно явно определить политику формирования форензик-отчётов (например, fo=1).");
    }

    // Фактические результаты
    if (res.total > 0) {
      const failRate = res.failBoth / res.total;
      if (failRate > 0.1) {
        out.push(`Доля сообщений без подтверждения DMARC (ни SPF, ни DKIM) повышенная: ${pctStr(res.failBoth, res.total)}. Требуется анализ источников и корректировка политики/подписей.`);
      }
    }

    return out;
  }, [res]);

  function onAnalyze() {
    if (!canAnalyze) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const r = parseDmarcXml(xml);
      setRes(r);
    } catch (e: any) {
      setErr(e?.message || "Ошибка разбора отчёта DMARC.");
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    if (!canClear) return;
    setXml("");
    setRes(null);
    setErr(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /\.xml$/i.test(f.name);
    if (!ok) {
      alert("Допустимый формат: .xml (DMARC RUA aggregate).");
      e.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setXml(String(reader.result || ""));
    reader.readAsText(f);
  }

  return (
    <div>
      <h2>DMARC RUA Reader</h2>

      <p className="hero-sub" style={{ marginTop: 0 }}>
        Цель: извлечение ключевых параметров агрегированного отчёта DMARC (RUA) и первичная оценка доли сообщений, не подтверждённых SPF/DKIM.
      </p>
      <div style={{ margin: "10px 0 14px", fontSize: 13, color: "#94a3b8" }}>
        Данные: XML-файл DMARC (aggregate). Рекомендуется загрузка файла (<code>.xml</code>). Образец:{" "}
        <a href={sampleHref} download style={{ color: "#9ab4ff" }}>samples/dmarc.xml</a>.
      </div>

      {/* Ввод: текстовое поле и/или загрузка файла */}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <textarea
          value={xml}
          onChange={(e) => setXml(e.target.value)}
          rows={12}
          placeholder={"Вставьте содержимое DMARC-отчёта (XML) или загрузите файл через кнопку ниже."}
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
            Загрузить файл (.xml)
            <input type="file" accept=".xml" onChange={onPickFile} style={{ display: "none" }} />
          </label>
          <button className="btn primary" onClick={onAnalyze} disabled={!canAnalyze}>
            Проанализировать
          </button>
          <button className="btn ghost" onClick={onClear} disabled={!canClear} title="Очистить поле и результаты">
            Очистить
          </button>
        </div>
      </div>

      {/* Ошибка парсинга */}
      {err && (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(198,40,40,.6)" }}>
          <div className="t">Ошибка</div>
          <p style={{ marginTop: 6 }}>{err}</p>
        </div>
      )}

      {/* Сводка */}
      {res && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="t">Сводка отчёта</div>
          <ul style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
            {res.org && <li><b>Организация:</b> {res.org}{res.email ? ` (${res.email})` : ""}</li>}
            {res.reportId && <li><b>Идентификатор отчёта:</b> {res.reportId}</li>}
            {(res.dateFrom || res.dateTo) && (
              <li><b>Период:</b> {res.dateFrom || "?"} — {res.dateTo || "?"}</li>
            )}
            {res.domain && <li><b>Домен политики:</b> {res.domain}</li>}
            {(res.polP || res.polSp) && (
              <li><b>Политика:</b> p={res.polP || "?"}{res.polSp ? `, sp=${res.polSp}` : ""}{typeof res.pct === "number" ? `, pct=${res.pct}` : ""}{res.fo ? `, fo=${res.fo}` : ""}</li>
            )}
            {(res.adkim || res.aspf) && (
              <li><b>Выравнивание:</b> adkim={res.adkim || "?"} ({alignLabel(res.adkim)}); aspf={res.aspf || "?"} ({alignLabel(res.aspf)})</li>
            )}
            <li><b>Объём сообщений (count):</b> {res.total}</li>
            <li><b>Подтверждены SPF или DKIM:</b> {res.passAligned} ({pctStr(res.passAligned, res.total)})</li>
            <li><b>Не подтверждены ни SPF, ни DKIM:</b> {res.failBoth} ({pctStr(res.failBoth, res.total)})</li>
            <li><b>Уникальных источников (source_ip):</b> {res.sources}</li>
          </ul>

          <div className="t" style={{ marginTop: 10 }}>Выводы</div>
          {findings.length === 0 ? (
            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Существенных замечаний по заданным критериям не обнаружено. При необходимости используйте дополнительный анализ по источникам.
            </p>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        Примечание: разбор носит учебный характер и служит иллюстрацией первичной оценки DMARC-отчётов.
      </p>
    </div>
  );
}
