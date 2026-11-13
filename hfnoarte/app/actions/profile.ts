"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiAvailable } from "@/lib/ai/client";
import { NOARTE_SEED_PROFILE } from "@/lib/candidate/seed";
import { aiExtract, keywordExtract, type Extraction } from "@/lib/resume/extract";
import { MAX_RESUME_BYTES, RESUME_TYPES, extractResumeText } from "@/lib/resume/text";
import { requireUser } from "@/lib/supabase/server";
import type { CandidateProfile } from "@/lib/types";

const str = z.string().trim().max(5000).nullish();
const ProfileSchema = z.object({
  full_name: str, headline: str, summary: str, portfolio_url: str, writing_style: str,
  experience_level: z.enum(["junior", "mid", "senior"]).nullish().or(z.literal("").transform(() => null)),
  skills: z.array(z.object({ name: z.string().trim().min(1).max(120), category: z.string().trim().max(80).default("Skills"), evidence: z.string().trim().max(300).optional() })).max(150),
  experiences: z.array(z.object({
    title: z.string().trim().min(1).max(160), organization: z.string().trim().max(160).default(""),
    kind: z.enum(["employment", "freelance", "contract", "project"]), start: z.string().trim().max(10).optional(),
    end: z.string().trim().max(10).nullish(), description: z.string().trim().max(2000).optional(),
  })).max(50),
  projects: z.array(z.object({
    name: z.string().trim().min(1).max(160), kind: z.enum(["client", "personal", "exploration", "employment"]),
    roles: z.array(z.string().trim().max(120)).max(20), skills: z.array(z.string().trim().max(120)).max(30),
    description: z.string().trim().max(2000).optional(), url: z.string().trim().max(500).optional(),
  })).max(60),
  education: z.array(z.object({ institution: z.string().trim().min(1).max(200), qualification: z.string().trim().max(200).default(""), start: z.string().max(10).optional(), end: z.string().max(10).optional() })).max(20),
  suggested_titles: z.array(z.string().trim().min(1).max(120)).max(40),
});

export async function saveProfile(profile: CandidateProfile, origin: "manual" | "resume" | "seed" = "manual") {
  const { supabase, user } = await requireUser();
  const parsed = ProfileSchema.safeParse(profile);
  if (!parsed.success) return { error: `Please check the profile: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}` };
  const { error } = await supabase.from("candidate_profiles").upsert({ user_id: user.id, ...parsed.data, origin });
  if (error) return { error: error.message };
  await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function startFromSeed() {
  const { supabase, user } = await requireUser();
  await supabase.from("candidate_profiles").upsert({ user_id: user.id, ...NOARTE_SEED_PROFILE, origin: "seed" });
  await supabase.from("preferences").update({ target_titles: NOARTE_SEED_PROFILE.suggested_titles.slice(0, 8), keywords: ["webflow", "framer", "shopify", "figma"] }).eq("user_id", user.id);
  await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
  redirect("/profile?welcome=1");
}

export async function startBlank() {
  const { supabase, user } = await requireUser();
  await supabase.from("candidate_profiles").upsert({ user_id: user.id, origin: "manual" });
  await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
  redirect("/profile?welcome=1");
}

export type UploadResult = { error?: string; resumeId?: string; extraction?: Extraction; textPreview?: string };

export async function uploadResume(form: FormData): Promise<UploadResult> {
  const { supabase, user } = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a PDF or DOCX file." };
  const kind = RESUME_TYPES[file.type] ?? (file.name.toLowerCase().endsWith(".pdf") ? "pdf" : file.name.toLowerCase().endsWith(".docx") ? "docx" : undefined);
  if (!kind) return { error: "Only PDF and DOCX resumes are supported." };
  if (file.size > MAX_RESUME_BYTES) return { error: "The file is larger than 8 MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-100);
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from("resumes").upload(path, buf, { contentType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: row } = await supabase.from("resumes").insert({ user_id: user.id, storage_path: path, file_name: file.name, mime_type: file.type || kind }).select("id").single();

  let text = "";
  try {
    text = await extractResumeText(buf, kind);
  } catch {
    await supabase.from("resumes").update({ parse_status: "failed", parse_error: "Could not read text from the file." }).eq("id", row?.id);
    return { resumeId: row?.id, error: "The file was saved, but its text couldn't be read (it may be a scanned image). Edit your profile manually below." };
  }
  if (text.length < 80) {
    await supabase.from("resumes").update({ parse_status: "failed", extracted_text: text, parse_error: "Almost no text found." }).eq("id", row?.id);
    return { resumeId: row?.id, error: "Almost no text was found in the file (it may be a scanned image). Edit your profile manually below." };
  }

  let extraction: Extraction;
  if (aiAvailable()) {
    try { extraction = await aiExtract(text); }
    catch (e) {
      extraction = keywordExtract(text);
      extraction.warnings.unshift(`AI analysis failed (${(e as Error).message.slice(0, 120)}), so keyword extraction was used.`);
    }
  } else extraction = keywordExtract(text);

  await supabase.from("resumes").update({ parse_status: "parsed", parse_mode: extraction.mode, extracted_text: text, extraction }).eq("id", row?.id);
  return { resumeId: row?.id, extraction, textPreview: text.slice(0, 1200) };
}
