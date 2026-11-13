// Checks prepared text against the candidate's profile before it reaches the
// review queue, and flags any technology the candidate hasn't listed.
import { candidateClusters } from "../candidate/clusters";
import { CLUSTERS, clustersIn } from "../taxonomy";
import type { CandidateProfile } from "../types";

const CLAIM = /\b(\d+\+?\s*(years|yrs)|increased|boosted|grew|improved|reduced)\b[^.]{0,60}\b(\d+%|\d+x)\b|\b\d+%\s+(increase|growth|more|uplift)\b/i;

export function checkDraft(text: string, profile: CandidateProfile): string[] {
  const have = candidateClusters(profile);
  const warnings: string[] = [];
  for (const id of clustersIn(text)) {
    const c = CLUSTERS.find((x) => x.id === id)!;
    if (c.codeHeavy && !have.has(id)) warnings.push(`Mentions ${c.label}, which isn't in your profile.`);
  }
  if (/\b(we|our team|our agency|us)\b/i.test(text.replace(/\b(let us|let's)\b/gi, ""))) warnings.push('Uses "we"/"our team" — NoArte is one person, so write in first person ("I").');
  if (/\bweb designer\b/i.test(text) && /\b(i'?m|i am)\b[^.]{0,20}\bweb designer\b/i.test(text)) warnings.push('Calls you a "web designer" — you design and build; say that instead.');
  if (CLAIM.test(text)) warnings.push("Contains a measurable claim — make sure it's true before using it.");
  const yrs = /(\d+)\+?\s*years? of experience/i.exec(text);
  if (yrs) warnings.push(`Says "${yrs[0]}" — check this matches your real history.`);
  return warnings;
}
