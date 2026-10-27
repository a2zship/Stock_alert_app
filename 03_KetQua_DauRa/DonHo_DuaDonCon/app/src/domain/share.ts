// Giới thiệu bạn bè + chia sẻ doanh thu với nhà trường và giáo viên. Hàm thuần.
// Chỉ chia trên TIỀN MẶT nền tảng thực thu: phí nền tảng người đón nộp và phí thành viên (phần trả bằng tín dụng không chia).
// Phần của cô tính trên doanh thu cả lớp trong tháng — KHÔNG theo số lượt cô duyệt hay từ chối.
import { vnToday } from "./time";

/** Người giới thiệu nhận 20% doanh thu từ người được giới thiệu trong 12 tháng, dạng tín dụng trừ phí. [GIẢ ĐỊNH] */
export const REF_RATE = 0.2;
export const REF_MONTHS = 12;
/** Quên nhập mã lúc đăng ký: được nhập bổ sung trong 7 ngày đầu. */
export const REF_CLAIM_DAYS = 7;
/** Tín dụng dùng được sau 7 ngày (để nền tảng đối soát khoản tiền tạo ra nó). [GIẢ ĐỊNH] */
export const CREDIT_HOLD_DAYS = 7;
/** Nhà trường 10%, giáo viên lớp 5% doanh thu phát sinh ở lớp. [GIẢ ĐỊNH] */
export const SCHOOL_RATE = 0.1;
export const TEACHER_RATE = 0.05;
/** Phần của trường/cô tháng M được chuyển sau ngày 7 tháng M+1 (đối soát xong). */
export const PAYOUT_AFTER_DAYS = 7;

export const SHARE_LABEL = { GIOI_THIEU: "Giới thiệu", TRUONG: "Nhà trường", GIAO_VIEN: "Giáo viên" } as const;
export const SOURCE_LABEL = { THANH_VIEN: "Phí thành viên", PHI_NEN_TANG: "Phí nền tảng" } as const;

/** Một phần doanh thu gắn với một lớp. */
export type SharePart = { base: number; classId: string; schoolId: string; teacherIds: string[]; teacherShare: boolean };
export type ShareLine = { kind: "GIOI_THIEU" | "TRUONG" | "GIAO_VIEN"; userId: string | null; schoolId: string | null; classId: string | null; base: number; rate: number; amount: number };

/** Chia một khoản tiền mặt cho người giới thiệu (nếu còn hiệu lực), trường, giáo viên từng lớp. */
export function splitShares(parts: SharePart[], referrerId: string | null): ShareLine[] {
  const out: ShareLine[] = [];
  const total = parts.reduce((s, p) => s + p.base, 0);
  if (total <= 0) return out;
  if (referrerId) out.push({ kind: "GIOI_THIEU", userId: referrerId, schoolId: null, classId: null, base: total, rate: REF_RATE, amount: Math.round(total * REF_RATE) });
  for (const p of parts) {
    if (p.base <= 0) continue;
    const teacherPool = Math.round(p.base * TEACHER_RATE);
    const toTeachers = p.teacherShare && p.teacherIds.length > 0;
    // trường tắt phần của cô, hoặc lớp chưa có cô → phần đó gộp về trường
    const school = Math.round(p.base * SCHOOL_RATE) + (toTeachers ? 0 : teacherPool);
    out.push({ kind: "TRUONG", userId: null, schoolId: p.schoolId, classId: p.classId, base: p.base, rate: toTeachers ? SCHOOL_RATE : SCHOOL_RATE + TEACHER_RATE, amount: school });
    if (toTeachers) {
      const each = Math.floor(teacherPool / p.teacherIds.length);
      p.teacherIds.forEach((t, i) => out.push({
        kind: "GIAO_VIEN", userId: t, schoolId: p.schoolId, classId: p.classId, base: p.base, rate: TEACHER_RATE / p.teacherIds.length,
        amount: each + (i === 0 ? teacherPool - each * p.teacherIds.length : 0),
      }));
    }
  }
  return out.filter((l) => l.amount > 0);
}

/** Chia đều một khoản cho nhiều lớp (phụ huynh có con ở nhiều lớp); phần lẻ vào lớp đầu. */
export function evenSplit(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor(amount / n);
  return Array.from({ length: n }, (_, i) => each + (i === 0 ? amount - each * n : 0));
}

/** Chia tiền mặt theo tỉ lệ các khoản phí (phần đã trừ tín dụng không chia). Tổng đúng bằng `cash`. */
export function proRata(items: number[], cash: number): number[] {
  const total = items.reduce((s, x) => s + x, 0);
  if (total <= 0 || cash <= 0) return items.map(() => 0);
  const out = items.map((x) => Math.floor((x * cash) / total));
  out[0] += cash - out.reduce((s, x) => s + x, 0);
  return out;
}

const addMonthsUtc = (d: Date, m: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + m); return x; };

/** Người được giới thiệu còn trong 12 tháng tính thưởng không. */
export const refActive = (referredAt: Date | null, now: Date) => !!referredAt && now < addMonthsUtc(referredAt, REF_MONTHS);
export const refEndsAt = (referredAt: Date) => addMonthsUtc(referredAt, REF_MONTHS);

/** Còn được nhập mã giới thiệu bổ sung không (7 ngày đầu sau khi tạo tài khoản). */
export const canClaimRef = (createdAt: Date, now: Date) => now.getTime() - createdAt.getTime() <= REF_CLAIM_DAYS * 86_400_000;

export const vnMonth = (d: Date) => vnToday(d).slice(0, 7);

/** Ngày (YYYY-MM-DD giờ VN) phần chia sẻ tháng `month` bắt đầu được chuyển. */
export function payableFrom(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(PAYOUT_AFTER_DAYS + 1).padStart(2, "0")}`;
}
export const isPayable = (month: string, now: Date) => vnToday(now) >= payableFrom(month);

/** Mã giới thiệu: 6 ký tự, bỏ các chữ dễ nhầm (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeRefCode(rand: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");
}
export function parseRefCode(v: unknown): string | null | { error: string } {
  const raw = String(v ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!raw) return null;
  if (!/^[A-Z0-9]{6}$/.test(raw)) return { error: "Mã giới thiệu gồm 6 chữ và số, ví dụ AB12CD." };
  return raw;
}
