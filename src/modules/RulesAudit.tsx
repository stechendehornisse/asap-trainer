import { useMemo, useState } from "react";

/** ==========================
 *  Простенький CSV-парсер
 *  ========================== */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  const headers = splitLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function toObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  const norm = headers.map(h => h.trim().toLowerCase());
  return rows.map(r => {
    const o: Record<string, string> = {};
    for (let i = 0; i < norm.length; i++) {
      o[norm[i]] = (r[i] ?? "").trim();
    }
    return o;
  });
}

/** ==========================
 *  Эвристики и типы
 *  ========================== */
type Level = "высокий" | "средний" | "низкий";
type Finding = { level: Level; rule: string; text: string };

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.toLowerCase();
  return ["true", "yes", "on", "enabled", "1"].includes(s) || s === "вкл" || s === "да";
}

function anyFieldContains(o: Record<string, string>, keys: string[], needles: RegExp): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v && needles.test(v)) return k;
  }
  // если ключи не найдены — по всем полям
  for (const [k, v] of Object.entries(o)) {
    if (v && needles.test(v)) return k;
  }
  return null;
}

function domainFromAddress(s: string): string | null {
  const m = s.match(/<([^>]+)>/);
  const email = m ? m[1] : s;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const dom = email.slice(at + 1).toLowerCase();
  return dom || null;
}

function isLikelyExternal(dest: string, internalBase?: string): boolean {
  const s = dest.toLowerCase();
  if (/^https?:\/\//.test(s) || s.startsWith("mailto:")) return true;
  const d = domainFromAddress(s) || s;
  if (!d.includes(".")) return false; // локальные/внутренние
  if (internalBase && d.endsWith(internalBase.toLowerCase())) return false;
  if (d.endsWith(".local") || d.endsWith(".corp")) return false;
  return true;
}

type AuditResult = {
  total: number;
  enabled: number;
  disabled: number;
  findings: Finding[];
};

function lintRules(objs: Record<string, string>[], internalBase?: string): AuditResult {
  const nameKeys = ["name", "rule name", "rule", "название", "имя"];
  const enabledKeys = ["enabled", "is enabled", "включено", "активно"];
  const condKeys = ["conditions", "condition", "условия"];
  const actKeys = ["actions", "action", "действия"];

  let total = 0, enabled = 0, disabled = 0;
  const findings: Finding[] = [];

  for (const o of objs) {
    total++;
    // имя правила
    const ruleName =
      nameKeys.map(k => o[k]).find(Boolean) ||
      o[""] || "(без названия)";

    // статус
    const isEnabled =
      enabledKeys.map(k => truthy(o[k])).find(Boolean) ?? true;
    if (isEnabled) enabled++; else disabled++;

    // объединённые строки условий/действий (на случай нестандартных выгрузок)
    const cond = condKeys.map(k => o[k]).filter(Boolean).join(" | ").toLowerCase();
    const all  = (Object.values(o).join(" | ").toLowerCase());

    // 1) Внешние переадресации/редиректы (высокий)
    const fwdKey = anyFieldContains(o, actKeys, /(forward|redirect|переадрес|пересыл)/i);
    if (fwdKey) {
      // пытаемся вытащить адрес/URL назначения
      const destMatch = all.match(/(?:mailto:|https?:\/\/|<[^>]+>|\S+@\S+\.\S+)/i);
      const dest = destMatch ? destMatch[0] : "";
      if (dest && isLikelyExternal(dest, internalBase)) {
        findings.push({ level: "высокий", rule: ruleName, text: "Наружная переадресация/редирект на внешний адрес/URL." });
      } else {
        findings.push({ level: "средний", rule: ruleName, text: "Переадресация обнаружена (проверить назначение и необходимость)." });
      }
    }

    // 2) Удаление/безусловное скрытие (высокий/средний)
    if (/(permanent\s*delete|удалить навсегда)/i.test(all)) {
      findings.push({ level: "высокий", rule: ruleName, text: "Действие «удалить навсегда»: риск утраты входящих сообщений." });
    } else if (/\b(delete|удалить)\b/i.test(all)) {
      findings.push({ level: "средний", rule: ruleName, text: "Действие «удалить»: проверьте условия, чтобы исключить потерю легитимной почты." });
    }
    if (/(mark as read|пометить как прочитанное)/i.test(all) && /(stop processing|прекратить обработку|stop rule)/i.test(all)) {
      findings.push({ level: "средний", rule: ruleName, text: "«Пометить как прочитанное» + «Прекратить обработку»: риск скрытого обхода Inbox." });
    }

    // 3) «Широкие» условия (средний) — Invoice/Payment/Urgent/Beneficiary и т.п.
    if (/(invoice|payment|beneficiary|urgent|сч[её]т|оплат[аи]|получател[ья]|срочно)/i.test(cond)) {
      findings.push({ level: "средний", rule: ruleName, text: "Широкие тематические условия (счёт/оплата/срочно): возможна автоматизация BEC-сценариев." });
    }

    // 4) Перемещение в нестандартные папки (низкий)
    if (/(move to folder|переместить в папку)/i.test(all) && !/inbox|входящие/i.test(all)) {
      findings.push({ level: "низкий", rule: ruleName, text: "Перемещение писем в папки вне «Входящие»: проверьте обоснованность." });
    }

    // 5) Сочетание нескольких «скрывающих» действий (средний→высокий)
    const hideLike = Number(!!/(delete|удалить)/i.test(all)) +
                     Number(!!/(mark as read|прочитан)/i.test(all)) +
                     Number(!!/(move to folder|переместить)/i.test(all));
    if (hideLike >= 2) {
      findings.push({ level: "средний", rule: ruleName, text: "Комбинация скрывающих действий (delete/read/move): риск незаметной утраты сообщений." });
    }

    // 6) Отключённые правила (низкий) — напоминание к ревизии
    if (!isEnabled) {
      findings.push({ level: "низкий", rule: ruleName, text: "Правило отключено: целесообразно удалить/задокументировать." });
    }
  }

  return { total, enabled, disabled, findings };
}

/** ==========================
 *  Компонент Rules Audit
 *  ========================== */
export default function RulesAudit() {
  const [csv, setCsv] = useState("");
  const [internalBase, setInternalBase] = useState(""); // например: org-x.local или example.com
  const [res, setRes] = useState<AuditResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasInput = csv.trim().length > 0;
  const canAnalyze = hasInput && !busy;
  const canClear = (hasInput || !!res || !!err) && !busy;

  const sampleHref = `${import.meta.env.BASE_URL}samples/rules.csv`;

  const sortedFindings = useMemo(() => {
    if (!res) return [];
    const order: Record<Level, number> = { "высокий": 0, "средний": 1, "низкий": 2 };
    return [...res.findings].sort((a, b) => order[a.level] - order[b.level] || a.rule.localeCompare(b.rule));
  }, [res]);

  function onAnalyze() {
    if (!canAnalyze) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const { headers, rows } = parseCsv(csv);
      if (headers.length === 0 || rows.length === 0) throw new Error("Файл пуст или не содержит строк.");
      const objs = toObjects(headers, rows);
      const audit = lintRules(objs, internalBase || undefined);
      setRes(audit);
    } catch (e: any) {
      setErr(e?.message || "Ошибка разбора CSV.");
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    if (!canClear) return;
    setCsv("");
    setInternalBase("");
    setRes(null);
    setErr(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /\.csv$/i.test(f.name);
    if (!ok) {
      alert("Допустимый формат: .csv (экспорт правил почтового ящика).");
      e.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(f);
  }

  return (
    <div>
      <h2>Rules Audit</h2>

      <p className="hero-sub" style={{ marginTop: 0 }}>
        Цель: первичная проверка экспортированных правил почтового ящика на предмет внешних переадресаций, скрывающих действий и «широких» условий,
        потенциально используемых в BEC-сценариях.
      </p>
      <div style={{ margin: "10px 0 14px", fontSize: 13, color: "#94a3b8" }}>
        Данные: CSV-экспорт правил ящика. Образец:{" "}
        <a href={sampleHref} download style={{ color: "#9ab4ff" }}>samples/rules.csv</a>.{" "}
        Внутренний домен (необязательно):{" "}
        <input
          value={internalBase}
          onChange={(e) => setInternalBase(e.target.value)}
          placeholder="например, org-x.local или example.com"
          style={{
            marginLeft: 6, padding: "4px 8px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,.10)",
            background: "var(--card)", color: "var(--text)"
          }}
        />
      </div>

      {/* Ввод: текстовое поле и/или загрузка файла */}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          placeholder={"Вставьте CSV-экспорт правил или загрузите файл через кнопку ниже."}
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
            Загрузить файл (.csv)
            <input type="file" accept=".csv" onChange={onPickFile} style={{ display: "none" }} />
          </label>
          <button className="btn primary" onClick={onAnalyze} disabled={!canAnalyze}>
            Проанализировать
          </button>
          <button className="btn ghost" onClick={onClear} disabled={!canClear} title="Очистить поле и результаты">
            Очистить
          </button>
        </div>
      </div>

      {/* Ошибка */}
      {err && (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(198,40,40,.6)" }}>
          <div className="t">Ошибка</div>
          <p style={{ marginTop: 6 }}>{err}</p>
        </div>
      )}

      {/* Результаты */}
      {res && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="t">Сводка</div>
          <ul style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
            <li><b>Всего правил:</b> {res.total}</li>
            <li><b>Включено:</b> {res.enabled} | <b>Отключено:</b> {res.disabled}</li>
          </ul>

          <div className="t" style={{ marginTop: 10 }}>Замечания</div>
          {sortedFindings.length === 0 ? (
            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Существенных рисков по эвристикам прототипа не выявлено.
            </p>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {sortedFindings.map((f, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <b style={{ textTransform: "uppercase" }}>{f.level}</b> — <i>{f.rule}</i>: {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        Примечание: проверка носит учебный характер; используйте административные средства почтовой системы для окончательных выводов.
      </p>
    </div>
  );
}
