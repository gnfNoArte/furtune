// Intent detection for social posts and comments: is this person looking to
// hire someone, asking for a recommendation, announcing a project — or are
// they a freelancer advertising themselves?

import { clustersIn } from "../taxonomy";
import type { Intent } from "../types";

const HIRING = [
  /\b(we'?re|we are|i'?m|i am|currently)\s+(hiring|looking|searching)\b/i,
  /\blooking (for|to hire)\b/i,
  /\b(need|needs|needed|seeking|searching for|in need of|want|wanted)\s+(a|an|some|someone|somebody|help|an?\s+experienced)\b/i,
  /\bhiring\b/i,
  /\bwho can (build|design|make|create|redesign|help)\b/i,
  /\b(help|someone to) (me |us )?(build|design|redesign|create|make)\b/i,
  /\bpaid (project|gig|work|role)\b/i,
  /\bbudget\b.{0,30}(\$|usd|eur|gbp|£|€|\d)/i,
  /\[\s*hiring\s*\]/i,
];
const RECOMMEND = [
  /\b(anyone|anybody|does anyone|can anyone|could anyone) (know|recommend|suggest)\b/i,
  /\b(recommend|recommendations? for|suggestions? for)\b.{0,40}\b(designer|developer|agency|freelancer|webflow|framer|shopify)\b/i,
  /\bwho('?s| is| do you use)\b.{0,30}\b(designer|developer|webflow|framer)\b/i,
];
const ANNOUNCE = [/\b(upcoming|starting|kicking off|launching)\b.{0,40}\b(project|build|redesign|website)\b/i, /\bwill need\b/i];
const SELF_PROMO = [
  /\[\s*for hire\s*\]/i,
  /\b(i'?m|i am|we'?re|we are) (available|open) (for|to)\b/i,
  /\bopen (to|for) (work|projects|new clients|commissions)\b/i,
  /\btaking (on )?(new )?(clients|projects|commissions)\b/i,
  /\bhire me\b/i,
  /\b(my|our) (portfolio|services|agency)\b/i,
  /\b(i|we) (build|design|create|make|help|offer)\b.{0,40}\b(websites?|brands?|logos?|landing pages?|businesses|founders|startups)\b/i,
  /\bdm (me|us) (for|to get)\b/i,
  /\bslots? (open|available)\b/i,
  /\b(check out|see) my (work|portfolio)\b/i,
];
const ROLE = /\b(designers?|developers?|devs?|freelancers?|agency|webflow|framer|shopify|websites?|sites?|landing pages?|brands?|branding|logos?|ui|ux|product design|no-?code|annotat\w*|ai trainers?)\b/i;

const hits = (res: RegExp[], t: string) => res.filter((r) => r.test(t)).length;

export function detectIntent(text: string, opts: { sourceHint?: "hiring" | "for_hire" | null; formal?: boolean } = {}): Intent {
  const t = text.replace(/\s+/g, " ");
  if (opts.formal) return { label: "vacancy", confidence: 0.95, mode: "keyword", reason: "Listed on a job board as a vacancy." };
  if (opts.sourceHint === "for_hire") return { label: "self_promotion", confidence: 0.95, mode: "keyword", reason: "Tagged [For Hire] by the poster — a freelancer offering services." };

  const role = ROLE.test(t) || clustersIn(t).size > 0;
  const h = hits(HIRING, t);
  const r = hits(RECOMMEND, t);
  const an = hits(ANNOUNCE, t);
  const sp = hits(SELF_PROMO, t);

  if (opts.sourceHint === "hiring" && role) return { label: "hiring_request", confidence: 0.9, mode: "keyword", reason: "Tagged [Hiring] by the poster and mentions relevant work." };
  if (!role) return { label: "not_relevant", confidence: 0.7, mode: "keyword", reason: "Doesn't mention design, website or related work." };
  if (sp > 0 && sp >= h + r) return { label: "self_promotion", confidence: Math.min(0.9, 0.55 + sp * 0.15), mode: "keyword", reason: "Reads like someone offering their own services, not hiring." };
  if (r > 0) return { label: "recommendation_request", confidence: Math.min(0.9, 0.6 + r * 0.15), mode: "keyword", reason: "Asks others to recommend a designer or developer." };
  if (h > 0) return { label: "hiring_request", confidence: Math.min(0.9, 0.5 + h * 0.15), mode: "keyword", reason: "Says they need or are looking for someone for this work." };
  if (an > 0) return { label: "project_announcement", confidence: 0.5, mode: "keyword", reason: "Mentions an upcoming project that may need help." };
  return { label: "not_relevant", confidence: 0.55, mode: "keyword", reason: "Mentions relevant topics but no sign they want to hire." };
}

export const isOpportunityIntent = (i: Intent) =>
  i.label === "vacancy" || i.label === "hiring_request" || i.label === "recommendation_request" || i.label === "project_announcement";

export const INTENT_LABELS: Record<Intent["label"], string> = {
  vacancy: "Vacancy", hiring_request: "Hiring request", recommendation_request: "Asking for recommendations",
  project_announcement: "Upcoming project", self_promotion: "Self-promotion", not_relevant: "Not relevant",
};
