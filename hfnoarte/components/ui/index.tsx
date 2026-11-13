import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-violet text-white hover:bg-violet-bright shadow-[0_6px_20px_-8px_rgb(139_92_246/0.7)]",
  secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-surface-3",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};
const SIZES = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };
export const buttonClass = (variant: Variant = "secondary", size: keyof typeof SIZES = "md", extra?: string) =>
  cx("inline-flex items-center justify-center rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none", VARIANTS[variant], SIZES[size], extra);

export function Button({ variant = "secondary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("card", className)} {...props} />;
}

type Tone = "neutral" | "violet" | "strong" | "reasonable" | "stretch" | "poor" | "danger" | "info" | "sample";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted border-line",
  violet: "bg-violet-wash text-violet-bright border-violet/30",
  strong: "bg-strong/10 text-strong border-strong/25",
  reasonable: "bg-reasonable/10 text-reasonable border-reasonable/25",
  stretch: "bg-stretch/10 text-stretch border-stretch/25",
  poor: "bg-poor/15 text-[#a1a1aa] border-poor/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/25",
  sample: "bg-stretch/15 text-stretch border-stretch/40 font-semibold tracking-wide",
};
export function Badge({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-violet-wash text-violet-bright">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      <div className="mt-1.5 max-w-md text-sm text-muted">{body}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "violet"; title?: string; children: ReactNode; className?: string }) {
  const t = { info: "border-info/25 bg-info/[0.06]", warn: "border-stretch/30 bg-stretch/[0.06]", danger: "border-danger/30 bg-danger/[0.06]", violet: "border-violet/30 bg-violet-wash" }[tone];
  const dot = { info: "bg-info", warn: "bg-stretch", danger: "bg-danger", violet: "bg-violet" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", t, className)}>
      <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
      <div className="min-w-0">
        {title && <p className="font-medium text-fg">{title}</p>}
        <div className="text-muted [&_a]:text-violet-bright [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-tight">{value}</p>
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
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
