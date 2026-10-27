// Đón hộ có phí: thù lao, phí nền tảng. Hàm thuần.

/** Khoảng thù lao TỐI THIỂU người nhờ đặt — chặn giá quá cao tạo động cơ lạ. [GIẢ ĐỊNH] chỉnh theo thí điểm. */
export const FEE_MIN = 20_000;
export const FEE_MAX = 300_000;
/** Người nhờ tự chọn số chuyển (≥ mức tối thiểu) kèm lời cảm ơn; chặn trên để tránh gõ nhầm số 0. */
export const PAY_MAX = 1_000_000;
/** Phí nền tảng trích từ thu nhập người đón. [GIẢ ĐỊNH] 10%, đọc từ PLATFORM_FEE_RATE nếu có. */
export const DEFAULT_RATE = 0.1;
/** Nợ phí nền tảng từ mốc này VÀ có khoản quá 30 ngày → tạm không nhận việc có phí mới. */
export const OWED_LIMIT = 300_000;
export const OWED_DAYS = 30;

export function parseFee(v: unknown): number | null | { error: string } {
  const raw = String(v ?? "").replace(/[.,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return { error: "Thù lao phải là số tiền (đồng)." };
  if (n < FEE_MIN || n > FEE_MAX) return { error: `Thù lao tối thiểu từ ${showVnd(FEE_MIN)} đến ${showVnd(FEE_MAX)} mỗi lượt.` };
  if (n % 1000) return { error: "Thù lao làm tròn tới nghìn đồng." };
  return n;
}

/** Số tiền người nhờ chọn chuyển: bỏ trống = đúng mức tối thiểu; không thấp hơn mức đã hứa. */
export function parsePay(v: unknown, min: number): number | { error: string } {
  const raw = String(v ?? "").replace(/[.,\s]/g, "");
  if (!raw) return min;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return { error: "Số tiền phải là số (đồng)." };
  if (n < min) return { error: `Không thấp hơn mức tối thiểu đã hứa ${showVnd(min)}.` };
  if (n > PAY_MAX) return { error: `Tối đa ${showVnd(PAY_MAX)} mỗi lượt — kiểm tra lại số 0.` };
  if (n % 1000) return { error: "Làm tròn tới nghìn đồng." };
  return n;
}

/** Phí nền tảng làm tròn tới nghìn đồng. */
export function commissionOf(fee: number, rate = DEFAULT_RATE): number {
  return Math.round((fee * rate) / 1000) * 1000;
}

export const showVnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
