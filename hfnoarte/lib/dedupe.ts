import type { RawOpportunity } from "./types";

const TRACKING = /^(utm_|fbclid|gclid|ref$|ref_|source$|mc_|igshid|si$|s$)/i;

/** Normalise a URL so the same page reached two ways compares equal. */
export function canonicalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^mobile\./, "").replace(/^old\./, "");
    if (u.hostname === "twitter.com") u.hostname = "x.com";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\b(remote|hybrid|onsite|m f d|f m d|w m d)\b/g, " ").trim().replace(/\s+/g, " ");

function hash(s: string): string {
  // FNV-1a, 32-bit — only used as a compact dedupe key.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/**
 * Dedupe key. The same vacancy on several boards shares company + title.
 * The same social post cross-posted shares its text. Short posts fall back
 * to their URL so two different people saying "need a web designer" stay separate.
 */
export function fingerprint(o: Pick<RawOpportunity, "kind" | "title" | "company" | "description" | "url">): string {
  if (o.kind !== "social" && o.company && norm(o.title)) return `job:${norm(o.company)}|${norm(o.title)}`;
  const text = norm(o.description).slice(0, 300);
  if (o.kind === "social" && text.length >= 80) return `text:${hash(text)}`;
  const url = canonicalUrl(o.url);
  if (url) return `url:${url}`;
  return `text:${hash(`${norm(o.title)}|${text}`)}`;
}

/** Group raw items that describe the same opportunity. */
export function groupDuplicates<T extends RawOpportunity>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = fingerprint(it);
    const g = groups.get(key);
    if (g) g.push(it); else groups.set(key, [it]);
  }
  return groups;
}
