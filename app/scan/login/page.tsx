import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Usher login", robots: { index: false } };

/** Ushers can only log in through the personal link the organiser sends them. */
export default function ScanLogin() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">Gate check-in</h1>
        <p className="mt-3 text-ink/70">
          Open the personal scanner link the organiser sent you on WhatsApp. If it stopped working, ask the organiser
          for a new one.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm text-ink/50 underline">
          Organiser? Log in here
        </Link>
      </div>
    </main>
  );
}
