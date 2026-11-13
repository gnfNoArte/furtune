import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  secondary: "bg-transparent text-fg border border-line-strong hover:border-ink",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/[0.06]",
};
const SIZES = { sm: "h-8 px-3.5 text-[13px] gap-1.5", md: "h-11 px-[22px] text-[15px] gap-2", lg: "h-12 px-6 text-[15px] gap-2" };
export const buttonClass = (variant: Variant = "secondary", size: keyof typeof SIZES = "md", extra?: string) =>
  cx("inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none", VARIANTS[variant], SIZES[size], extra);

export function Button({ variant = "secondary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("card", className)} {...props} />;
}

type Tone = "neutral" | "butter" | "strong" | "reasonable" | "stretch" | "poor" | "danger" | "info" | "sample";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  butter: "bg-butter text-ink border-[#E6D7A6]",
  strong: "bg-ink text-paper border-ink",
  reasonable: "bg-walnut/[0.08] text-walnut border-walnut/30",
  stretch: "bg-transparent text-stretch border-stretch/40",
  poor: "bg-transparent text-faint border-line",
  danger: "bg-danger/[0.06] text-danger border-danger/30",
  info: "bg-transparent text-muted border-line-strong",
  sample: "bg-butter text-ink border-stretch/50 font-mono uppercase tracking-[0.06em] text-[10.5px]",
};
export function Badge({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="rise mb-8 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display text-[38px] sm:text-[48px]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line-strong px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-butter text-ink">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      <div className="mt-1.5 max-w-md text-sm text-muted">{body}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "butter"; title?: string; children: ReactNode; className?: string }) {
  const t = { info: "border-info/25 bg-info/[0.06]", warn: "border-stretch/30 bg-stretch/[0.06]", danger: "border-danger/30 bg-danger/[0.06]", butter: "border-ink/25 bg-butter" }[tone];
  const dot = { info: "bg-info", warn: "bg-stretch", danger: "bg-danger", butter: "bg-ink" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", t, className)}>
      <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
      <div className="min-w-0">
        {title && <p className="font-medium text-fg">{title}</p>}
        <div className="text-muted [&_a]:underline [&_a]:underline-offset-2">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-[30px] font-medium tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </>
  );
  return href
    ? <Link href={href} className="card block p-4 transition-colors hover:border-line-strong">{body}</Link>
    : <div className="card p-4">{body}</div>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}
