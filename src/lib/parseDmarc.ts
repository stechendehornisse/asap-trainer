export type DmarcStat = {
  total: number; pass: number; fail: number;
  bySource: Record<string, number>;
};

export function parseDmarcXml(xmlText: string): DmarcStat {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const recs = Array.from(doc.getElementsByTagName("record"));
  let total = 0, pass = 0, fail = 0;
  const bySource: Record<string, number> = {};

  recs.forEach(r => {
    const count = Number(r.getElementsByTagName("count")[0]?.textContent || "0");
    total += count;
    const ip = r.getElementsByTagName("source_ip")[0]?.textContent || "unknown";
    bySource[ip] = (bySource[ip] || 0) + count;

    const spf = r.querySelector("auth_results spf result")?.textContent;
    const dkim = r.querySelector("auth_results dkim result")?.textContent;
    const aligned = (spf === "pass" || dkim === "pass");
    aligned ? pass += count : fail += count;
  });

  return { total, pass, fail, bySource };
}
