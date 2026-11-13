"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

const refresh = () => revalidatePath("/", "layout");

export async function saveDraft(id: string, content: string) {
  const { supabase } = await requireUser();
  // The database moves an edited approved draft back to "pending review".
  const { error } = await supabase.from("drafts").update({ content: content.slice(0, 20_000) }).eq("id", id);
  refresh();
  return error ? { error: error.message } : { ok: true };
}

export async function setDraftState(id: string, state: "pending_review" | "rejected" | "draft") {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("drafts").update({ review_state: state }).eq("id", id);
  refresh();
  return error ? { error: error.message } : { ok: true };
}

/** Explicit approval by the signed-in candidate. Approval never submits anything. */
export async function approve(opportunityIds: string[], allowWithoutMaterial = false) {
  if (!opportunityIds.length) return { error: "Nothing selected." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("approve_applications", { opportunity_ids: opportunityIds, allow_without_material: allowWithoutMaterial });
  refresh();
  if (error) return { error: error.message };
  const rows = (data ?? []) as { opportunity_id: string; approved: boolean; message: string }[];
  return { approved: rows.filter((r) => r.approved).length, failed: rows.filter((r) => !r.approved) };
}

export async function rejectApplication(opportunityId: string) {
  const { supabase } = await requireUser();
  await supabase.from("drafts").update({ review_state: "rejected" }).eq("opportunity_id", opportunityId).eq("review_state", "pending_review");
  refresh();
  return { ok: true };
}

export async function revoke(opportunityId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("revoke_approval", { opportunity_id: opportunityId });
  refresh();
  return error ? { error: error.message } : { ok: true };
}

export async function addDraft(opportunityId: string, kind: string, title: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("drafts").insert({ user_id: user.id, opportunity_id: opportunityId, kind, title, content: "", generated_mode: "manual", review_state: "draft" });
  refresh();
  return error ? { error: error.message } : { ok: true };
}
