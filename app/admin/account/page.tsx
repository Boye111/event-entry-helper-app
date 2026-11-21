import { redirect } from "next/navigation";
import { AccountForm } from "@/components/admin/AccountForm";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getActiveSession } from "@/lib/auth";
import { getOrganiser } from "@/lib/organisers";

export const metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getActiveSession();
  const org = session?.organiserId ? await getOrganiser(session.organiserId) : null;
  if (!org) redirect("/admin/login");
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader />
      <main className="mx-auto max-w-md space-y-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">Your account</h1>
          <p className="mt-1 text-sm text-ink/60">
            Logged in as <b>{org.username}</b>
          </p>
        </div>
        <AccountForm email={org.email} />
      </main>
    </div>
  );
}
