"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { deliver } from "@/lib/notify/channels";

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 60);
const all = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);

export async function savePreferences(_: unknown, f: FormData) {
  const { supabase, user } = await requireUser();
  const min = String(f.get("min_salary") ?? "").replace(/[^\d.]/g, "");
  const sources = all(f, "enabled_sources");
  const { error } = await supabase.from("preferences").update({
    opportunity_kinds: all(f, "opportunity_kinds"),
    include_internships: f.get("include_internships") === "on",
    target_titles: list(f.get("target_titles")),
    keywords: list(f.get("keywords")),
    excluded_keywords: list(f.get("excluded_keywords")),
    locations: list(f.get("locations")),
    work_arrangements: all(f, "work_arrangements"),
    employment_types: all(f, "employment_types"),
    min_salary: min ? Number(min) : null,
    currency: String(f.get("currency") || "USD").toUpperCase().slice(0, 3),
    adzuna_country: String(f.get("adzuna_country") || "gb").toLowerCase().slice(0, 2),
    company_boards: list(f.get("company_boards")).map((b) => b.toLowerCase().replace(/\s+/g, "")),
    enabled_sources: f.get("all_sources") === "on" ? null : sources,
    daily_discovery: f.get("daily_discovery") === "on",
  }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return error ? { error: error.message } : { message: "Preferences saved." };
}

export async function saveNotificationSettings(_: unknown, f: FormData) {
  const { supabase, user } = await requireUser();
  const text = (k: string) => String(f.get(k) ?? "").trim() || null;
  const { error } = await supabase.from("notification_settings").update({
    frequency: String(f.get("frequency") || "instant"),
    min_band: String(f.get("min_band") || "reasonable"),
    email_enabled: f.get("email_enabled") === "on", email_address: text("email_address"),
    telegram_enabled: f.get("telegram_enabled") === "on", telegram_chat_id: text("telegram_chat_id"),
    whatsapp_enabled: f.get("whatsapp_enabled") === "on", whatsapp_phone: text("whatsapp_phone"),
    ...(text("whatsapp_apikey") ? { whatsapp_apikey: text("whatsapp_apikey") } : {}),
    reminders_enabled: f.get("reminders_enabled") === "on",
  }).eq("user_id", user.id);
  revalidatePath("/notifications");
  return error ? { error: error.message } : { message: "Notification settings saved." };
}

export async function sendTestNotification() {
  const { supabase, user } = await requireUser();
  const { data: s } = await supabase.from("notification_settings").select("*").eq("user_id", user.id).single();
  if (!s) return { error: "No settings found." };
  const result = await deliver(s, {
    subject: "hfNoArte test notification",
    text: "This is a test from hfNoArte. New matches will arrive like this, with a direct link to the original post.",
    html: "<p>This is a test from <b>hfNoArte</b>. New matches will arrive like this, with a direct link to the original post.</p>",
  });
  await supabase.from("notifications").insert({ user_id: user.id, kind: "system", title: "Test notification", body: JSON.stringify(result), channels: result });
  revalidatePath("/notifications");
  if (!Object.keys(result).length) return { error: "No channel is enabled and filled in yet." };
  return { message: Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(" · ") };
}

export async function markAllRead() {
  const { supabase } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}
