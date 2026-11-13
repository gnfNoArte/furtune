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
          <input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} className="field h-11" />
        </div>
      ))}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.message && <Notice tone="violet">{state.message}</Notice>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? "Please wait…" : submit}</Button>
      {footer && <div className="pt-1 text-center text-sm text-muted [&_a]:text-violet-bright hover:[&_a]:underline">{footer}</div>}
    </form>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 size-[480px] rounded-full bg-violet/20 blur-[120px]" />
        <Link href="/" className="relative text-[17px] font-semibold tracking-tight">hf<span className="text-violet-bright">NoArte</span></Link>
        <div className="relative max-w-md">
          <p className="eyebrow mb-4">Hunt for NoArte</p>
          <h2 className="text-[34px] font-semibold leading-[1.15] tracking-tight">Your personal agent for finding work that fits.</h2>
          <ul className="mt-8 space-y-3 text-[14.5px] text-muted">
            <li>Finds vacancies, freelance briefs and social posts from free, permitted sources.</li>
            <li>Scores each one honestly against your real experience.</li>
            <li>Prepares applications and messages — you approve and send them yourself.</li>
          </ul>
        </div>
        <p className="relative text-xs text-faint">Nothing is ever submitted or sent without you.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-10 block text-[17px] font-semibold tracking-tight lg:hidden">hf<span className="text-violet-bright">NoArte</span></Link>
          <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
          <p className="mb-7 mt-1.5 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
