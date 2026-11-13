// Read a public job or post page that the candidate pasted.
// Only public pages are fetched; login walls and CAPTCHAs are never bypassed.
import "server-only";
import * as cheerio from "cheerio";
import { aiAvailable, chatJson } from "./ai/client";
import { USER_AGENT, extractBudget, guessArrangement, guessEmploymentType, htmlToText, toIso, truncate } from "./sources/http";
import type { OpportunityKind, RawOpportunity } from "./types";

export interface ImportResult {
  ok: boolean;
  item?: RawOpportunity;
  reason?: string;
  method?: string;
}

const SOCIAL_HOSTS = /(^|\.)(x\.com|twitter\.com|instagram\.com|threads\.net|threads\.com|facebook\.com|linkedin\.com|reddit\.com|bsky\.app|tiktok\.com)$/i;
const LOGIN_HINT = /(sign in|log in|login|join now|captcha|are you a robot|verify you are human|enable javascript)/i;

const PRIVATE = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd][0-9a-f]{2}:|fe80:|::ffff:(127|10|192\.168|169\.254)\.|metadata\.google)/i;

function isPrivateHost(host: string) {
  const h = host.replace(/^\[|\]$/g, "");
  return PRIVATE.test(h) || h.endsWith(".internal") || h.endsWith(".local");
}

/** Refuse links that resolve to private or internal addresses (SSRF protection). */
async function resolvesPublic(host: string): Promise<boolean> {
  if (isPrivateHost(host)) return false;
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(host.replace(/^\[|\]$/g, ""), { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateHost(a.address));
  } catch {
    return false;
  }
}

/** Fetch with manual redirects so every hop is checked. */
async function safeFetch(start: URL): Promise<Response> {
  let current = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(current.protocol) || !(await resolvesPublic(current.hostname))) throw new Error("blocked");
    const res = await fetch(current, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, current); continue; }
    return res;
  }
  throw new Error("too many redirects");
}

export async function importFromUrl(input: string): Promise<ImportResult> {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return { ok: false, reason: "That doesn't look like a valid link." }; }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) return { ok: false, reason: "Only public http(s) links can be imported." };

  let res: Response;
  try {
    res = await safeFetch(url);
  } catch (e) {
    return { ok: false, reason: (e as Error).message === "blocked" ? "Only public web pages can be imported." : "The page couldn't be reached. Enter the details manually instead." };
  }
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999) {
    return { ok: false, reason: `The site blocked automatic reading (HTTP ${res.status}). hfNoArte doesn't bypass this — enter the details manually.` };
  }
  if (!res.ok) return { ok: false, reason: `The page returned HTTP ${res.status}.` };
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("html")) return { ok: false, reason: "The link isn't a web page." };
  const html = (await res.text()).slice(0, 1_500_000);
  const $ = cheerio.load(html);
  const host = url.hostname.replace(/^www\./, "");
  const social = SOCIAL_HOSTS.test(host);
  const kind: OpportunityKind = social ? "social" : "employment";

  // 1. Structured data (schema.org JobPosting) — the most reliable source.
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(el).contents().text());
      const nodes = (Array.isArray(json) ? json : json["@graph"] ?? [json]) as Record<string, unknown>[];
      const job = nodes.find((n) => n && (n["@type"] === "JobPosting" || (Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("JobPosting"))));
      if (job) {
        const org = job.hiringOrganization as { name?: string } | undefined;
        const loc = (Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation) as { address?: { addressLocality?: string; addressCountry?: string | { name?: string } } } | undefined;
        const addr = loc?.address;
        const country = typeof addr?.addressCountry === "string" ? addr.addressCountry : addr?.addressCountry?.name;
        const salary = job.baseSalary as { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } } | undefined;
        const description = truncate(htmlToText(String(job.description ?? "")), 6000);
        return {
          ok: true, method: "Structured job data on the page",
          item: {
            source: "url", url: url.toString(), kind: "employment", title: String(job.title ?? "Untitled role"), description,
            company: org?.name ?? null, publisher: org?.name ?? null,
            location: [addr?.addressLocality, country].filter(Boolean).join(", ") || (job.jobLocationType === "TELECOMMUTE" ? "Remote" : null),
            work_arrangement: job.jobLocationType === "TELECOMMUTE" ? "remote" : guessArrangement(description.slice(0, 600)),
            employment_type: guessEmploymentType(String(job.employmentType ?? "")),
            salary_min: salary?.value?.minValue ?? salary?.value?.value ?? null, salary_max: salary?.value?.maxValue ?? null, currency: salary?.currency ?? null,
            salary_text: salary?.value ? `${salary.value.minValue ?? salary.value.value ?? ""}${salary.value.maxValue ? `–${salary.value.maxValue}` : ""} ${salary.currency ?? ""} ${salary.value.unitText ? `/ ${salary.value.unitText.toLowerCase()}` : ""}`.trim() : null,
            published_at: toIso(String(job.datePosted ?? "")), access_method: "Public page (structured data)",
          },
        };
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  // 2. Page text + Open Graph tags.
  const og = (p: string) => $(`meta[property="og:${p}"]`).attr("content") || $(`meta[name="twitter:${p}"]`).attr("content") || "";
  $("script, style, noscript, nav, footer, header, svg").remove();
  const bodyText = truncate(htmlToText($("main").html() || $("article").html() || $("body").html() || ""), 8000);
  const title = og("title") || $("title").text().trim();
  const description = og("description");
  const content = bodyText.length > 200 ? bodyText : description;
  if (!content || content.length < 40 || (LOGIN_HINT.test(`${title} ${content.slice(0, 400)}`) && content.length < 1200)) {
    return { ok: false, reason: "The page needs a login or shows little public content. hfNoArte doesn't bypass logins — enter the details manually." };
  }

  // 3. Let AI pull out fields when available; otherwise use simple heuristics.
  if (aiAvailable()) {
    try {
      const f = await chatJson<{ title: string; company: string | null; publisher: string | null; location: string | null; work_arrangement: string | null; employment_type: string | null; salary_text: string | null; skills: string[]; contact: string | null; published_at: string | null; description: string; is_opportunity: boolean }>(
        "Extract the job or freelance opportunity described on this web page. Only use what the page says; use null for anything not stated. Do not invent dates. employment_type: full_time|part_time|contract|internship|freelance|graduate|null. work_arrangement: remote|onsite|hybrid|null.",
        `URL: ${url}\nTITLE: ${title}\n\n${content.slice(0, 7000)}`, { maxTokens: 1500, temperature: 0 });
      const budget = f.salary_text ? extractBudget(f.salary_text) : null;
      return {
        ok: true, method: "Public page, fields extracted by AI",
        item: {
          source: "url", url: url.toString(), kind, title: f.title || title || host, description: truncate(f.description || content, 6000),
          company: f.company, publisher: f.publisher ?? f.company, location: f.location,
          work_arrangement: (["remote", "onsite", "hybrid"].includes(String(f.work_arrangement)) ? f.work_arrangement : null) as RawOpportunity["work_arrangement"],
          employment_type: f.employment_type, salary_text: f.salary_text, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
          published_at: toIso(f.published_at), tags: f.skills, access_method: "Public page",
        },
      };
    } catch { /* fall back to heuristics */ }
  }
  const budget = extractBudget(content);
  return {
    ok: true, method: "Public page text (no AI)",
    item: {
      source: "url", url: url.toString(), kind, title: title || host, description: content,
      company: social ? null : (og("site_name") || null), publisher: social ? null : (og("site_name") || host),
      work_arrangement: guessArrangement(content.slice(0, 1500)), employment_type: guessEmploymentType(content.slice(0, 1500)),
      salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
      published_at: toIso($('meta[property="article:published_time"]').attr("content")), access_method: "Public page",
    },
  };
}
