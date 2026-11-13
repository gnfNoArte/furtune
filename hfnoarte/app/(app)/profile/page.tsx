import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/app/profile-editor";
import { Notice, PageHeader } from "@/components/ui";
import { candidateLevel } from "@/lib/candidate/clusters";
import { loadProfile } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const profile = await loadProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");
  const lvl = candidateLevel(profile);
  const estimate = lvl.years == null ? "not enough dates" : `${lvl.level} (≈${Math.floor(lvl.years)} years since your earliest listed role)`;
  return (
    <div>
      <PageHeader eyebrow="Profile" title="Your professional profile" description="Everything hfNoArte matches and writes comes from here. Correct anything that's wrong — nothing is inferred beyond what you list." />
      {sp.welcome && <Notice tone="butter" className="mb-6" title="You're set up">Upload your resume to make this exact, then set your preferences and run your first search.</Notice>}
      {profile.origin === "seed" && <Notice tone="info" className="mb-6">This profile was created from the background you provided. Uploading a resume lets you replace or merge it — the resume is the source of truth.</Notice>}
      <ProfileEditor initial={profile} estimate={estimate} />
    </div>
  );
}
