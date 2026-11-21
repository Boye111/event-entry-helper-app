import Link from "next/link";
import { JoinEventButton } from "@/components/JoinEventButton";
import { SignupForm } from "@/components/SignupForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getActiveSession } from "@/lib/auth";
import { inviteInfo } from "@/lib/invites";
import { APP_NAME } from "@/lib/site";

export const metadata = { title: "Join", robots: { index: false } };
export const dynamic = "force-dynamic";

const closed: Record<string, string> = {
  used: "This invite link has already been used.",
  expired: "This invite link has expired.",
  revoked: "This invite link was cancelled.",
};

/**
 * Invite links from the super admin (become an organiser) or from an organiser (help with one event).
 * Someone already logged in can accept a helper invite with one tap.
 */
export default async function SignupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await inviteInfo(token);
  const helper = !!invite?.event_name;
  const session = await getActiveSession();
  const loggedIn = session?.role === "organiser" ? session.name : null;

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6 py-10">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-sm text-ink/50">
          {APP_NAME}
        </Link>
        <h1 className="mb-6 mt-1 text-center font-serif text-3xl">{helper ? "Join the team" : "Create your account"}</h1>

        {invite?.status !== "open" ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg bg-amber-100 px-4 py-3 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              {invite ? closed[invite.status] : "This invite link isn't valid."}
            </p>
            <p className="text-sm text-ink/60">
              Already have an account?{" "}
              <Link href="/login" className="font-medium underline">
                Log in
              </Link>
              . Otherwise ask for a new invite link.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-5 rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink/70">
              {helper ? (
                <>
                  {invite.invited_by ? <b>{invite.invited_by}</b> : "The organiser"} invited you to help run{" "}
                  <b>{invite.event_name}</b>: guests, ushers and the gate scanner.
                </>
              ) : (
                <>You&apos;ve been invited to run your events here. You&apos;ll log in with your username and password.</>
              )}
            </p>
            {helper && loggedIn ? (
              <JoinEventButton token={token} username={loggedIn} />
            ) : (
              <>
                <SignupForm token={token} />
                {helper && (
                  <p className="mt-6 text-center text-sm text-ink/60">
                    Already have an account?{" "}
                    <Link href={`/login?next=/signup/${token}`} className="font-medium underline">
                      Log in to join
                    </Link>
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
