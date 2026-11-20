"use client";

import Papa from "papaparse";
import { useState } from "react";
import { errorBox, primaryBtn } from "./styles";

type Row = { name: string; phone: string; email: string; seats: string; side: string; table_no: string };

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Excel stores 08031234567 as the number 8031234567: put the leading 0 back for Nigerian mobiles. */
function phoneCell(v: unknown): string {
  if (typeof v === "number") {
    const s = String(Math.round(v));
    return /^[789]\d{9}$/.test(s) ? "0" + s : s;
  }
  return String(v ?? "").trim();
}

function toRows(records: Record<string, unknown>[]): Row[] {
  return records.map((r) => ({
    name: String(r.name ?? r.full_name ?? r.guest ?? "").trim(),
    phone: phoneCell(r.phone ?? r.phone_number ?? r.whatsapp ?? r.mobile),
    email: String(r.email ?? r.email_address ?? r.e_mail ?? "").trim(),
    seats: String(r.seats ?? r.people ?? r.admits ?? "").trim() || "1",
    side: String(r.side ?? r.group ?? "").trim().toLowerCase(),
    table_no: String(r.table_no ?? r.table ?? "").trim(),
  }));
}

function check(rows: Row[], headers: string[]): string[] {
  const problems = rows.flatMap((r, i) =>
    !r.name
      ? [`Row ${i + 2}: name is missing`]
      : !/^\d+$/.test(r.seats) || +r.seats < 1 || +r.seats > 20
        ? [`Row ${i + 2}: seats must be 1-20`]
        : r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
          ? [`Row ${i + 2}: email "${r.email}" doesn't look right`]
          : [],
  );
  if (!headers.some((h) => ["name", "full_name", "guest"].includes(h))) problems.unshift("The file needs a 'name' column.");
  return problems;
}

export function GuestImport({ eventId, onImported }: { eventId: number; onImported: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function show(records: Record<string, unknown>[], headers: string[]) {
    const parsed = toRows(records);
    setErrors(check(parsed, headers));
    setRows(parsed);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setMessage(null);
    setErrors([]);
    setRows(null);
    if (!file) return;

    if (/\.xlsx$/i.test(file.name)) {
      try {
        const { readSheet } = await import("read-excel-file/browser");
        const data = await readSheet(file);
        const [head = [], ...body] = data;
        const headers = head.map((h) => norm(String(h ?? "")));
        const records = body
          .filter((r) => r.some((c) => c !== null && String(c).trim() !== ""))
          .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
        show(records, headers);
      } catch {
        setErrors(["Could not read that Excel file. Save it as .xlsx (or CSV) and try again."]);
      }
      return;
    }
    if (/\.xls$/i.test(file.name)) {
      setErrors(["Old .xls files aren't supported. In Excel choose File → Save As → .xlsx or CSV."]);
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: norm,
      complete: (res) => show(res.data, res.meta.fields ?? []),
      error: () => setErrors(["Could not read that file."]),
    });
  }

  async function save() {
    if (!rows) return;
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErrors(data?.errors ?? [data?.error ?? "Import failed."]);
      return;
    }
    setMessage(`Imported ${data.imported} guests.`);
    setRows(null);
    onImported();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">
        Upload an <b>Excel (.xlsx)</b> or <b>CSV</b> file with a header row. Columns:{" "}
        <code className="rounded bg-ink/5 px-1">name, phone, email, seats, side, table_no</code>. Only{" "}
        <b>name</b> is required.
      </p>
      <input
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onFile}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:font-semibold file:text-on-ink"
      />
      {message && <p className="font-medium text-green-700 dark:text-green-400">{message}</p>}
      {errors.length > 0 && (
        <ul className={errorBox}>
          {errors.slice(0, 10).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {errors.length > 10 && <li>…and {errors.length - 10} more</li>}
        </ul>
      )}
      {rows && (
        <>
          <p className="text-sm font-medium">Preview: {rows.length} guests</p>
          <div className="max-h-72 overflow-auto rounded-lg ring-1 ring-ink/10">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-ivory text-left">
                <tr>
                  {["Name", "Phone", "Email", "Seats", "Side", "Table"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-ink/5">
                    <td className="px-3 py-1.5">{r.name || <span className="text-red-600">missing</span>}</td>
                    <td className="px-3 py-1.5">{r.phone}</td>
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className="px-3 py-1.5">{r.seats}</td>
                    <td className="px-3 py-1.5">{r.side}</td>
                    <td className="px-3 py-1.5">{r.table_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={busy || errors.length > 0} className={primaryBtn}>
              {busy ? "Importing…" : `Import ${rows.length} guests`}
            </button>
            <button onClick={() => setRows(null)} className="rounded-lg px-4 py-2.5 hover:bg-ink/5">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
