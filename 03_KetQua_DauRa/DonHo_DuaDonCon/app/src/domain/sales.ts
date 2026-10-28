// Phễu tự bán: trường tự mở trên app → có cô → có phụ huynh → có người đón có phí → có lượt đón → có doanh thu.
// Hàm thuần: tính bước của trường, việc cần làm tiếp, khớp tên trường phụ huynh đề xuất, tin nhắn mẫu, nhịp nhắc việc.

export const MIN_PARENTS = 5;
export const MIN_HELPERS = 2;
export const NUDGE_GAP_DAYS = 7;
export const NUDGE_MAX = 3;
/** Số phụ huynh cùng đề xuất một trường thì app nhắc họ mời nhà trường. */
export const DEMAND_MIN = 3;

export const STAGES = ["MOI_DANG_KY", "CO_CO_GIAO", "CO_PHU_HUYNH", "CO_NGUOI_DON", "CO_LUOT_DON", "CO_DOANH_THU"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  MOI_DANG_KY: "Mới mở trường",
  CO_CO_GIAO: "Đã có cô giáo",
  CO_PHU_HUYNH: "Đã có phụ huynh",
  CO_NGUOI_DON: "Đã có người đón",
  CO_LUOT_DON: "Đã có lượt đón",
  CO_DOANH_THU: "Có doanh thu",
};

/** Việc cần làm để lên bước sau — hiện cho nhà trường. */
export const STAGE_NEXT: Record<Stage, string> = {
  MOI_DANG_KY: "Thêm lớp và số điện thoại cô phụ trách. Cô nhận tin mời và đăng nhập bằng số đó.",
  CO_CO_GIAO: `Cô gửi đường dẫn hoặc áp phích QR của lớp vào nhóm Zalo phụ huynh. Cần ít nhất ${MIN_PARENTS} phụ huynh được cô xác nhận.`,
  CO_PHU_HUYNH: `Mời ${MIN_HELPERS}–3 phụ huynh hay đi đón sớm đăng ký người đón có phí (dùng tin mời người đón tiên phong).`,
  CO_NGUOI_DON: "Nhắc phụ huynh bận: hôm nào không kịp đón, đăng lời nhờ trong nhóm lớp thay vì đặt xe.",
  CO_LUOT_DON: "Giữ nhịp: cô nhắc trong nhóm lớp mỗi tuần; người đón tiên phong mời thêm người.",
  CO_DOANH_THU: "Khai tài khoản nhận ở mục Chia sẻ doanh thu để nhận phần 10% của trường.",
};

export type SchoolCounts = { teachers: number; parents: number; helpers: number; pickups: number; revenue: number };

/** Bước cao nhất đã đạt, xét lần lượt — chưa qua bước trước thì không tính bước sau. */
export function schoolStage(c: SchoolCounts): Stage {
  const reached = [c.teachers > 0, c.parents >= MIN_PARENTS, c.helpers >= MIN_HELPERS, c.pickups > 0, c.revenue > 0];
  let i = 0;
  while (i < reached.length && reached[i]) i++;
  return STAGES[i];
}

export const stageIndex = (s: Stage) => STAGES.indexOf(s);

/** Chuẩn hoá tên trường để khớp đề xuất của phụ huynh: bỏ dấu, chữ thường, bỏ chữ "trường", MN → mầm non, TH → tiểu học. */
export function normSchoolName(name: string): string {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return ` ${n} `.replace(/ truong /g, " ").replace(/ mn /g, " mam non ").replace(/ th /g, " tieu hoc ")
    .replace(/\s+/g, " ").trim();
}

/** Còn được nhắc không: chưa quá số lần và lần trước đã cách đủ ngày. */
export function nudgeDue(sent: Date[], now: Date): boolean {
  if (sent.length >= NUDGE_MAX) return false;
  const last = Math.max(0, ...sent.map((d) => d.getTime()));
  return now.getTime() - last >= NUDGE_GAP_DAYS * 86_400_000;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseClass(i: { name?: unknown; pickupStart?: unknown; pickupEnd?: unknown }): { name: string; pickupStart: string; pickupEnd: string } | { error: string } {
  const name = String(i.name ?? "").trim().replace(/\s+/g, " ");
  const pickupStart = String(i.pickupStart ?? "").trim();
  const pickupEnd = String(i.pickupEnd ?? "").trim();
  if (name.length < 2 || name.length > 40) return { error: "Ghi tên lớp, ví dụ: Lá 1, Chồi 2." };
  if (!HHMM.test(pickupStart) || !HHMM.test(pickupEnd)) return { error: "Chọn giờ đón bắt đầu và kết thúc." };
  if (pickupStart >= pickupEnd) return { error: "Giờ kết thúc đón phải sau giờ bắt đầu." };
  return { name, pickupStart, pickupEnd };
}

// ── Tin nhắn mẫu (cô / phụ huynh tự gửi qua Zalo) ──

export function msgParents(p: { school: string; cls: string; url: string }) {
  return `Kính gửi phụ huynh lớp ${p.cls},\n`
    + `${p.school} dùng Đón Hộ để phụ huynh nhờ người đón con khi bận đột xuất. `
    + `Người đón được cô xác minh tại cổng (mã QR, ảnh, 4 số cuối CCCD), ba mẹ theo dõi đường về trên bản đồ và nhận tin khi bé tới nơi. `
    + `Bé không cần mang điện thoại.\n`
    + `Hôm nào bận, ba mẹ có thể nhờ phụ huynh cùng lớp đón giúp thay vì đặt xe.\n`
    + `Đăng ký (miễn phí, khoảng 2 phút): ${p.url}\n`
    + `Sau khi đăng ký, cô sẽ gọi điện xác nhận ba mẹ là phụ huynh của bé.`;
}

export function msgHelpers(p: { school: string; cls: string; url: string }) {
  return `Chào chị/anh,\n`
    + `Lớp ${p.cls} (${p.school}) đang tìm 2–3 phụ huynh hay đón con sớm để làm "người đón tiên phong" trên Đón Hộ.\n`
    + `Hôm nào phụ huynh khác bận, chị/anh đón giúp bé cùng lớp và nhận thù lao do phụ huynh đó chuyển thẳng qua ngân hàng. `
    + `Đằng nào cũng ra cổng đón con, đón thêm một bé là có thêm thu nhập.\n`
    + `Cô vẫn xác minh tại cổng như mọi lần, không bỏ bước an toàn nào.\n`
    + `Đăng ký tài khoản: ${p.url}\n`
    + `Sau đó vào mục "Kiếm thêm khi đón hộ" để đăng ký người đón có phí.`;
}

/** Phụ huynh gửi cho nhà trường khi trường chưa có trên app. */
export function msgInviteSchool(p: { school: string; count: number; url: string }) {
  return `Kính gửi nhà trường,\n`
    + `Đã có ${p.count} phụ huynh của ${p.school} đăng ký Đón Hộ và mong trường tham gia. `
    + `Đón Hộ giúp phụ huynh nhờ người đón con có cô xác minh tại cổng, ghi nhật ký giao trẻ làm bằng chứng. `
    + `Trường không mất phí và được chia 10% doanh thu phát sinh ở trường.\n`
    + `Mở trường trên Đón Hộ (khoảng 3 phút): ${p.url}`;
}

/** Bỏ dấu cho tin SMS (giữ chữ hoa/thường): "Lá 1" → "La 1". */
export const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
