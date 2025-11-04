export type Rule = { action: string; condition: string; value: string };
export type RuleFinding = { index: number; severity: "high" | "med" | "low"; reason: string };

export function lintRules(csv: string): RuleFinding[] {
  const rows = csv.trim().split(/\r?\n/).slice(1);
  const findings: RuleFinding[] = [];

  rows.forEach((line, i) => {
    const [action = "", condition = "", value = ""] = line.split(",");

    if (/forward/i.test(action) && /http|mailto|external/i.test(value))
      findings.push({ index: i + 2, severity: "high", reason: "Внешняя автоматическая переадресация" });

    if (/move|delete/i.test(action) && /invoice|payment|bank/i.test(value))
      findings.push({ index: i + 2, severity: "med", reason: "Скрытая фильтрация по финансовой лексике" });

    if (/contains/i.test(condition) && /\.co(m|\.ru)?\.(ua|xyz|top)$/i.test(value))
      findings.push({ index: i + 2, severity: "low", reason: "Подозрительные домены-двойники" });
  });

  return findings;
}
