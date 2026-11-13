import Link from "next/link";
import { AuthForm, AuthShell } from "@/components/app/auth-form";
import { signUp } from "@/app/actions/auth";

export const metadata = { title: "Create account" };

export default function Signup() {
  return (
    <AuthShell title="Create your account" subtitle="Your profile, opportunities and applications stay private to you.">
      <AuthForm action={signUp} submit="Create account"
        fields={[
          { name: "name", label: "Name", autoComplete: "name", required: false },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password (8+ characters)", type: "password", autoComplete: "new-password" },
        ]}
        footer={<>Already have an account? <Link href="/login">Sign in</Link></>} />
    </AuthShell>
  );
}
