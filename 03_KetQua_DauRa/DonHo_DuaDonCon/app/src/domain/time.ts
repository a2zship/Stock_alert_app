// Giờ Việt Nam cố định UTC+7 (không có giờ mùa hè) → tính tay, không phụ thuộc múi giờ máy chủ.
const VN_OFFSET_MS = 7 * 3600_000;

/** "2026-10-27" + "16:30" (giờ VN) → Date UTC */
export function vnDateTime(date: string, hhmm: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hhmm)) throw new Error("Ngày/giờ không hợp lệ");
  const d = new Date(`${date}T${hhmm}:00+07:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Ngày/giờ không hợp lệ");
  return d;
}

/** Ngày hôm nay theo giờ VN, dạng YYYY-MM-DD */
export function vnToday(now = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Đầu và cuối một ngày theo giờ VN (dạng UTC) — để lọc "hôm nay" */
export function vnDayRange(date: string): { start: Date; end: Date } {
  return { start: vnDateTime(date, "00:00"), end: new Date(vnDateTime(addDays(date, 1), "00:00").getTime() - 1) };
}

const fmtTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDate = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short", day: "2-digit", month: "2-digit" });

export const showTime = (d: Date) => fmtTime.format(d);
export const showDate = (d: Date) => fmtDate.format(d);
export const showDateTime = (d: Date) => `${fmtTime.format(d)}, ${fmtDate.format(d)}`;
export const showWindow = (start: Date, end: Date) => `${fmtTime.format(start)}–${fmtTime.format(end)}, ${fmtDate.format(start)}`;
