import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { SetupForm } from "@/components/SetupForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { hasOrganisers } from "@/lib/organisers";
import { APP_NAME } from "@/lib/site";

export const metadata = { title: "Organiser login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const setup = !(await hasOrganisers());
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6 py-10">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-sm text-ink/50">
          {APP_NAME}
        </Link>
        <h1 className="mb-8 mt-1 text-center font-serif text-3xl">{setup ? "Create your account" : "Organiser login"}</h1>
        {setup ? <SetupForm /> : <LoginForm mode="admin" />}
        {!setup && (
          <p className="mt-6 text-center text-xs text-ink/50">Forgot your password? Password reset is coming soon.</p>
        )}
      </div>
    </main>
  );
}
