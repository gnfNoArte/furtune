// Credibility assessment with visible evidence. Small or new accounts are
// never rejected automatically — genuine founders often have little history.

import type { Credibility, RawOpportunity } from "../types";

const SCAM = [
  { re: /\b(pay|fee)\b.{0,20}\b(to apply|registration|training fee|starter kit)\b/i, d: "Asks the applicant to pay." },
  { re: /\b(guaranteed|easy money|no experience (needed|required).{0,30}\$\d{3,})/i, d: "Unrealistic promises." },
  { re: /\b(send|deposit)\b.{0,20}\b(crypto|usdt|bitcoin|gift ?cards?)\b/i, d: "Asks for crypto or gift-card payment." },
  { re: /\b(whatsapp|telegram)\s*(only|me at|\+?\d{6,})/i, d: "Pushes contact to WhatsApp/Telegram only." },
  { re: /\b(check|cheque) (to|for) (buy|purchase) equipment\b/i, d: "Equipment-cheque pattern common in scams." },
];

export function assessCredibility(o: RawOpportunity, opts: { duplicates?: number; now?: Date } = {}): Credibility {
  const ev: Credibility["evidence"] = [];
  const text = `${o.title}\n${o.description}`;
  const now = opts.now ?? new Date();

  if (o.kind === "employment" && o.company) ev.push({ signal: "Named employer", effect: "positive", detail: `Posted for ${o.company} via ${o.access_method.toLowerCase()}.` });

  const m = o.author_meta;
  if (m?.account_created_at) {
    const days = Math.round((+now - +new Date(m.account_created_at)) / 86_400_000);
    if (days > 365) ev.push({ signal: "Account history", effect: "positive", detail: `Account is about ${Math.floor(days / 365)} year(s) old.` });
    else if (days < 30) ev.push({ signal: "Account history", effect: "neutral", detail: `New account (${days} days). Not a red flag on its own — check the details.` });
    else ev.push({ signal: "Account history", effect: "neutral", detail: `Account is ${days} days old.` });
  }
  if (m?.karma != null) ev.push({ signal: "Community activity", effect: m.karma > 500 ? "positive" : "neutral", detail: `${m.karma.toLocaleString()} karma on the platform.` });
  if (m?.followers != null) ev.push({ signal: "Audience", effect: m.followers > 200 ? "positive" : "neutral", detail: `${m.followers.toLocaleString()} followers${m.followers < 50 ? " — small, which is common for early founders" : ""}.` });
  if (m?.verified) ev.push({ signal: "Verified", effect: "positive", detail: "Platform-verified account." });

  const specific = [
    /\$|£|€|\bbudget\b|\busd\b|\bper hour\b|\/hr\b/i.test(text) && "budget",
    /\b(deadline|by (next|end of)|weeks?|timeline|asap)\b/i.test(text) && "timeline",
    /\b(pages?|sections?|cms|ecommerce|landing|redesign|logo|figma)\b/i.test(text) && "scope",
  ].filter(Boolean) as string[];
  if (specific.length >= 2) ev.push({ signal: "Specific details", effect: "positive", detail: `Mentions ${specific.join(", ")}.` });
  else if (o.description.length < 80) ev.push({ signal: "Specific details", effect: "neutral", detail: "Very short post with few project details." });

  const saysHow = /\b(apply|dm|message|email|e-mail|reach out|contact|send (me|us)|portfolio)\b|https?:\/\/|@\w/i.test(text);
  if (o.kind === "employment" && o.url) ev.push({ signal: "Contact route", effect: "positive", detail: "Has an application link." });
  else if (saysHow) ev.push({ signal: "Contact route", effect: "positive", detail: "Says how to respond." });
  else ev.push({ signal: "Contact route", effect: "neutral", detail: o.kind === "social" ? "No clear way to respond besides replying to the post." : "No application link or contact details found." });

  for (const s of SCAM) if (s.re.test(text)) ev.push({ signal: "Warning sign", effect: "negative", detail: s.d });
  if ((opts.duplicates ?? 0) > 2) ev.push({ signal: "Repeated posting", effect: "negative", detail: `Same text seen ${opts.duplicates} times — could be spam or a recruiter blast.` });

  const pos = ev.filter((e) => e.effect === "positive").length;
  const neg = ev.filter((e) => e.effect === "negative").length;
  const level: Credibility["level"] =
    neg >= 2 ? "low" : neg === 1 ? (pos >= 3 ? "medium" : "low")
    : pos >= 3 ? "high" : pos >= 1 ? "medium" : "unknown";
  return { level, evidence: ev };
}
