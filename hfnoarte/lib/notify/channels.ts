// Free notification channels. Nothing here ever contacts an employer or a
// poster — these only send messages to the candidate themself.
import "server-only";

export interface ChannelSettings {
  email_enabled: boolean; email_address: string | null;
  telegram_enabled: boolean; telegram_chat_id: string | null;
  whatsapp_enabled: boolean; whatsapp_phone: string | null; whatsapp_apikey: string | null;
}

export interface Message { subject: string; text: string; html: string }

export const channelStatus = () => ({
  email: process.env.RESEND_API_KEY ? "ready" : "not_configured",
  telegram: process.env.TELEGRAM_BOT_TOKEN ? "ready" : "not_configured",
  whatsapp: "ready", // CallMeBot keys are per person, entered in Settings.
});

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

export async function sendEmail(to: string, m: Message) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  await post("https://api.resend.com/emails", {
    from: process.env.EMAIL_FROM || "hfNoArte <onboarding@resend.dev>", to: [to], subject: m.subject, text: m.text, html: m.html,
  }, { Authorization: `Bearer ${process.env.RESEND_API_KEY}` });
}

export async function sendTelegram(chatId: string, m: Message) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
  // Telegram messages are limited to 4096 characters.
  await post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: chatId, text: m.text.slice(0, 4000), disable_web_page_preview: true,
  });
}

export async function sendWhatsApp(phone: string, apikey: string, m: Message) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(m.text.slice(0, 1500))}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  if (!res.ok || /error|invalid/i.test(body.slice(0, 300))) throw new Error(`CallMeBot: ${body.replace(/<[^>]+>/g, " ").trim().slice(0, 160) || res.status}`);
}

/** Send to every enabled channel; returns a per-channel outcome. */
export async function deliver(s: ChannelSettings, m: Message): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const tasks: Promise<void>[] = [];
  const run = (name: string, fn: () => Promise<void>) =>
    tasks.push(fn().then(() => { out[name] = "sent"; }).catch((e) => { out[name] = `failed: ${(e as Error).message}`; }));
  if (s.email_enabled && s.email_address) run("email", () => sendEmail(s.email_address!, m));
  if (s.telegram_enabled && s.telegram_chat_id) run("telegram", () => sendTelegram(s.telegram_chat_id!, m));
  if (s.whatsapp_enabled && s.whatsapp_phone && s.whatsapp_apikey) run("whatsapp", () => sendWhatsApp(s.whatsapp_phone!, s.whatsapp_apikey!, m));
  await Promise.all(tasks);
  return out;
}
