import Link from "next/link";
import { AuthForm, AuthShell } from "@/components/app/auth-form";
import { signIn } from "@/app/actions/auth";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your hunt.">
      {sp.error && <p className="mb-4 text-sm text-danger">That link has expired or is invalid. Please try again.</p>}
      <AuthForm action={signIn} submit="Sign in" hidden={{ next: sp.next ?? "/" }}
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]}
        footer={<><Link href="/reset-password">Forgot password?</Link><span className="mx-2 text-faint">·</span><Link href="/signup">Create an account</Link></>} />
    </AuthShell>
  );
}
