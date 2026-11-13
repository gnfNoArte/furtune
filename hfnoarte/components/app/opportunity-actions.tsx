"use client";
import { useState, useTransition } from "react";
import { approve, rejectApplication, revoke } from "@/app/actions/drafts";
import { deleteOpportunity, prepareMaterial, rescore, saveTracking, setStatus } from "@/app/actions/opportunities";
import { Button, Field, Notice } from "../ui";
import { IconExternal, IconSparkle } from "../icons";
import { OPPORTUNITY_STATUSES, STATUS_LABELS, STATUSES_NEEDING_APPROVAL, type OpportunityStatus } from "@/lib/types";

export function PrepareButton({ id, hasDrafts }: { id: string; hasDrafts: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button variant={hasDrafts ? "secondary" : "primary"} disabled={pending} onClick={() => start(async () => { const r = await prepareMaterial(id); setNote(r.error ?? r.note ?? null); })}>
        <IconSparkle width={16} height={16} /> {pending ? "Preparing…" : hasDrafts ? "Regenerate drafts" : "Prepare application"}
      </Button>
      {note && <p className="text-xs text-stretch">{note}</p>}
    </div>
  );
}

export function RescoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await rescore(id); setNote(r.error ?? r.note ?? "Re-scored."); })}>{pending ? "Scoring…" : "Re-score"}</Button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </span>
  );
}

export function ApprovalPanel({ id, approvedAt, pendingCount, url, status }: { id: string; approvedAt: string | null; pendingCount: number; url: string | null; status: OpportunityStatus }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "danger" | "butter"; text: string } | null>(null);
  const applied = ["applied", "contacted", "follow_up", "interview", "won"].includes(status);
  if (approvedAt) {
    return (
      <div className="space-y-3">
        <Notice tone="butter" title="Approved — ready for you to use">
          Approval doesn&apos;t submit anything. Open the original page, paste your approved material, and apply or reply yourself. Then record it below.
        </Notice>
        <div className="flex flex-wrap gap-2">
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-soft"><IconExternal width={16} height={16} /> Open original</a>}
          {!applied && <Button disabled={pending} onClick={() => start(async () => { if (confirm("Only mark this as applied once you've actually submitted it on the employer's site. Continue?")) { const r = await setStatus(id, "applied"); if (r.error) setMsg({ tone: "danger", text: r.error }); } })}>I&apos;ve applied</Button>}
          {!applied && <Button disabled={pending} onClick={() => start(async () => { if (confirm("Only mark this as contacted once you've actually sent your message. Continue?")) { const r = await setStatus(id, "contacted"); if (r.error) setMsg({ tone: "danger", text: r.error }); } })}>I&apos;ve sent my message</Button>}
          {!applied && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await revoke(id); })}>Undo approval</Button>}
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{pendingCount ? `${pendingCount} draft${pendingCount === 1 ? "" : "s"} waiting for your review.` : "No drafts are waiting for review."} Nothing is submitted or sent until you approve, and even then you send it yourself.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={pending || !pendingCount} onClick={() => start(async () => { const r = await approve([id]); setMsg(r.error ? { tone: "danger", text: r.error } : r.failed?.length ? { tone: "danger", text: r.failed[0].message } : { tone: "butter", text: "Approved." }); })}>Approve application</Button>
        {pendingCount > 0 && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await rejectApplication(id); })}>Reject drafts</Button>}
        {!pendingCount && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { if (confirm("Approve without any prepared material? Use this if you'll apply with your own documents.")) { const r = await approve([id], true); setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "butter", text: "Approved." }); } })}>Approve without material</Button>}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

export function StatusSelect({ id, status, approved }: { id: string; status: OpportunityStatus; approved: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <label className="label" htmlFor="status">Status</label>
      <select id="status" className="field" value={status} disabled={pending}
        onChange={(e) => start(async () => { const r = await setStatus(id, e.target.value as OpportunityStatus); setErr(r.error ?? null); })}>
        {OPPORTUNITY_STATUSES.map((s) => (
          <option key={s} value={s} disabled={!approved && STATUSES_NEEDING_APPROVAL.includes(s) && s !== status}>
            {STATUS_LABELS[s]}{!approved && STATUSES_NEEDING_APPROVAL.includes(s) ? " (approve first)" : ""}
          </option>
        ))}
      </select>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

export function TrackingForm({ id, initial }: { id: string; initial: { notes: string | null; follow_up_date: string | null; interview_at: string | null; interview_notes: string | null; applied_at: string | null; documents: { label: string; url: string }[] } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [docs, setDocs] = useState(initial.documents.length ? initial.documents : [{ label: "", url: "" }]);
  const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await saveTracking(id, {
          notes: String(f.get("notes") ?? ""), follow_up_date: String(f.get("follow_up_date") || "") || null,
          interview_at: String(f.get("interview_at") || "") || null, interview_notes: String(f.get("interview_notes") ?? ""),
          applied_at: initial.applied_at !== null || f.get("applied_at") ? String(f.get("applied_at") || "") || null : undefined,
          documents: docs,
        });
        setMsg(r.error ?? "Saved.");
      });
    }}>
      <Field label="Follow-up date" htmlFor="fu" hint="You'll get a reminder on this day."><input id="fu" name="follow_up_date" type="date" defaultValue={initial.follow_up_date ?? ""} className="field" /></Field>
      <Field label="Application date" htmlFor="ad" hint="Set automatically when you mark it applied."><input id="ad" name="applied_at" type="date" defaultValue={initial.applied_at?.slice(0, 10) ?? ""} className="field" /></Field>
      <Field label="Interview time" htmlFor="ia"><input id="ia" name="interview_at" type="datetime-local" defaultValue={toLocal(initial.interview_at)} className="field" /></Field>
      <Field label="Interview details" htmlFor="in"><input id="in" name="interview_notes" defaultValue={initial.interview_notes ?? ""} placeholder="Who, where, link…" className="field" /></Field>
      <div className="sm:col-span-2"><Field label="Notes" htmlFor="notes"><textarea id="notes" name="notes" rows={4} defaultValue={initial.notes ?? ""} className="field" /></Field></div>
      <div className="sm:col-span-2">
        <p className="label">Documents (links)</p>
        <div className="space-y-2">
          {docs.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] gap-2">
              <input aria-label="Document name" placeholder="e.g. CV v3" value={d.label} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="field" />
              <input aria-label="Document link" placeholder="https://…" value={d.url} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className="field" />
              <Button type="button" variant="ghost" size="md" aria-label="Remove document" onClick={() => setDocs(docs.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setDocs([...docs, { label: "", url: "" }])}>+ Add document link</Button>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save tracking"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </form>
  );
}

export function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button variant="danger" size="sm" disabled={pending} onClick={() => { if (confirm("Delete this opportunity and its drafts?")) start(async () => { await deleteOpportunity(id); }); }}>Delete</Button>;
}
