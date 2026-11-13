import { MobileNav, Sidebar } from "@/components/app/nav";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const [{ count: review }, { count: unread }] = await Promise.all([
    supabase.from("drafts").select("id", { count: "exact", head: true }).eq("review_state", "pending_review"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const counts = { review: review ?? 0, unread: unread ?? 0 };
  return (
    <div className="min-h-dvh">
      <Sidebar counts={counts} email={user.email ?? ""} />
      <MobileNav counts={counts} email={user.email ?? ""} />
      <div className="lg:pl-[232px]">
        <main className="mx-auto w-full max-w-[1160px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}

