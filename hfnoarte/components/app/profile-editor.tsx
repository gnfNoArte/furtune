"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveProfile, uploadResume, type UploadResult } from "@/app/actions/profile";
import { Badge, Button, Card, Field, Notice, SectionTitle } from "../ui";
import { IconUpload, IconX } from "../icons";
import type { CandidateProfile, Experience, Project } from "@/lib/types";

const EXP_KINDS: Experience["kind"][] = ["employment", "freelance", "contract", "project"];
const PROJ_KINDS: Project["kind"][] = ["client", "personal", "exploration", "employment"];
const PROJ_LABEL: Record<Project["kind"], string> = { client: "Client work", personal: "Personal project", exploration: "Independent exploration", employment: "Done in a job" };
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function ProfileEditor({ initial, estimate }: { initial: CandidateProfile; estimate: string }) {
  const [p, setP] = useState<CandidateProfile>(initial);
  const [version, setVersion] = useState(0); // remounts uncontrolled fields after a resume import
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "violet" | "danger"; text: string } | null>(null);
  const dirty = JSON.stringify(p) !== saved;
  const set = <K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const categories = useMemo(() => [...new Set(p.skills.map((s) => s.category || "Skills"))], [p.skills]);

  const save = (next = p, origin: "manual" | "resume" = "manual") => start(async () => {
    const r = await saveProfile(next, origin);
    if (r.error) setMsg({ tone: "danger", text: r.error });
    else { setSaved(JSON.stringify(next)); setMsg({ tone: "violet", text: "Profile saved. New searches and drafts use it straight away." }); }
  });

  return (
    <div className="space-y-8">
      <ResumeUpload onApply={(ex, mode) => {
        const next: CandidateProfile = mode === "replace"
          ? { ...ex, portfolio_url: p.portfolio_url ?? ex.portfolio_url, writing_style: p.writing_style }
          : {
            ...p,
            headline: p.headline || ex.headline, summary: p.summary || ex.summary, full_name: p.full_name || ex.full_name,
            skills: [...p.skills, ...ex.skills.filter((s) => !p.skills.some((x) => x.name.toLowerCase() === s.name.toLowerCase()))],
            experiences: [...p.experiences, ...ex.experiences.filter((e) => !p.experiences.some((x) => x.title.toLowerCase() === e.title.toLowerCase() && x.organization.toLowerCase() === e.organization.toLowerCase()))],
            projects: [...p.projects, ...ex.projects.filter((e) => !p.projects.some((x) => x.name.toLowerCase() === e.name.toLowerCase()))],
            education: [...p.education, ...ex.education],
            suggested_titles: [...new Set([...p.suggested_titles, ...ex.suggested_titles])],
          };
        setP(next);
        setVersion((v) => v + 1);
        setMsg({ tone: "violet", text: "Resume details applied below — review them, then press Save profile." });
      }} />

      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <p className="text-sm text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</p>
        <Button className="ml-auto" variant="primary" disabled={!dirty || pending} onClick={() => save()}>{pending ? "Saving…" : "Save profile"}</Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <section>
        <SectionTitle>Basics</SectionTitle>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name"><input id="name" className="field" value={p.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Portfolio link" htmlFor="pf" hint="Used in drafts when present."><input id="pf" className="field" value={p.portfolio_url ?? ""} onChange={(e) => set("portfolio_url", e.target.value)} placeholder="https://" /></Field>
          <div className="sm:col-span-2"><Field label="Headline" htmlFor="hl"><input id="hl" className="field" value={p.headline ?? ""} onChange={(e) => set("headline", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Summary" htmlFor="sum"><textarea id="sum" rows={3} className="field" value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></Field></div>
          <Field label="Experience level" htmlFor="lvl" hint={`Estimated from your dates: ${estimate}. Set it to override.`}>
            <select id="lvl" className="field" value={p.experience_level ?? ""} onChange={(e) => set("experience_level", e.target.value || null)}>
              <option value="">Use estimate</option><option value="junior">Junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option>
            </select>
          </Field>
          <Field label="How you like to sound" htmlFor="ws" hint="Optional — guides AI drafts (e.g. “warm, direct, no buzzwords”)."><input id="ws" className="field" value={p.writing_style ?? ""} onChange={(e) => set("writing_style", e.target.value)} /></Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Skills</SectionTitle>
        <Card className="space-y-5 p-5">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="eyebrow mb-2">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s, i) => (s.category || "Skills") === cat && (
                  <span key={`${s.name}-${i}`} title={s.evidence ? `Evidence: ${s.evidence}` : undefined} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-[13px]">
                    {s.name}
                    <button aria-label={`Remove ${s.name}`} className="grid size-5 place-items-center rounded-full text-faint hover:bg-surface-3 hover:text-fg" onClick={() => set("skills", p.skills.filter((_, j) => j !== i))}><IconX width={12} height={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get("skill")).trim();
            if (!name) return;
            set("skills", [...p.skills, { name, category: String(f.get("cat")).trim() || "Skills", evidence: String(f.get("ev")).trim() || undefined }]);
            e.currentTarget.reset();
          }}>
            <input name="skill" placeholder="Add a skill you've actually used" className="field" aria-label="Skill" />
            <input name="cat" list="cats" placeholder="Category" className="field sm:max-w-48" aria-label="Category" />
            <input name="ev" placeholder="Evidence (project/role)" className="field sm:max-w-56" aria-label="Evidence" />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <Button type="submit">Add</Button>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => set("experiences", [...p.experiences, { title: "", organization: "", kind: "employment", start: "", end: null }])}>+ Add role</Button>}>Experience</SectionTitle>
        <div className="space-y-3">
          {p.experiences.map((e, i) => {
            const up = (patch: Partial<Experience>) => set("experiences", p.experiences.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <Card key={`${version}-${i}`} className="grid gap-3 p-4 sm:grid-cols-6">
                <div className="sm:col-span-3"><Field label="Title"><input className="field" value={e.title} onChange={(ev) => up({ title: ev.target.value })} /></Field></div>
                <div className="sm:col-span-2"><Field label="Organisation"><input className="field" value={e.organization} onChange={(ev) => up({ organization: ev.target.value })} /></Field></div>
                <div><Field label="Kind"><select className="field" value={e.kind} onChange={(ev) => up({ kind: ev.target.value as Experience["kind"] })}>{EXP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field></div>
                <div className="sm:col-span-2"><Field label="Start (YYYY-MM)"><input className="field" value={e.start ?? ""} onChange={(ev) => up({ start: ev.target.value })} placeholder="2022-03" /></Field></div>
                <div className="sm:col-span-2"><Field label="End (blank = present)"><input className="field" value={e.end ?? ""} onChange={(ev) => up({ end: ev.target.value || null })} placeholder="present" /></Field></div>
                <div className="flex items-end justify-end sm:col-span-2"><Button size="sm" variant="ghost" onClick={() => set("experiences", p.experiences.filter((_, j) => j !== i))}>Remove</Button></div>
                <div className="sm:col-span-6"><Field label="Description"><textarea rows={2} className="field" value={e.description ?? ""} onChange={(ev) => up({ description: ev.target.value })} /></Field></div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => set("projects", [...p.projects, { name: "", kind: "client", roles: [], skills: [] }])}>+ Add project</Button>}>Projects</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {p.projects.map((pr, i) => {
            const up = (patch: Partial<Project>) => set("projects", p.projects.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <Card key={`${version}-${i}`} className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <input aria-label="Project name" className="field font-medium" value={pr.name} onChange={(e) => up({ name: e.target.value })} placeholder="Project name" />
                  <Button size="sm" variant="ghost" onClick={() => set("projects", p.projects.filter((_, j) => j !== i))}>Remove</Button>
                </div>
                <Field label="Kind"><select className="field" value={pr.kind} onChange={(e) => up({ kind: e.target.value as Project["kind"] })}>{PROJ_KINDS.map((k) => <option key={k} value={k}>{PROJ_LABEL[k]}</option>)}</select></Field>
                <Field label="Your roles (comma-separated)"><input className="field" defaultValue={pr.roles.join(", ")} onBlur={(e) => up({ roles: splitList(e.target.value) })} /></Field>
                <Field label="Skills shown (comma-separated)"><input className="field" defaultValue={pr.skills.join(", ")} onBlur={(e) => up({ skills: splitList(e.target.value) })} /></Field>
                <Field label="Link"><input className="field" value={pr.url ?? ""} onChange={(e) => up({ url: e.target.value })} placeholder="https://" /></Field>
                <Field label="Description"><textarea rows={2} className="field" value={pr.description ?? ""} onChange={(e) => up({ description: e.target.value })} /></Field>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => set("education", [...p.education, { institution: "", qualification: "" }])}>+ Add</Button>}>Education &amp; qualifications</SectionTitle>
        {p.education.length === 0 && <p className="text-sm text-muted">None listed. Only add qualifications you actually hold.</p>}
        <div className="space-y-3">
          {p.education.map((ed, i) => (
            <Card key={i} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
              <input aria-label="Institution" className="field" value={ed.institution} placeholder="Institution" onChange={(e) => set("education", p.education.map((x, j) => (j === i ? { ...x, institution: e.target.value } : x)))} />
              <input aria-label="Qualification" className="field" value={ed.qualification} placeholder="Qualification" onChange={(e) => set("education", p.education.map((x, j) => (j === i ? { ...x, qualification: e.target.value } : x)))} />
              <Button variant="ghost" onClick={() => set("education", p.education.filter((_, j) => j !== i))}>Remove</Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Suggested job titles</SectionTitle>
        <Card className="p-5">
          <p className="mb-3 text-sm text-muted">Searches use these plus related titles (e.g. Webflow Developer → Web Designer, No-Code Developer, Digital Experience Designer).</p>
          <textarea key={version} rows={3} className="field" aria-label="Suggested titles" defaultValue={p.suggested_titles.join(", ")} onBlur={(e) => set("suggested_titles", splitList(e.target.value))} />
        </Card>
      </section>
    </div>
  );
}

function ResumeUpload({ onApply }: { onApply: (p: CandidateProfile, mode: "replace" | "merge") => void }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<UploadResult | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <section id="resume">
      <SectionTitle>Resume</SectionTitle>
      <Card className="p-5">
        <form ref={ref} className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => setRes(await uploadResume(f)));
        }}>
          <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required aria-label="Resume file"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-line" />
          <Button type="submit" variant="primary" disabled={pending}><IconUpload width={16} height={16} /> {pending ? "Reading resume…" : "Upload & extract"}</Button>
        </form>
        <p className="mt-2 text-xs text-faint">PDF or DOCX, up to 8 MB. Stored privately in your account. Your resume is the source of truth — anything that can&apos;t be traced to its text is dropped.</p>
        {res?.error && <Notice tone="warn" className="mt-4">{res.error}</Notice>}
        {res?.extraction && (
          <div className="mt-5 space-y-4 border-t border-line pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Extracted from your resume</p>
              <Badge tone={res.extraction.mode === "ai" ? "violet" : "neutral"}>{res.extraction.mode === "ai" ? "AI extraction" : "Keyword extraction (fallback)"}</Badge>
            </div>
            {res.extraction.warnings.map((w) => <p key={w} className="text-[13px] text-stretch">{w}</p>)}
            <div className="grid gap-4 text-[13px] sm:grid-cols-3">
              <div><p className="eyebrow mb-1.5">Skills ({res.extraction.profile.skills.length})</p><p className="text-muted">{res.extraction.profile.skills.map((s) => s.name).join(", ") || "—"}</p></div>
              <div><p className="eyebrow mb-1.5">Roles ({res.extraction.profile.experiences.length})</p>{res.extraction.profile.experiences.map((e, i) => <p key={i} className="text-muted">{e.title}{e.organization ? ` — ${e.organization}` : ""} ({e.start ?? "?"}–{e.end ?? "present"})</p>)}</div>
              <div><p className="eyebrow mb-1.5">Projects ({res.extraction.profile.projects.length})</p><p className="text-muted">{res.extraction.profile.projects.map((x) => x.name).join(", ") || "—"}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onApply(res.extraction!.profile, "replace")}>Replace profile with this</Button>
              <Button onClick={() => onApply(res.extraction!.profile, "merge")}>Merge into current profile</Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
