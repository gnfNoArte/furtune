"use client";
import { useActionState } from "react";
import { Button, Notice } from "../ui";

type Action = (s: unknown, f: FormData) => Promise<{ error?: string; message?: string }>;

/** A form that saves through a server action and shows the result inline. */
export function SettingsForm({ action, children, submit = "Save" }: { action: Action; children: React.ReactNode; submit?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-6">
      {children}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : submit}</Button>
        {state?.message && <span className="text-sm text-strong">{state.message}</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function CheckChip({ name, value, label, defaultChecked }: { name: string; value?: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-muted transition-colors has-[:checked]:border-ink has-[:checked]:bg-butter has-[:checked]:text-ink">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="sr-only" />
      {label}
    </label>
  );
}

export function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-faint">{hint}</span>}</span>
      <span className="relative mt-0.5 shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="block h-6 w-10 rounded-full bg-surface-3 ring-1 ring-line transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-fg transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export { Notice };
