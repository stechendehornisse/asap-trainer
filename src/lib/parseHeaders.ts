export type HeaderReport = {
  spf?: string; dkim?: string; dmarc?: string;
  receivedHops: number; flags: string[];
};

export function parseHeaders(raw: string): HeaderReport {
  const lines = raw.split(/\r?\n/);
  const ar = lines.filter(l => /^Authentication-Results:/i.test(l)).join(" ");
  const get = (k: string) =>
    (ar.match(new RegExp(`${k}=([a-zA-Z0-9_-]+)`, "i")) || [])[1];

  const receivedHops = lines.filter(l => /^Received:/i.test(l)).length;
  const flags: string[] = [];
  if (/auto-forward|auto_submitted|x-auto-forward/i.test(raw)) flags.push("auto_forward_suspect");
  if (/X-MS-Exchange-Transport-Rules/i.test(raw)) flags.push("transport_rules_hit");

  return { spf: get("spf"), dkim: get("dkim"), dmarc: get("dmarc"), receivedHops, flags };
}
