"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Notice } from "../ui";
import type { FormState } from "@/app/actions/auth";

type Action = (s: FormState, f: FormData) => Promise<FormState>;
interface FieldDef { name: string; label: string; type?: string; autoComplete?: string; required?: boolean }

export function AuthForm({ action, fields, submit, footer, hidden }: { action: Action; fields: FieldDef[]; submit: string; footer?: React.ReactNode; hidden?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} className="field h-12" />
        </div>
      ))}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.message && <Notice tone="butter">{state.message}</Notice>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? "Please wait…" : submit}</Button>
      {footer && <div className="pt-1 text-center text-sm text-muted [&_a]:underline [&_a]:underline-offset-2">{footer}</div>}
    </form>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-chocolate text-paper lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Link href="/" className="relative flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-9 place-items-center rounded-[10px] bg-paper text-ink"><span className="na-mono text-[17px]">NA</span></span>hfNoArte</Link>
        <div className="relative max-w-md">
          <p className="mb-5 font-mono text-[12px] uppercase tracking-[0.07em] text-paper/70">Hunt for NoArte</p>
          <h2 className="display text-[56px] font-light leading-[1.02]">Work that fits, <em className="italic text-[#C9A24E]">found</em> for you.</h2>
          <ul className="mt-10 space-y-3 text-[15px] text-paper/75">
            <li>Finds vacancies, freelance briefs and social posts from free, permitted sources.</li>
            <li>Scores each one honestly against your real experience.</li>
            <li>Prepares applications and messages — you approve and send them yourself.</li>
          </ul>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.07em] text-paper/60">Nothing is submitted or sent without you</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-12 flex items-center gap-2.5 text-[15px] font-semibold lg:hidden"><span className="grid size-9 place-items-center rounded-[10px] bg-ink text-paper"><span className="na-mono text-[17px]">NA</span></span>hfNoArte</Link>
          <h1 className="display text-[44px]">{title}</h1>
          <p className="mb-8 mt-2 text-[15px] text-muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
