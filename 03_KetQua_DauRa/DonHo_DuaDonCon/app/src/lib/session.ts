// Phiên đăng nhập: cookie "userId.exp.chữ-ký", ký HMAC-SHA256 bằng APP_SECRET.
// Chỉ dùng Web Crypto → chạy được cả trong middleware (edge) lẫn server Node.

export const SESSION_COOKIE = "dh_session";

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let s = "";
  for (const b of sig) s += b.toString(16).padStart(2, "0");
  return s;
}

/** So sánh thời gian hằng để không lộ chữ ký qua thời gian phản hồi */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(secret: string, userId: string, expiresAtMs: number): Promise<string> {
  const exp = String(Math.floor(expiresAtMs));
  return `${userId}.${exp}.${await hmac(secret, `v1.${userId}.${exp}`)}`;
}

/** Trả về userId nếu phiên hợp lệ, ngược lại null */
export async function readSession(secret: string | undefined, token: string | undefined, nowMs = Date.now()): Promise<string | null> {
  if (!secret || secret.length < 32 || !token) return null;
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig || !/^\d+$/.test(exp) || !/^[a-z0-9]+$/.test(userId)) return null;
  if (Number(exp) <= nowMs) return null;
  return safeEqual(sig, await hmac(secret, `v1.${userId}.${exp}`)) ? userId : null;
}

export function sessionDays(): number {
  const n = Number(process.env.SESSION_DAYS ?? 14);
  return Number.isFinite(n) && n > 0 && n <= 90 ? n : 14;
}
