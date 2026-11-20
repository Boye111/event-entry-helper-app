import type { Stats } from "@/lib/types";

export function StatsBar({ stats }: { stats: Stats | null }) {
  const s = stats ?? { guests: 0, seats: 0, arrived_guests: 0, arrived_seats: 0 };
  const pct = s.seats ? Math.round((s.arrived_seats / s.seats) * 100) : 0;
  const card = (label: string, value: React.ReactNode, sub?: string) => (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-ink/10">
      <p className="text-xs uppercase tracking-wider text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{stats ? value : "…"}</p>
      {sub && <p className="text-sm text-ink/60 tabular-nums">{sub}</p>}
    </div>
  );
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Invites", s.guests, `${s.seats} people`)}
        {card("Arrived", s.arrived_guests, `${s.arrived_seats} people`)}
        {card("Remaining", s.guests - s.arrived_guests, `${s.seats - s.arrived_seats} people`)}
        {card("Attendance", `${pct}%`, "of people")}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full bg-sage transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
