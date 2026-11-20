import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUsherByToken } from "@/lib/ushers";

export const metadata = { title: "Usher login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UsherJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const usher = await getUsherByToken(token);

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6 py-10">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        {usher?.active ? (
          <>
            <p className="text-center text-sm text-ink/60">{usher.event_name} · Gate check-in</p>
            <h1 className="mt-1 text-center text-3xl font-bold">Hi, {usher.name}</h1>
            <p className="mb-8 mt-2 text-center text-ink/60">Enter the PIN the organiser gave you.</p>
            <LoginForm mode="usher" token={token} />
          </>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold">Link not active</h1>
            <p className="mt-3 text-center text-ink/70">
              This scanner link has been turned off or replaced. Ask the organiser to send you a new one.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
