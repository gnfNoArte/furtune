import { saveNotificationSettings } from "@/app/actions/settings";
import { MarkAllRead, TestNotification } from "@/components/app/notification-tools";
import { SettingsForm, Toggle } from "@/components/app/settings-form";
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle } from "@/components/ui";
import { IconBell } from "@/components/icons";
import { fmtDateTime } from "@/lib/format";
import { channelStatus } from "@/lib/notify/channels";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const { supabase, user } = await requireUser();
  const [{ data: s }, { data: list }] = await Promise.all([
    supabase.from("notification_settings").select("*").eq("user_id", user.id).single(),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const ch = channelStatus();
  const serverMissing = (k: "email" | "telegram") => ch[k] !== "ready" && <Badge tone="stretch">Server key missing</Badge>;

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_380px]">
      <div className="order-2 xl:order-1">
        <PageHeader eyebrow="Notifications" title="Alerts with a direct link" description="Every alert includes the original link, the score, why it matches and what's missing. Alerts only ever go to you." />
        <SettingsForm action={saveNotificationSettings} submit="Save notification settings">
          <section>
            <SectionTitle>When to notify</SectionTitle>
            <Card className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Frequency" htmlFor="fq">
                <select id="fq" name="frequency" defaultValue={s?.frequency ?? "instant"} className="field">
                  <option value="instant">As soon as found</option><option value="daily">Daily digest</option><option value="off">Off (in-app only)</option>
                </select>
              </Field>
              <Field label="Minimum match" htmlFor="mb">
                <select id="mb" name="min_band" defaultValue={s?.min_band ?? "reasonable"} className="field">
                  <option value="strong">Strong only</option><option value="reasonable">Reasonable and above</option><option value="stretch">Include stretch</option>
                </select>
              </Field>
              <div className="sm:col-span-2"><Toggle name="reminders_enabled" label="Follow-up and interview reminders" defaultChecked={s?.reminders_enabled ?? true} /></div>
            </Card>
          </section>

          <section>
            <SectionTitle>Channels</SectionTitle>
            <div className="space-y-3">
              <Card className="space-y-3 p-5">
                <div className="flex items-center gap-2"><Toggle name="email_enabled" label="Email" defaultChecked={s?.email_enabled} />{serverMissing("email")}</div>
                <Field label="Send to" htmlFor="em" hint="Free via Resend. Without a verified domain, Resend only delivers to your own Resend account email."><input id="em" name="email_address" type="email" defaultValue={s?.email_address ?? ""} className="field" /></Field>
              </Card>
              <Card className="space-y-3 p-5">
                <div className="flex items-center gap-2"><Toggle name="telegram_enabled" label="Telegram" defaultChecked={s?.telegram_enabled} />{serverMissing("telegram")}</div>
                <Field label="Your chat ID" htmlFor="tg" hint="Send any message to your hfNoArte bot, then message @userinfobot to see your numeric ID."><input id="tg" name="telegram_chat_id" defaultValue={s?.telegram_chat_id ?? ""} className="field" inputMode="numeric" /></Field>
              </Card>
              <Card className="space-y-3 p-5">
                <Toggle name="whatsapp_enabled" label="WhatsApp (CallMeBot)" defaultChecked={s?.whatsapp_enabled} />
                <p className="text-xs text-faint">Free for personal use. Follow the WhatsApp steps on callmebot.com to receive your personal key. CallMeBot is an independent service, not an official WhatsApp API.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone (with country code)" htmlFor="wp"><input id="wp" name="whatsapp_phone" defaultValue={s?.whatsapp_phone ?? ""} placeholder="+234…" className="field" /></Field>
                  <Field label="CallMeBot key" htmlFor="wk" hint={s?.whatsapp_apikey ? "Saved — leave blank to keep it." : undefined}><input id="wk" name="whatsapp_apikey" type="password" autoComplete="off" className="field" /></Field>
                </div>
              </Card>
              <TestNotification />
            </div>
          </section>
        </SettingsForm>
      </div>

      <aside className="order-1 xl:order-2">
        <SectionTitle action={<MarkAllRead />}>Inbox</SectionTitle>
        {(list ?? []).length ? (
          <ul className="space-y-2">
            {(list ?? []).map((n) => (
              <li key={n.id} className={`card p-4 ${n.read_at ? "" : "border-ink/25"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-medium">{n.title}</p>
                  {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />}
                </div>
                <p className="mt-1 text-[12px] text-faint">{fmtDateTime(n.created_at)}</p>
                {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 block truncate text-[12.5px] link">{n.link}</a>}
                {Object.keys(n.channels ?? {}).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(n.channels as Record<string, string>).map(([k, v]) => <Badge key={k} tone={v === "sent" ? "strong" : "danger"} title={v}>{k}: {v === "sent" ? "sent" : "failed"}</Badge>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<IconBell />} title="No notifications yet" body="New matches, reminders and test messages appear here." />}
      </aside>
    </div>
  );
}
