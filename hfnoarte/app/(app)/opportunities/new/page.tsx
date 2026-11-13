import { AddByUrlForm } from "@/components/app/add-forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add opportunity" };

export default function NewOpportunity() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Add" title="Add an opportunity" description="Found something on X, LinkedIn, Instagram or a company site? Paste the link and hfNoArte will read the public page, extract the details and score it against your profile." />
      <AddByUrlForm />
    </div>
  );
}
