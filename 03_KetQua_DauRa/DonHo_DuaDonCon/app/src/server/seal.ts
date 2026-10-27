// Niêm phong mã đón (token + PIN) để người đón xem lại được trên điện thoại của mình.
// Tra cứu tại cổng dùng bản băm (tokenHash/pinHash); bản niêm phong chỉ để hiển thị lại cho đúng người đón.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = (secret: string) => createHash("sha256").update(`seal:${secret}`).digest();

export function seal(secret: string, data: object): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(secret: string, sealed: string): T | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(secret), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
