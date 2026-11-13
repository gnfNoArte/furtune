import type { OpportunityKind, Preferences, RawOpportunity } from "../types";

export type Availability =
  | { state: "ready"; note?: string }
  | { state: "limited"; note: string }
  | { state: "not_configured"; note: string; setup: string }
  | { state: "not_integrated"; note: string };

export interface QueryPlan {
  /** Job titles, already expanded with related titles. */
  titles: string[];
  /** Short keywords for boards that search by tag. */
  keywords: string[];
  /** Natural phrases used on social platforms. */
  phrases: string[];
  locations: string[];
}

export interface SearchContext {
  plan: QueryPlan;
  prefs: Preferences;
  now: Date;
}

export interface SearchResult {
  items: RawOpportunity[];
  status: "ok" | "limited" | "failed" | "skipped";
  message?: string;
  queries: string[];
}

export interface SourceAdapter {
  id: string;
  name: string;
  kinds: OpportunityKind[];
  /** How the data is accessed, shown to the candidate. */
  access: string;
  /** What this source can and can't see. */
  coverage: string;
  availability(): Availability;
  search?(ctx: SearchContext): Promise<SearchResult>;
}
