import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/site";

export const metadata = { title: "Organiser login", robots: { index: false } };

export default function AdminLogin() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-sm text-ink/50">
          {APP_NAME}
        </Link>
        <h1 className="mb-8 mt-1 text-center font-serif text-3xl">Organiser login</h1>
        <LoginForm mode="admin" />
      </div>
    </main>
  );
}
