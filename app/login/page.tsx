import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME, safeNext } from "@/lib/site";

export const metadata = { title: "Organiser login", robots: { index: false } };

/** Organisers and helpers log in here with username + password. */
export default async function OrganiserLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6 py-10">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-sm text-ink/50">
          {APP_NAME}
        </Link>
        <h1 className="mb-8 mt-1 text-center font-serif text-3xl">Organiser login</h1>
        <LoginForm mode="organiser" next={next} />
        <p className="mt-6 text-center text-xs text-ink/50">
          New here? Open the invite link you were sent. Forgot your password? Ask whoever invited you to reset it.
        </p>
      </div>
    </main>
  );
}
