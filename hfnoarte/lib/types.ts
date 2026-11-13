// Shared domain types for hfNoArte.

export type OpportunityKind = "employment" | "freelance" | "social";

export const OPPORTUNITY_STATUSES = [
  "new", "saved", "reviewing", "interested", "message_prepared",
  "contacted", "applied", "follow_up", "interview", "won", "rejected", "expired",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  new: "New", saved: "Saved", reviewing: "Reviewing", interested: "Interested",
  message_prepared: "Message prepared", contacted: "Contacted", applied: "Applied",
  follow_up: "Follow-up", interview: "Interview", won: "Won", rejected: "Rejected", expired: "Expired",
};

/** Statuses the database refuses until the candidate has approved. */
export const STATUSES_NEEDING_APPROVAL: OpportunityStatus[] = ["contacted", "applied", "follow_up", "interview", "won"];

export type ReviewState = "draft" | "pending_review" | "approved" | "rejected";
export type DraftKind =
  | "cover_letter" | "intro" | "qa" | "experience_summary"
  | "comment" | "dm" | "proposal" | "portfolio_pick";

export const DRAFT_LABELS: Record<DraftKind, string> = {
  cover_letter: "Cover letter", intro: "Short introduction", qa: "Application answers",
  experience_summary: "Relevant experience summary", comment: "Public comment",
  dm: "Direct message", proposal: "Freelance proposal", portfolio_pick: "Portfolio recommendation",
};

export type MatchBand = "strong" | "reasonable" | "stretch" | "poor";
export type AnalysisMode = "ai" | "keyword";

export interface Skill { name: string; category: string; evidence?: string }
export interface Experience {
  title: string; organization: string;
  kind: "employment" | "freelance" | "contract" | "project";
  start?: string; end?: string | null; description?: string;
}
export interface Project {
  name: string;
  kind: "client" | "personal" | "exploration" | "employment";
  roles: string[]; skills: string[]; description?: string; url?: string;
}
export interface Education { institution: string; qualification: string; start?: string; end?: string }

export interface CandidateProfile {
  full_name?: string | null;
  headline?: string | null;
  summary?: string | null;
  experience_level?: string | null;
  skills: Skill[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  suggested_titles: string[];
  portfolio_url?: string | null;
  writing_style?: string | null;
  origin?: "seed" | "resume" | "manual";
}

export interface Preferences {
  opportunity_kinds: OpportunityKind[];
  include_internships: boolean;
  target_titles: string[];
  keywords: string[];
  excluded_keywords: string[];
  locations: string[];
  work_arrangements: ("remote" | "onsite" | "hybrid")[];
  employment_types: string[];
  min_salary: number | null;
  currency: string;
  adzuna_country: string;
  enabled_sources: string[] | null;
  company_boards: string[];
  daily_discovery: boolean;
}

export interface Credibility {
  level: "high" | "medium" | "low" | "unknown";
  evidence: { signal: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
}

export interface Intent {
  label: "vacancy" | "hiring_request" | "recommendation_request" | "project_announcement" | "self_promotion" | "not_relevant";
  confidence: number; // 0..1
  mode: AnalysisMode;
  reason: string;
}

export interface MatchComponent { key: string; label: string; score: number; max: number; note: string }
export interface MatchResult {
  score: number;
  band: MatchBand;
  mode: AnalysisMode;
  components: MatchComponent[];
  reasons: string[];
  gaps: string[];
  experience_fit: string;
  deliverable: string;
  caps: string[];
}

/** What every source adapter returns — one item per post or vacancy found. */
export interface RawOpportunity {
  source: string;
  external_id?: string;
  url: string | null;
  kind: OpportunityKind;
  title: string;
  description: string;
  company?: string | null;
  publisher?: string | null;
  publisher_url?: string | null;
  location?: string | null;
  work_arrangement?: "remote" | "onsite" | "hybrid" | null;
  employment_type?: string | null;
  salary_text?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  published_at?: string | null;
  tags?: string[];
  access_method: string;
  /** Public facts about the publisher, only when the platform provides them. */
  author_meta?: {
    account_created_at?: string | null;
    followers?: number | null;
    karma?: number | null;
    posts?: number | null;
    verified?: boolean | null;
  };
  /** Source-provided hint, e.g. Reddit's [Hiring] / [For Hire] tags. */
  source_hint?: "hiring" | "for_hire" | null;
}
