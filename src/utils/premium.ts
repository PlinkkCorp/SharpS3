import { verifySignature } from "./signature";
import crypto from "crypto";
import("dotenv/config")

export function isPremiumRequest(req: any): boolean {
  const sig = req.query.sig;
  const cleanPath = req.url.split("?")[0];

  return verifySignature(cleanPath, sig);
}

const SECRET = process.env.SIGN_SECRET!;

export function generatePremiumUrl(
  baseUrl: string,
  ttlSec = 60
): string {
  const ts = Date.now();
  const hash = crypto
    .createHmac("sha256", SECRET)
    .update(`${baseUrl}.${ts}`)
    .digest("hex")
    .slice(0, 16);

  return `${baseUrl}?sig=${hash}.${ts}`;
}
