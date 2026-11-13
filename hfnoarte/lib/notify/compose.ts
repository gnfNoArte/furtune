import { BAND_LABELS } from "../matching/score";
import { sourceName } from "../sources";
import type { MatchResult } from "../types";
import type { Message } from "./channels";

export interface NotifyOpportunity {
  id: string; title: string; description: string | null; company: string | null; publisher: string | null;
  discovered_at: string; match: MatchResult | null; match_score: number | null; source: string; url: string | null; is_sample?: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brief = (s: string | null, n = 220) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n) + ((s ?? "").length > n ? "…" : "");
const day = (iso: string) => new Date(iso).toUTCString().slice(0, 16);

export function opportunityBlock(o: NotifyOpportunity, appUrl: string) {
  const band = o.match ? BAND_LABELS[o.match.band] : "Not scored";
  const why = o.match?.reasons.slice(0, 2).join(" ") || "—";
  const gaps = o.match?.gaps.slice(0, 3).join(" ") || "None noted.";
  const lines = [
    `${o.is_sample ? "[SAMPLE] " : ""}${o.title}`,
    `${o.match_score ?? "–"}/100 · ${band}`,
    brief(o.description),
    `Source: ${sourceName(o.source)} · By: ${o.publisher ?? o.company ?? "unknown"} · Found: ${day(o.discovered_at)}`,
    `Why: ${why}`,
    `Watch out: ${gaps}`,
    `Open original: ${o.url ?? "no link available"}`,
    `In hfNoArte: ${appUrl}/opportunities/${o.id}`,
  ];
  const html = `<div style="margin:0 0 24px;padding:16px;border:1px solid #E3DACA;border-radius:16px;background:#FBF9F4;color:#1B1A17">
<div style="font-size:16px;font-weight:600">${esc(lines[0])}</div>
<div style="color:#5C5545;font-family:monospace;text-transform:uppercase;letter-spacing:.06em;font-size:12px;margin:6px 0 10px">${esc(lines[1])}</div>
<p style="margin:0 0 8px;color:#3B372D">${esc(brief(o.description))}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5C5545">${esc(lines[3])}</p>
<p style="margin:0 0 4px;font-size:13px"><b>Why:</b> ${esc(why)}</p>
<p style="margin:0 0 12px;font-size:13px"><b>Watch out:</b> ${esc(gaps)}</p>
${o.url ? `<a href="${esc(o.url)}" style="background:#1B1A17;color:#F7F4EC;padding:10px 18px;border-radius:999px;text-decoration:none">Open original</a>` : ""}
<a href="${esc(`${appUrl}/opportunities/${o.id}`)}" style="margin-left:14px;color:#1B1A17">View in hfNoArte</a></div>`;
  return { text: lines.join("\n"), html };
}

export function composeMatches(items: NotifyOpportunity[], appUrl: string, digest: boolean): Message {
  const subject = items.length === 1 && !digest
    ? `New match: ${items[0].title} (${items[0].match_score}/100)`
    : `${items.length} new ${items.length === 1 ? "opportunity" : "opportunities"} from hfNoArte`;
  const blocks = items.map((o) => opportunityBlock(o, appUrl));
  return {
    subject,
    text: `${digest ? "Daily digest — " : ""}hfNoArte found ${items.length} new match${items.length === 1 ? "" : "es"}.\n\n${blocks.map((b) => b.text).join("\n\n———\n\n")}\n\nNothing has been sent to anyone. Open each link to apply or reply yourself.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;background:#F7F4EC;color:#1B1A17;padding:20px">${blocks.map((b) => b.html).join("")}<p style="color:#5C5545;font-size:12px">Nothing has been sent to anyone. Open each link to apply or reply yourself.</p></div>`,
  };
}

export function composeReminder(title: string, lines: string[], appUrl: string, path: string): Message {
  const text = `${title}\n\n${lines.join("\n")}\n\n${appUrl}${path}`;
  return { subject: title, text, html: `<div style="font-family:system-ui,sans-serif"><h3>${esc(title)}</h3>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<a href="${esc(appUrl + path)}">Open hfNoArte</a></div>` };
}
