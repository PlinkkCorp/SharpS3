import crypto from "crypto";
import("dotenv/config")

const SECRET = process.env.SIGN_SECRET!;

export function verifySignature(
  path: string,
  sig?: string,
  maxAgeSec = 60
): boolean {
  if (!sig) return false;

  const [hash, ts] = sig.split(".");
  if (!hash || !ts) return false;

  const age = Math.abs(Date.now() - Number(ts));
  if (age > maxAgeSec * 1000) return false;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${path}.${ts}`)
    .digest("hex")
    .slice(0, 16);

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expected)
  );
}