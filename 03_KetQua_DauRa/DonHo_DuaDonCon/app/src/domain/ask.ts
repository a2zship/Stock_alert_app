// Quy tắc đăng lời nhờ đón hộ: mở rộng dần từng vòng, chỉ lên vòng sau khi vòng trước CHƯA AI NHẬN.
//   1. LỚP     — nhắn thẳng từng phụ huynh cùng lớp + hiện trong nhóm lớp (người quen mặt nhất, cô dễ duyệt nhất)
//   2. TRƯỜNG  — phụ huynh các lớp khác cùng trường (không hiện tên bé)
//   3. KHU VỰC — phụ huynh đã được cô xác nhận, sống cùng phường/xã với người nhờ (không hiện tên bé)
// Dù nhận ở vòng nào: vẫn đủ 3 bên xác nhận, cô duyệt người đón, kiểm mã/ảnh/CCCD tại cổng.
// Lời nhờ có thù lao dừng ở vòng TRƯỜNG: người đón có phí được duyệt theo từng trường.
// Thời gian mỗi vòng [GIẢ ĐỊNH, chỉnh khi thí điểm]: càng gần giờ đón càng mở rộng nhanh.

export const ASK_SCOPES = ["LOP", "TRUONG", "KHU_VUC"] as const;
export type AskScope = (typeof ASK_SCOPES)[number];

export const SCOPE_LABEL: Record<AskScope, string> = { LOP: "Nhóm lớp", TRUONG: "Cả trường", KHU_VUC: "Khu vực sống" };

/** Phút chờ ở mỗi vòng, theo thời gian còn lại tới giờ bắt đầu đón. */
export function stepMinutes(minutesToPickup: number): number {
  if (minutesToPickup >= 6 * 60) return 30;
  if (minutesToPickup >= 2 * 60) return 15;
  return 5;
}

/** Vòng cao nhất được phép: có thù lao thì dừng ở trường. */
export const maxScope = (fee: number | null | undefined): AskScope => (fee ? "TRUONG" : "KHU_VUC");

export function nextScope(scope: AskScope, fee?: number | null): AskScope | null {
  const i = ASK_SCOPES.indexOf(scope);
  if (scope === maxScope(fee)) return null;
  return ASK_SCOPES[i + 1] ?? null;
}

/**
 * Vòng tiếp theo nếu tới lúc tự mở rộng, ngược lại null.
 * Không mở rộng khi: đã có người nhận (phụ huynh đang chọn), đã ở vòng cao nhất, đã qua giờ đón.
 */
export function dueEscalation(p: { scope: AskScope; scopeAt: Date; fee?: number | null; offers: number; pickupStart: Date; pickupEnd: Date }, now: Date): AskScope | null {
  if (p.offers > 0 || now >= p.pickupEnd) return null;
  const next = nextScope(p.scope, p.fee);
  if (!next) return null;
  const left = (p.pickupStart.getTime() - now.getTime()) / 60_000;
  const waited = (now.getTime() - p.scopeAt.getTime()) / 60_000;
  return waited >= stepMinutes(Math.max(left, 0)) ? next : null;
}

/** Lúc vòng hiện tại sẽ tự mở rộng (để hiện "lên trường lúc 15:30"); null nếu không còn vòng sau. */
export function escalatesAt(p: { scope: AskScope; scopeAt: Date; fee?: number | null; pickupStart: Date }): Date | null {
  if (!nextScope(p.scope, p.fee)) return null;
  // ước theo thời gian còn lại lúc bắt đầu vòng — đủ để hiển thị
  const left = (p.pickupStart.getTime() - p.scopeAt.getTime()) / 60_000;
  return new Date(p.scopeAt.getTime() + stepMinutes(Math.max(left, 0)) * 60_000);
}

/** Người xem thuộc vòng nào của lời nhờ (null = ngoài phạm vi). */
export function viewerScope(v: { sameClass: boolean; sameSchool: boolean; sameWard: boolean }): AskScope | null {
  if (v.sameClass) return "LOP";
  if (v.sameSchool) return "TRUONG";
  if (v.sameWard) return "KHU_VUC";
  return null;
}

/** Lời nhờ đã mở tới vòng của người xem chưa. */
export const reaches = (scope: AskScope, viewer: AskScope) => ASK_SCOPES.indexOf(scope) >= ASK_SCOPES.indexOf(viewer);
