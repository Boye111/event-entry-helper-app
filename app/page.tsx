import Link from "next/link";
import { Ornament } from "@/components/Ornament";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/site";

export const metadata = {
  title: { absolute: `${APP_NAME}: QR invitations & gate check-in` },
  description: "Personal QR invitations on WhatsApp and one-scan-only entry at the gate for weddings and events.",
};

const steps = [
  ["Create your event", "Wedding, birthday, burial, conference… add the date, venue, dress code and a photo."],
  ["Add your guests", "One by one or upload an Excel / CSV list with names, phone numbers and emails."],
  ["Send personal invites", "Each guest gets their own link and QR code by WhatsApp or email, with a nice preview."],
  ["Scan at the gate", "Ushers scan with their phones. The first scan admits; a copied or reused QR is rejected."],
];

const features = [
  ["One scan only", "Checked in once, never twice, even with several gates scanning at the same moment."],
  ["Ushers you control", "Each usher gets a private link + PIN. Turn one off and their phone stops instantly."],
  ["Live headcount", "See who has arrived, how many seats are filled and which usher admitted each guest."],
  ["Works on any phone", "No app to install. Android, iPhone, tablet or laptop, in light or dark mode."],
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="mr-auto font-serif text-xl">{APP_NAME}</span>
        <ThemeToggle />
        <Link href="/login" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-on-ink">
          Organiser login
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center sm:pt-16">
          <p className="text-xs uppercase tracking-[0.3em] text-sage">Weddings · Parties · Events</p>
          <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-6xl">
            No invite, no entry. <span className="italic text-gold">No gate-crashers.</span>
          </h1>
          <Ornament className="my-8" />
          <p className="mx-auto max-w-xl text-lg text-ink/70">
            Send every guest a personal QR invitation on WhatsApp. At the gate, your ushers scan it with their phones, and
            each QR works exactly once.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="rounded-xl bg-ink px-6 py-3.5 font-semibold text-on-ink">
              Organiser login
            </Link>
            <a href="#how" className="rounded-xl px-6 py-3.5 font-medium ring-1 ring-ink/15 hover:bg-ink/5">
              How it works
            </a>
          </div>
          <p className="mt-4 text-sm text-ink/50">Got an invite link? Open it to create your organiser account.</p>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="text-center font-serif text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, text], i) => (
              <li key={title} className="rounded-2xl bg-surface p-5 ring-1 ring-ink/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush font-serif text-lg text-gold">
                  {i + 1}
                </span>
                <p className="mt-4 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink/65">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {features.map(([title, text]) => (
              <div key={title} className="border-l-2 border-gold/50 pl-4">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-ink/65">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-center text-sm text-ink/45">
        {APP_NAME} · Guests: open the personal link you were sent to see your invitation.
      </footer>
    </div>
  );
}
