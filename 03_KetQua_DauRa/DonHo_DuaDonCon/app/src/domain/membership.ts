// Thành viên ưu đãi: Thường (miễn phí) dùng đủ dịch vụ cốt lõi; Bạc/Vàng/Kim cương trả phí nhận thêm ưu đãi.
// Ưu đãi chỉ về tiền và tiện lợi — KHÔNG đổi việc cô duyệt, kiểm tra tại cổng hay hạng tương trợ. Hàm thuần.

export type MemberTierKey = "THUONG" | "BAC" | "VANG" | "KIM_CUONG";
export type PaidTierKey = Exclude<MemberTierKey, "THUONG">;

export type MemberTier = {
  key: MemberTierKey;
  name: string;
  /** Giá mỗi tháng (đồng). [GIẢ ĐỊNH] chỉnh theo thí điểm. */
  monthly: number;
  /** Phí nền tảng trích từ người đón. Lượt có phí lấy mức thấp hơn giữa hạng người đón và hạng người nhờ. */
  rate: number;
  /** Số điểm trả hay dùng lưu được. */
  places: number;
  /** Nợ phí nền tảng từ mức này và có khoản quá số ngày này → tạm không nhận việc có phí mới. */
  owedLimit: number;
  owedDays: number;
  /** Lời nhờ có phí nổi bật trên bảng việc của trường, đứng trước lời nhờ thường. */
  featured: boolean;
  /** Trong nhóm lớp: đứng trước lời nhờ khác CÙNG hạng tương trợ (không vượt hạng tương trợ). */
  askBoost: boolean;
};

export const MEMBER_TIERS: MemberTier[] = [
  { key: "THUONG", name: "Thường", monthly: 0, rate: 0.1, places: 5, owedLimit: 300_000, owedDays: 30, featured: false, askBoost: false },
  { key: "BAC", name: "Bạc", monthly: 39_000, rate: 0.07, places: 10, owedLimit: 500_000, owedDays: 45, featured: false, askBoost: false },
  { key: "VANG", name: "Vàng", monthly: 69_000, rate: 0.05, places: 20, owedLimit: 800_000, owedDays: 60, featured: true, askBoost: true },
  { key: "KIM_CUONG", name: "Kim cương", monthly: 129_000, rate: 0.03, places: 30, owedLimit: 1_200_000, owedDays: 60, featured: true, askBoost: true },
];

export const FREE_TIER = MEMBER_TIERS[0];
export const PAID_TIERS = MEMBER_TIERS.filter((t) => t.key !== "THUONG") as (MemberTier & { key: PaidTierKey })[];
export const MONTH_OPTIONS = [1, 12] as const;

export const tierInfo = (key: string): MemberTier => MEMBER_TIERS.find((t) => t.key === key) ?? FREE_TIER;
export const tierRank = (key: string) => Math.max(0, MEMBER_TIERS.findIndex((t) => t.key === key));
export const isPaidTier = (v: unknown): v is PaidTierKey => PAID_TIERS.some((t) => t.key === v);

/** Đóng 12 tháng chỉ tính 10 tháng. */
export function priceOf(tier: PaidTierKey, months: number): number {
  return tierInfo(tier).monthly * (months >= 12 ? 10 : months);
}

/** Phí nền tảng thực tế: không vượt mức gốc của nền tảng (biến môi trường), không cao hơn mức của hạng. */
export const rateOf = (tier: MemberTier, base: number) => Math.min(tier.rate, base);

/** Phí cho một lượt có phí: lấy mức thấp hơn giữa người đón và người nhờ — người nhờ là thành viên thì người đón nhận nhiều hơn. */
export const jobRate = (helper: MemberTier, requester: MemberTier, base: number) => Math.min(rateOf(helper, base), rateOf(requester, base));

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/**
 * Gói mới bắt đầu khi nào: cùng hạng hoặc hạng thấp hơn gói đang chạy → nối tiếp sau gói đang chạy cao nhất ≥ hạng đó;
 * nâng hạng → bắt đầu ngay (gói thấp hơn vẫn còn, nhưng hạng cao hơn được tính).
 */
export function startOfNew(active: { tier: string; endsAt: Date }[], tier: PaidTierKey, now: Date): Date {
  const rank = tierRank(tier);
  const blocking = active.filter((m) => tierRank(m.tier) >= rank && m.endsAt > now).map((m) => m.endsAt.getTime());
  return blocking.length ? new Date(Math.max(...blocking)) : now;
}
