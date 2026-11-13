"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "../ui";
import { IconBell, IconBoard, IconCheckCircle, IconHome, IconLogout, IconMenu, IconRadar, IconSignal, IconSliders, IconUser, IconX } from "../icons";

const PRIMARY = [
  { href: "/", label: "Dashboard", icon: IconHome },
  { href: "/opportunities", label: "Opportunities", icon: IconRadar },
  { href: "/review", label: "Review & Approve", short: "Review", icon: IconCheckCircle, badge: "review" as const },
  { href: "/tracker", label: "Tracker", icon: IconBoard },
];
const SECONDARY = [
  { href: "/profile", label: "Profile", icon: IconUser },
  { href: "/preferences", label: "Preferences", icon: IconSliders },
  { href: "/sources", label: "Sources", icon: IconSignal },
  { href: "/notifications", label: "Notifications", icon: IconBell, badge: "unread" as const },
];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-auto rounded-full bg-ink px-1.5 text-[11px] font-medium leading-[18px] text-paper tabular-nums">{n > 99 ? "99+" : n}</span>;
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="grid size-9 place-items-center rounded-[10px] bg-ink text-paper" aria-hidden>
        <span className="na-mono text-[17px]">NA</span>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">hfNoArte</span>
        <span className="block font-mono text-[10.5px] uppercase tracking-[0.07em] text-muted">Hunt for NoArte</span>
      </span>
    </Link>
  );
}

export function Sidebar({ counts, email }: { counts: { review: number; unread: number }; email: string }) {
  const path = usePathname();
  const item = (i: (typeof PRIMARY)[number] | (typeof SECONDARY)[number]) => {
    const Icon = i.icon;
    const on = active(path, i.href);
    return (
      <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
        className={cx("group flex items-center gap-3 rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors", on ? "bg-surface-3 text-ink font-medium" : "text-muted hover:bg-surface-2 hover:text-fg")}>
        <Icon className={cx(on ? "text-ink" : "text-faint group-hover:text-muted")} />
        {i.label}
        {"badge" in i && i.badge && <Count n={counts[i.badge]} />}
      </Link>
    );
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
      <Wordmark />
      <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">{PRIMARY.map(item)}</nav>
      <p className="eyebrow mt-7 mb-2 px-2.5">Setup</p>
      <nav className="flex flex-col gap-0.5" aria-label="Setup">{SECONDARY.map(item)}</nav>
      <div className="mt-auto border-t border-line pt-4">
        <p className="truncate px-2.5 text-xs text-faint" title={email}>{email}</p>
        <form action="/auth/signout" method="post">
          <button className="mt-1 flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-[13.5px] text-muted hover:bg-surface-2 hover:text-fg"><IconLogout className="text-faint" /> Sign out</button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ counts, email }: { counts: { review: number; unread: number }; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const moreActive = SECONDARY.some((i) => active(path, i.href));
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur lg:hidden">
        <Wordmark />
        <Link href="/notifications" className="relative grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label={`Notifications${counts.unread ? `, ${counts.unread} unread` : ""}`}>
          <IconBell />
          {counts.unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ink" />}
        </Link>
      </header>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {PRIMARY.map((i) => {
          const Icon = i.icon;
          const on = active(path, i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[10.5px]", on ? "text-fg" : "text-faint")}>
              <Icon className={on ? "text-fg" : ""} />
              {"short" in i && i.short ? i.short : i.label}
              {i.badge && counts[i.badge] > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 rounded-full bg-ink px-1 text-[9.5px] font-semibold leading-[15px] text-paper">{counts[i.badge]}</span>}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className={cx("flex flex-col items-center gap-1 py-2.5 text-[10.5px]", moreActive ? "text-fg" : "text-faint")} aria-expanded={open}>
          <IconMenu className={moreActive ? "text-fg" : ""} /> More
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="truncate text-sm text-faint">{email}</p>
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Close"><IconX /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map((i) => {
                const Icon = i.icon;
                return (
                  <Link key={i.href} href={i.href} className={cx("flex items-center gap-3 rounded-xl border border-line px-3 py-3 text-sm", active(path, i.href) ? "bg-surface-3" : "bg-surface-2")}>
                    <Icon className="text-fg" /> {i.label}
                    {"badge" in i && i.badge && <Count n={counts[i.badge]} />}
                  </Link>
                );
              })}
            </div>
            <form action="/auth/signout" method="post" className="mt-3">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm text-muted"><IconLogout /> Sign out</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
