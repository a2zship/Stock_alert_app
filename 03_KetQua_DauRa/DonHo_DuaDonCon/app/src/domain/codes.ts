// Mã đón một lần: token ngẫu nhiên (in vào QR) + PIN 6 số. DB chỉ giữ HMAC, không giữ mã gốc.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const newToken = () => randomBytes(24).toString("base64url");
export const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const newOtp = newPin;

export function hashCode(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
