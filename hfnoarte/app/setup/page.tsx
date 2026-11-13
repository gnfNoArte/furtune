export const dynamic = "force-dynamic";

export const metadata = { title: "Setup needed" };

export default function Setup() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <p className="eyebrow mb-3">hfNoArte</p>
      <h1 className="text-[28px] font-semibold tracking-tight">{configured ? "Supabase is configured" : "Connect Supabase to start"}</h1>
      <p className="mt-3 text-muted">hfNoArte keeps your account, profile, opportunities and applications in Supabase (free tier). Without it there&apos;s nowhere private to store your data, so the app stays on this page.</p>
      <ol className="mt-8 list-decimal space-y-3 pl-5 text-[15px] text-muted marker:text-violet-bright">
        <li>Create a free project at <span className="text-fg">supabase.com</span>.</li>
        <li>Run the SQL files in <code className="text-fg">supabase/migrations</code> (in order) in the SQL editor.</li>
        <li>Copy <code className="text-fg">.env.example</code> to <code className="text-fg">.env.local</code> and fill in <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code className="text-fg">SUPABASE_SERVICE_ROLE_KEY</code>.</li>
        <li>Restart the app. Full steps are in the README.</li>
      </ol>
    </main>
  );
}
