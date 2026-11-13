"use client";
import { useState, useTransition } from "react";
import { saveDraft, setDraftState } from "@/app/actions/drafts";
import { Badge, Button } from "../ui";
import { CopyButton } from "./copy-button";
import type { ReviewState } from "@/lib/types";

export interface DraftRow { id: string; kind: string; title: string; content: string; review_state: ReviewState; generated_mode: string | null; warnings: string[]; approved_at: string | null }

const STATE: Record<ReviewState, { label: string; tone: "neutral" | "violet" | "strong" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" }, pending_review: { label: "Pending review", tone: "violet" },
  approved: { label: "Approved", tone: "strong" }, rejected: { label: "Rejected", tone: "danger" },
};

export function DraftEditor({ d }: { d: DraftRow }) {
  const [text, setText] = useState(d.content);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = text !== d.content;
  const save = () => start(async () => { const r = await saveDraft(d.id, text); setMsg(r.error ?? (d.review_state === "approved" ? "Saved — edited, so it's back in review." : "Saved.")); });
  return (
    <div className="rounded-xl border border-line bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <p className="text-sm font-medium">{d.title}</p>
        <Badge tone={STATE[d.review_state].tone}>{STATE[d.review_state].label}</Badge>
        <Badge title={d.generated_mode === "ai" ? "Written by AI from your profile" : d.generated_mode === "template" ? "Built from a template using only your profile facts" : "Written by you"}>{d.generated_mode === "ai" ? "AI draft" : d.generated_mode === "template" ? "Template" : "Manual"}</Badge>
        <div className="ml-auto"><CopyButton text={text} /></div>
      </div>
      {d.warnings.length > 0 && (
        <ul className="border-b border-line bg-stretch/[0.06] px-4 py-2 text-[12.5px] text-stretch">{d.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(18, Math.max(5, text.split("\n").length + 1))}
        aria-label={d.title} className="block w-full resize-y bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none" />
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <Button size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending} onClick={save}>Save</Button>
        {d.review_state === "draft" && <Button size="sm" disabled={pending || dirty} onClick={() => start(async () => { await setDraftState(d.id, "pending_review"); })}>Send for review</Button>}
        {d.review_state === "rejected" && <Button size="sm" disabled={pending} onClick={() => start(async () => { await setDraftState(d.id, "pending_review"); })}>Back to review</Button>}
        {(d.review_state === "pending_review" || d.review_state === "draft") && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await setDraftState(d.id, "rejected"); })}>Reject draft</Button>}
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </div>
  );
}
