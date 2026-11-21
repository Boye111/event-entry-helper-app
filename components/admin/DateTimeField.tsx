"use client";

import { input } from "./styles";

/** 00:00 … 23:45 in 15-minute steps, shown as "2:30 PM". */
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const label = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

const DEFAULT_TIME = "12:00";

/**
 * Date + time as two simple fields instead of <input type="datetime-local">, whose combined picker stays
 * open after choosing a date (Chrome) until you tap elsewhere. The date picker closes as soon as a day is
 * picked; the time is a plain dropdown. Value is "YYYY-MM-DDTHH:mm" (or "" for no date), like datetime-local.
 */
export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [date, time] = value ? value.split("T") : ["", ""];
  const times = time && !TIMES.some((t) => t.value === time) ? [{ value: time, label: time }, ...TIMES] : TIMES;

  return (
    <div className="mt-1 flex gap-2">
      <input
        className={`${input} min-w-0 flex-[3]`}
        type="date"
        aria-label="Date"
        value={date}
        onChange={(e) => {
          const d = e.target.value;
          onChange(d ? `${d}T${time || DEFAULT_TIME}` : "");
          e.target.blur(); // closes the calendar straight away on desktop browsers
        }}
      />
      <select
        className={`${input} min-w-0 flex-[2]`}
        aria-label="Time"
        value={date ? time || DEFAULT_TIME : ""}
        disabled={!date}
        onChange={(e) => onChange(`${date}T${e.target.value}`)}
      >
        {!date && <option value="">Time</option>}
        {times.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
