// Đón theo tháng: lịch buổi đón, thù lao trọn gói, hoàn tiền khi buổi không đón. Hàm thuần.
import { FEE_MIN } from "./money";
import { addDays, vnToday } from "./time";

/** Thứ trong tuần theo cách nói VN: 1 = Thứ Hai … 6 = Thứ Bảy (trường không đón Chủ nhật). */
export const WEEKDAYS = [
  { n: 1, short: "T2", name: "Thứ Hai" }, { n: 2, short: "T3", name: "Thứ Ba" }, { n: 3, short: "T4", name: "Thứ Tư" },
  { n: 4, short: "T5", name: "Thứ Năm" }, { n: 5, short: "T6", name: "Thứ Sáu" }, { n: 6, short: "T7", name: "Thứ Bảy" },
] as const;

/** Hợp đồng mở (không chỉ định): 24 giờ đầu chỉ người đón hạng Kim cương nhận được. */
export const PRIORITY_MS = 24 * 3600_000;
/** Trọn gói một tháng: tối đa [GIẢ ĐỊNH] để chặn gõ nhầm số 0. */
export const MONTH_FEE_MAX = 10_000_000;
/** Phụ huynh tự kết thúc sớm: vẫn trả cho N buổi kế tiếp (báo trước) [GIẢ ĐỊNH]. */
export const NOTICE_DAYS = 2;
/** Người đón chưa hoàn tiền quá N ngày → tạm không nhận việc có phí mới. */
export const REFUND_DAYS = 7;

/** "2026-11-02" → 1 (Thứ Hai) … 0 (Chủ nhật). */
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function parseWeekdays(v: unknown[]): number[] | { error: string } {
  const days = [...new Set(v.map(Number))].filter((n) => WEEKDAYS.some((w) => w.n === n)).sort();
  return days.length ? days : { error: "Chọn ít nhất một ngày trong tuần." };
}

/** Tháng nhận đăng ký: tháng này (từ ngày mai) hoặc tháng sau. */
export function monthOptions(now = new Date()): string[] {
  const m = vnToday(now).slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return [m, next];
}

/** Ngày đầu tiên còn đón được của tháng: tháng này thì từ ngày mai. */
export function firstDay(month: string, now = new Date()): string {
  const tomorrow = addDays(vnToday(now), 1);
  const first = `${month}-01`;
  return tomorrow > first ? tomorrow : first;
}

/** Mọi buổi đón trong tháng từ ngày `from`, theo các thứ đã chọn. */
export function scheduleDays(month: string, weekdays: number[], from: string): string[] {
  const out: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    if (d >= from && weekdays.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

/** Thù lao trọn gói: ít nhất FEE_MIN mỗi buổi, làm tròn nghìn. */
export function parseMonthFee(v: unknown, days: number): number | { error: string } {
  const raw = String(v ?? "").replace(/[.,\s]/g, "");
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) return { error: "Nhập thù lao trọn gói (đồng)." };
  const min = days * FEE_MIN;
  if (n < min) return { error: `Trọn gói tối thiểu ${new Intl.NumberFormat("vi-VN").format(min)}đ (${days} buổi × ${new Intl.NumberFormat("vi-VN").format(FEE_MIN)}đ).` };
  if (n > MONTH_FEE_MAX) return { error: "Số tiền quá lớn — kiểm tra lại số 0." };
  if (n % 1000) return { error: "Làm tròn tới nghìn đồng." };
  return n;
}

/** Hoàn tiền theo tỉ lệ buổi không được đón, làm tròn nghìn. */
export function refundOf(fee: number, total: number, refundable: number): number {
  if (total <= 0 || refundable <= 0) return 0;
  return Math.min(fee, Math.round((fee * Math.min(refundable, total)) / total / 1000) * 1000);
}

/**
 * Số buổi được hoàn khi hợp đồng kết thúc:
 * - buổi người đón báo nghỉ: luôn hoàn;
 * - buổi còn lại sau ngày kết thúc: người đón dừng → hoàn hết; phụ huynh dừng → trừ NOTICE_DAYS buổi báo trước;
 * - buổi phụ huynh tự huỷ: không hoàn (đã giữ lịch cho người đón).
 */
export function refundableDays(opts: { days: string[]; missed: string[]; endDate: string | null; by: "PHU_HUYNH" | "NGUOI_DON" | "HE_THONG" }): number {
  const missed = opts.days.filter((d) => opts.missed.includes(d)).length;
  if (!opts.endDate) return missed;
  const left = opts.days.filter((d) => d > opts.endDate! && !opts.missed.includes(d)).length;
  return missed + (opts.by === "PHU_HUYNH" ? Math.max(0, left - NOTICE_DAYS) : left);
}

export const showMonth = (m: string) => `tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;
export const showDays = (weekdays: number[]) => weekdays.map((n) => WEEKDAYS.find((w) => w.n === n)!.short).join(", ");

export type MonthlyStatusKey = "TIM_NGUOI" | "CHO_NGUOI_DON" | "CHO_GIAO_VIEN" | "DA_DUYET" | "TU_CHOI" | "DA_HUY" | "KET_THUC";
export const MONTHLY_LABEL: Record<MonthlyStatusKey, { label: string; tone: "warn" | "ok" | "danger" | "info" | "muted" }> = {
  TIM_NGUOI: { label: "Đang tìm người đón", tone: "warn" },
  CHO_NGUOI_DON: { label: "Chờ người đón nhận lời", tone: "warn" },
  CHO_GIAO_VIEN: { label: "Chờ cô duyệt", tone: "warn" },
  DA_DUYET: { label: "Đang chạy", tone: "ok" },
  TU_CHOI: { label: "Bị từ chối", tone: "danger" },
  DA_HUY: { label: "Đã huỷ", tone: "muted" },
  KET_THUC: { label: "Đã kết thúc", tone: "muted" },
};
