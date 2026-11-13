import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateProfile, Preferences } from "./types";

export const DEFAULT_PREFERENCES: Preferences = {
  opportunity_kinds: ["employment", "freelance", "social"],
  include_internships: true,
  target_titles: [],
  keywords: [],
  excluded_keywords: [],
  locations: [],
  work_arrangements: ["remote"],
  employment_types: ["full_time", "part_time", "contract", "internship", "freelance"],
  min_salary: null,
  currency: "USD",
  adzuna_country: "gb",
  enabled_sources: null,
  company_boards: [],
  daily_discovery: true,
};

export async function loadProfile(db: SupabaseClient, userId: string): Promise<CandidateProfile | null> {
  const { data } = await db.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return {
    full_name: data.full_name, headline: data.headline, summary: data.summary,
    experience_level: data.experience_level, skills: data.skills ?? [], experiences: data.experiences ?? [],
    projects: data.projects ?? [], education: data.education ?? [], suggested_titles: data.suggested_titles ?? [],
    portfolio_url: data.portfolio_url, writing_style: data.writing_style, origin: data.origin,
  };
}

export async function loadPreferences(db: SupabaseClient, userId: string): Promise<Preferences> {
  const { data } = await db.from("preferences").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_PREFERENCES, ...(data ?? {}), min_salary: data?.min_salary == null ? null : Number(data.min_salary) };
}
