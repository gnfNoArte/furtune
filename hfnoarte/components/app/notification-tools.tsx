"use client";
import { useState, useTransition } from "react";
import { markAllRead, sendTestNotification } from "@/app/actions/settings";
import { Button } from "../ui";

export function TestNotification() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={pending} onClick={() => start(async () => { const r = await sendTestNotification(); setMsg(r.error ?? r.message ?? null); })}>{pending ? "Sending…" : "Send test notification"}</Button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await markAllRead(); })}>Mark all read</Button>;
}
