import { CODE_HEAVY, clustersIn } from "../taxonomy";
import type { QueryPlan } from "./types";

/** Cheap pre-filter for broad feeds: does this text touch the candidate's fields at all? */
export function looksRelevant(text: string, plan: QueryPlan): boolean {
  const t = text.toLowerCase();
  for (const c of clustersIn(t)) if (!CODE_HEAVY.has(c)) return true;
  return [...plan.titles, ...plan.keywords].some((k) => k.length > 3 && t.includes(k.toLowerCase()));
}

export const uniq = <T,>(xs: T[]) => [...new Set(xs)];
