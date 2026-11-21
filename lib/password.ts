import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (e, k) => (e ? reject(e) : resolve(k))));

const N = 16384, R = 8, P = 1, LEN = 32;

/** "scrypt$N$r$p$salt$hash" (base64). Built into Node, so no extra package is needed. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

// Same work as a real check, so "no such username" and "wrong password" take the same time.
const DUMMY = hashPassword("not-a-real-password");
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY);
}
