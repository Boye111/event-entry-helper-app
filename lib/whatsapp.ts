/** Normalise Nigerian numbers for wa.me: 08012345678 -> 2348012345678. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s\-()+]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

export function whatsappLink(phone: string | null, message: string): string {
  const p = normalisePhone(phone);
  const text = encodeURIComponent(message);
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Opens the organiser's own email app with the invite ready to send (no email service needed). */
export function emailLink(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function inviteMessage(opts: { name: string; event: string; link: string; seats: number }) {
  const admits = opts.seats > 1 ? ` This invite admits ${opts.seats} people.` : "";
  return (
    `Hello ${opts.name}! 💌\n\n` +
    `You're invited to ${opts.event}.${admits}\n\n` +
    `Your personal invite & entry QR code:\n${opts.link}\n\n` +
    `Please show the QR code at the gate. Don't share it — it can only be used once.`
  );
}

export function usherMessage(opts: { name: string; event: string; link: string; pin: string }) {
  return (
    `Hi ${opts.name}! Thank you for being an usher at ${opts.event}. 🙏\n\n` +
    `On the day, open your scanner link on your phone:\n${opts.link}\n\n` +
    `Your PIN: ${opts.pin}\n\n` +
    `Allow camera access when asked. This link is only for you, so please don't forward it.`
  );
}
