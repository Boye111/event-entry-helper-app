import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Admin", robots: { index: false } };

/** Super admin login: ADMIN_PASSWORD only. Not linked from anywhere on the site. */
export default function SuperLogin() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-ivory px-6 py-10">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center font-serif text-3xl">Admin</h1>
        <LoginForm mode="super" />
      </div>
    </main>
  );
}
