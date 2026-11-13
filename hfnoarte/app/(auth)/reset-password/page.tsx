import Link from "next/link";
import { AuthForm, AuthShell } from "@/components/app/auth-form";
import { requestReset } from "@/app/actions/auth";

export const metadata = { title: "Reset password" };

export default function Reset() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <AuthForm action={requestReset} submit="Send reset link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        footer={<Link href="/login">Back to sign in</Link>} />
    </AuthShell>
  );
}
