import * as cheerio from "cheerio";

export const USER_AGENT = "hfNoArte/0.1 (personal job-search assistant)";

export class SourceError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export async function getJson<T = unknown>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await request(url, init);
  try {
    return (await res.json()) as T;
  } catch {
    throw new SourceError(`Unexpected response from ${new URL(url).hostname}`);
  }
}

export async function getText(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<string> {
  return (await request(url, init)).text();
}

async function request(url: string, init: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 15_000, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/html;q=0.9, */*;q=0.8", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "timed out" : "could not connect";
    throw new SourceError(`${new URL(url).hostname} ${msg}`);
  }
  if (res.status === 401 || res.status === 403) throw new SourceError(`${new URL(url).hostname} refused access (${res.status}) — check the credentials`, res.status);
  if (res.status === 429) throw new SourceError(`${new URL(url).hostname} rate limit reached — try again later`, 429);
  if (!res.ok) throw new SourceError(`${new URL(url).hostname} returned ${res.status}`, res.status);
  return res;
}

/** HTML → readable plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="r">${html.replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "$&\n")}</div>`);
  return $("#r").text().replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export const truncate = (s: string, n = 4000) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function toIso(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(+d) ? null : d.toISOString();
}

export function guessArrangement(...parts: (string | null | undefined)[]): "remote" | "onsite" | "hybrid" | null {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b|\banywhere\b|\bwork from home\b|\bwfh\b/.test(t)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]office\b/.test(t)) return "onsite";
  return null;
}

export function guessEmploymentType(...parts: (string | null | undefined)[]): string | null {
  const t = parts.filter(Boolean).join(" ").toLowerCase().replace(/[_-]/g, " ");
  if (/\bintern(ship)?\b/.test(t)) return "internship";
  if (/\bgraduate\b/.test(t)) return "graduate";
  if (/\bfreelance\b/.test(t)) return "freelance";
  if (/\bcontract(or)?\b|\btemporary\b/.test(t)) return "contract";
  if (/\bpart time\b/.test(t)) return "part_time";
  if (/\bfull time\b|\bpermanent\b/.test(t)) return "full_time";
  return null;
}

/** Find budget figures like "$2,000", "£500-£800", "1.5k USD". */
export function extractBudget(text: string): { text: string; min: number | null; max: number | null; currency: string | null } | null {
  const m = /(?:(\$|£|€|usd|eur|gbp)\s?)(\d[\d,.]*\s?k?)(?:\s?(?:-|–|to)\s?(?:\$|£|€)?\s?(\d[\d,.]*\s?k?))?/i.exec(text);
  if (!m) return null;
  const num = (s?: string) => {
    if (!s) return null;
    const k = /k\s*$/i.test(s);
    const n = Number(s.replace(/[k\s,]/gi, ""));
    return Number.isFinite(n) ? (k ? n * 1000 : n) : null;
  };
  const cur = { $: "USD", "£": "GBP", "€": "EUR" }[m[1]] ?? m[1].toUpperCase();
  return { text: m[0].trim(), min: num(m[2]), max: num(m[3]) ?? num(m[2]), currency: cur };
}
