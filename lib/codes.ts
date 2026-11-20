import { customAlphabet } from "nanoid";

// URL-safe, no look-alikes (0/O, 1/l/I, etc.). 31 chars ^ 11 ≈ 2.5e16 combinations.
export const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const CODE_LENGTH = 11;

export const newGuestCode = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function isValidCodeShape(code: string): boolean {
  return CODE_RE.test(code);
}

/** Accepts a bare code or any URL ending in /invite/<code>; returns the code or null. */
export function extractCode(raw: string): string | null {
  const text = raw.trim();
  const m = text.match(/\/invite\/([^/?#\s]+)/);
  const candidate = (m ? m[1] : text).toLowerCase();
  return isValidCodeShape(candidate) ? candidate : null;
}
