"use client";
import { useActionState, useState } from "react";
import { addByUrl, addManual } from "@/app/actions/opportunities";
import { Button, Field, Notice } from "../ui";

export function AddByUrlForm() {
  const [state, action, pending] = useActionState(addByUrl, undefined);
  const [showManual, setShowManual] = useState(false);
  return (
    <div className="space-y-6">
      <form action={action} className="card space-y-4 p-5">
        <Field label="Link to a job, freelance listing or public post" htmlFor="url" hint="Public pages only. Pages behind a login or CAPTCHA aren't bypassed — you'll be offered manual entry instead.">
          <input id="url" name="url" type="url" required placeholder="https://…" className="field h-11" defaultValue={state?.url} />
        </Field>
        {state?.error && <Notice tone={state.manual ? "warn" : "danger"} title="Couldn't import automatically">{state.error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "Reading page…" : "Import and analyse"}</Button>
          <Button type="button" variant="ghost" onClick={() => setShowManual((v) => !v)}>{showManual || state?.manual ? "Hide manual entry" : "Enter manually instead"}</Button>
        </div>
      </form>
      {(showManual || state?.manual) && <ManualForm url={state?.url} />}
    </div>
  );
}

function ManualForm({ url }: { url?: string }) {
  const [state, action, pending] = useActionState(addManual, undefined);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><p className="font-medium">Manual entry</p><p className="text-sm text-muted">Fill in what you know. It&apos;s scored against your profile the same way.</p></div>
      <Field label="Title *" htmlFor="m-title"><input id="m-title" name="title" required className="field" /></Field>
      <Field label="Type" htmlFor="m-kind">
        <select id="m-kind" name="kind" className="field"><option value="employment">Job / internship</option><option value="freelance">Freelance project</option><option value="social">Social post</option></select>
      </Field>
      <Field label="Company" htmlFor="m-company"><input id="m-company" name="company" className="field" /></Field>
      <Field label="Posted by (account or person)" htmlFor="m-pub"><input id="m-pub" name="publisher" className="field" /></Field>
      <Field label="Location" htmlFor="m-loc"><input id="m-loc" name="location" className="field" /></Field>
      <Field label="Arrangement" htmlFor="m-arr">
        <select id="m-arr" name="work_arrangement" className="field"><option value="">Not stated</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
      </Field>
      <Field label="Employment type" htmlFor="m-type">
        <select id="m-type" name="employment_type" className="field"><option value="">Not stated</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="freelance">Freelance</option><option value="graduate">Graduate</option></select>
      </Field>
      <Field label="Salary / budget" htmlFor="m-sal" hint='e.g. "$2,000" or "£40k–£50k"'><input id="m-sal" name="salary" className="field" /></Field>
      <Field label="Original link" htmlFor="m-url"><input id="m-url" name="url" type="url" defaultValue={url} className="field" /></Field>
      <Field label="Date posted (if shown)" htmlFor="m-date"><input id="m-date" name="published_at" type="date" className="field" /></Field>
      <div className="sm:col-span-2"><Field label="Description *" htmlFor="m-desc"><textarea id="m-desc" name="description" required rows={8} className="field" placeholder="Paste the job description or post text" /></Field></div>
      {state?.error && <div className="sm:col-span-2"><Notice tone="danger">{state.error}</Notice></div>}
      <div className="sm:col-span-2"><Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save and analyse"}</Button></div>
    </form>
  );
}
