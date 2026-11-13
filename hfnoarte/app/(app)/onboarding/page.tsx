import { startBlank, startFromSeed } from "@/app/actions/profile";
import { Button, Card, PageHeader } from "@/components/ui";
import { NOARTE_SEED_PROFILE } from "@/lib/candidate/seed";

export const metadata = { title: "Get started" };

export default function Onboarding() {
  const s = NOARTE_SEED_PROFILE;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Get started" title="First, who are we hunting for?"
        description="hfNoArte only matches and writes from your real experience. Pick how to start — you can upload a resume and edit everything afterwards." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-5">
          <p className="eyebrow mb-2">Recommended</p>
          <h2 className="text-lg font-semibold tracking-tight">Start from Olayemi&apos;s profile</h2>
          <p className="mt-1.5 text-sm text-muted">The background you provided: {s.experiences.length} roles, {s.projects.length} projects ({s.projects.map((p) => p.name).join(", ")}) and {s.skills.length} skills. Nothing extra is added. Your resume will override it.</p>
          <form action={startFromSeed} className="mt-auto pt-5"><Button variant="primary" className="w-full">Use this profile</Button></form>
        </Card>
        <Card className="flex flex-col p-5">
          <h2 className="mt-6 text-lg font-semibold tracking-tight">Start blank</h2>
          <p className="mt-1.5 text-sm text-muted">Upload a resume (PDF or DOCX) on the next screen and review what&apos;s extracted, or fill in your profile by hand.</p>
          <form action={startBlank} className="mt-auto pt-5"><Button className="w-full">Start blank</Button></form>
        </Card>
      </div>
    </div>
  );
}
