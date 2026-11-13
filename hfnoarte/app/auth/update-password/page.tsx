import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/app/auth-form";
import { updatePassword } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };

export default async function UpdatePassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=expired");
  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      <AuthForm action={updatePassword} submit="Save password" fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password" }]} />
    </AuthShell>
  );
}
