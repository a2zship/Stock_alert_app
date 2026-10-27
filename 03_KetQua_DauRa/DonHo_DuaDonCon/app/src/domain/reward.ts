// Điểm tương trợ cho người đi đón hộ. Hàm thuần: nhận lịch sử, trả điểm + hạng + huy hiệu.
// Nguyên tắc an toàn: điểm KHÔNG đổi ra tiền, KHÔNG ảnh hưởng việc giáo viên duyệt — chỉ để ghi nhận và cảm ơn.

export type Pickup = {
  /** Phụ huynh đã bấm "Con đã về an toàn" (HOAN_TAT) — chỉ lần đón trọn vẹn mới được tính */
  completedAt: Date;
  /** Thời gian từ lúc được nhờ đến lúc nhận lời (phút) */
  replyMinutes: number | null;
  /** Có lời cảm ơn kèm theo */
  thanked: boolean;
};

export const POINTS = { pickup: 10, fastReply: 5, thanked: 2 } as const;
export const FAST_REPLY_MIN = 10;

export const TIERS = [
  { key: "dong-hanh", name: "Bạn đồng hành", min: 0 },
  { key: "tin-cay", name: "Hàng xóm tin cậy", min: 30 },
  { key: "dai-su", name: "Đại sứ an toàn", min: 100 },
] as const;
export type TierKey = (typeof TIERS)[number]["key"];

export type Benefit = { title: string; detail: string; tier: TierKey; pending?: boolean };

/** Quyền lợi theo hạng. `pending` = cần nhà trường/đối tác đồng ý trước khi bật thật. */
export const BENEFITS: Benefit[] = [
  { tier: "dong-hanh", title: "Lời cảm ơn từ phụ huynh", detail: "Phụ huynh gửi lời cảm ơn khi bé về an toàn, lưu lại trong hồ sơ của bạn." },
  { tier: "dong-hanh", title: "Huy hiệu tương trợ", detail: "Hiện bên tên bạn trong nhóm lớp, để các phụ huynh khác biết bạn hay giúp đỡ." },
  { tier: "tin-cay", title: "Gợi ý ưu tiên khi bạn cần nhờ", detail: "Khi chính bạn bận, lời nhờ của bạn được đẩy lên đầu nhóm lớp. Giúp người, khi cần có người giúp." },
  { tier: "tin-cay", title: "Thư cảm ơn của nhà trường", detail: "Nhà trường gửi thư cảm ơn cuối học kỳ.", pending: true },
  { tier: "dai-su", title: "Vinh danh tại buổi họp phụ huynh", detail: "Ghi nhận trong buổi họp phụ huynh cuối năm.", pending: true },
  { tier: "dai-su", title: "Ưu đãi từ đối tác của trường", detail: "Nhà sách, đồng phục, dã ngoại… tuỳ trường thoả thuận.", pending: true },
];

export type Badge = { key: string; name: string; hint: string; earned: boolean };

export function computeReward(history: Pickup[]) {
  const pickups = history.length;
  const fast = history.filter((h) => h.replyMinutes !== null && h.replyMinutes <= FAST_REPLY_MIN).length;
  const thanks = history.filter((h) => h.thanked).length;
  const points = pickups * POINTS.pickup + fast * POINTS.fastReply + thanks * POINTS.thanked;

  const tierIdx = TIERS.reduce((acc, t, i) => (points >= t.min ? i : acc), 0);
  const tier = TIERS[tierIdx];
  const next = TIERS[tierIdx + 1] ?? null;
  const progress = next ? (points - tier.min) / (next.min - tier.min) : 1;

  const badges: Badge[] = [
    { key: "lan-dau", name: "Lần đầu giúp", hint: "Đón hộ trọn vẹn 1 lần", earned: pickups >= 1 },
    { key: "nhanh", name: "Phản hồi nhanh", hint: `Nhận lời trong ${FAST_REPLY_MIN} phút, 3 lần`, earned: fast >= 3 },
    { key: "nam-lan", name: "Bạn của cả lớp", hint: "Đón hộ trọn vẹn 5 lần", earned: pickups >= 5 },
    { key: "cam-on", name: "Được cảm ơn", hint: "Nhận 3 lời cảm ơn", earned: thanks >= 3 },
  ];
  const unlocked = (t: TierKey) => TIERS.findIndex((x) => x.key === t) <= tierIdx;
  return { points, pickups, fast, thanks, tier, next, progress: Math.min(1, Math.max(0, progress)), badges, unlocked };
}
