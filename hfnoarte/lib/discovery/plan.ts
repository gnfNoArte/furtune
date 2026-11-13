import { candidateClusters } from "../candidate/clusters";
import { RELATED_TITLES, SOCIAL_SEARCH_PHRASES, clustersIn } from "../taxonomy";
import type { QueryPlan } from "../sources/types";
import type { CandidateProfile, Preferences } from "../types";

const uniqCI = (xs: string[]) => {
  const seen = new Set<string>();
  return xs.filter((x) => { const k = x.trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
};

const KEYWORD_FOR_CLUSTER: Record<string, string> = {
  webflow: "webflow", framer: "framer", shopify: "shopify", figma: "figma", product_design: "product designer",
  ui_ux: "ux designer", branding: "brand designer", web_design: "web designer", web3: "web3 designer",
  data_annotation: "data annotation", ai_training: "ai trainer", no_code: "no-code",
};

/** Turn the candidate's profile and preferences into many related searches. */
export function buildPlan(profile: CandidateProfile, prefs: Preferences): QueryPlan {
  const have = candidateClusters(profile);
  const expand = (titles: string[]) => {
    const out: string[] = [];
    for (const t of titles) {
      out.push(t);
      const tc = clustersIn(t);
      for (const [category, related] of Object.entries(RELATED_TITLES)) {
        const cc = clustersIn(`${category} ${related.join(" ")}`);
        if (t.toLowerCase() === category.toLowerCase() || [...tc].some((c) => cc.has(c))) out.push(...related.slice(0, 5));
      }
    }
    return out;
  };
  // The candidate's own targets (and their related titles) come first.
  const expanded: string[] = [...expand(prefs.target_titles), ...profile.suggested_titles, ...expand(profile.suggested_titles)];
  // Without any titles, fall back to the candidate's strongest areas.
  if (!expanded.length) for (const [c, k] of Object.entries(KEYWORD_FOR_CLUSTER)) if (have.has(c)) expanded.push(k);

  const keywords = uniqCI([
    ...prefs.keywords,
    ...Object.entries(KEYWORD_FOR_CLUSTER).filter(([c]) => have.has(c)).map(([, k]) => k),
  ]);

  const phrases = uniqCI([
    ...SOCIAL_SEARCH_PHRASES.filter((p) => [...clustersIn(p)].some((c) => have.has(c))),
    ...prefs.keywords.slice(0, 4).map((k) => `looking for a ${k}`),
  ]);

  return {
    titles: uniqCI(expanded).slice(0, 16),
    keywords: keywords.slice(0, 10),
    phrases: phrases.slice(0, 12),
    locations: prefs.locations,
  };
}
