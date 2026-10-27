// Máy trạng thái của một yêu cầu đón hộ — nguồn sự thật duy nhất về việc ai được làm gì, ở trạng thái nào.
// Thuần (không đụng DB) để test được hết các nhánh. Xem đặc tả §3.1.

export const STATUSES = [
  "CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA", "DA_GIAO", "HOAN_TAT",
  "NGUOI_DON_TU_CHOI", "GV_TU_CHOI", "DA_HUY", "HET_HAN", "KHONG_GIAO_DUOC",
] as const;
export type Status = (typeof STATUSES)[number];

export type Role = "PHU_HUYNH" | "NGUOI_DON" | "GIAO_VIEN" | "HE_THONG";

export type Action =
  | "NGUOI_DON_NHAN" | "NGUOI_DON_TU_CHOI" | "NGUOI_DON_BAO_NGHI"
  | "GV_DUYET" | "GV_TU_CHOI"
  | "PH_HUY"
  | "KHOA_SAI_PIN"
  | "GIAO_TRE" | "KHONG_GIAO_DUOC"
  | "PH_XAC_NHAN_VE" | "TU_DONG_DONG"
  | "HET_HAN";

type Rule = { from: Status[]; to: Status; role: Role };

const RULES: Record<Action, Rule> = {
  NGUOI_DON_NHAN: { from: ["CHO_NGUOI_DON"], to: "CHO_GIAO_VIEN", role: "NGUOI_DON" },
  NGUOI_DON_TU_CHOI: { from: ["CHO_NGUOI_DON"], to: "NGUOI_DON_TU_CHOI", role: "NGUOI_DON" },
  // đón theo tháng: buổi đã duyệt sẵn, người đón báo nghỉ buổi này
  NGUOI_DON_BAO_NGHI: { from: ["DA_DUYET"], to: "NGUOI_DON_TU_CHOI", role: "NGUOI_DON" },
  GV_DUYET: { from: ["CHO_GIAO_VIEN"], to: "DA_DUYET", role: "GIAO_VIEN" },
  GV_TU_CHOI: { from: ["CHO_GIAO_VIEN"], to: "GV_TU_CHOI", role: "GIAO_VIEN" },
  PH_HUY: { from: ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA"], to: "DA_HUY", role: "PHU_HUYNH" },
  KHOA_SAI_PIN: { from: ["DA_DUYET"], to: "BI_KHOA", role: "HE_THONG" },
  GIAO_TRE: { from: ["DA_DUYET"], to: "DA_GIAO", role: "GIAO_VIEN" },
  KHONG_GIAO_DUOC: { from: ["DA_DUYET"], to: "KHONG_GIAO_DUOC", role: "GIAO_VIEN" },
  PH_XAC_NHAN_VE: { from: ["DA_GIAO"], to: "HOAN_TAT", role: "PHU_HUYNH" },
  TU_DONG_DONG: { from: ["DA_GIAO"], to: "HOAN_TAT", role: "HE_THONG" },
  HET_HAN: { from: ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET"], to: "HET_HAN", role: "HE_THONG" },
};

export class TransitionError extends Error {}

/** Trả về trạng thái mới, hoặc ném lỗi nếu hành động không hợp lệ ở trạng thái/vai trò này. */
export function transition(from: Status, action: Action, role: Role): Status {
  const rule = RULES[action];
  if (rule.role !== role) throw new TransitionError(`Vai trò ${role} không được làm "${action}".`);
  if (!rule.from.includes(from)) throw new TransitionError(`Không thể "${action}" khi yêu cầu đang ở trạng thái ${from}.`);
  return rule.to;
}

export const ACTIVE: Status[] = ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA", "DA_GIAO"];
export const FINAL: Status[] = ["HOAN_TAT", "NGUOI_DON_TU_CHOI", "GV_TU_CHOI", "DA_HUY", "HET_HAN", "KHONG_GIAO_DUOC"];
export const isFinal = (s: Status) => FINAL.includes(s);

export type Tone = "warn" | "ok" | "danger" | "info" | "muted";

/** Trạng thái hiển thị cho người dùng: nhãn ngắn + tông màu (giao diện luôn kèm icon + chữ). */
export const STATUS_LABEL: Record<Status, { label: string; tone: Tone }> = {
  CHO_NGUOI_DON: { label: "Chờ người đón nhận lời", tone: "warn" },
  CHO_GIAO_VIEN: { label: "Chờ giáo viên duyệt", tone: "warn" },
  DA_DUYET: { label: "Đã duyệt, chờ đón", tone: "info" },
  BI_KHOA: { label: "Bị khoá do sai mã", tone: "danger" },
  DA_GIAO: { label: "Đã giao trẻ", tone: "ok" },
  HOAN_TAT: { label: "Hoàn tất", tone: "ok" },
  NGUOI_DON_TU_CHOI: { label: "Người đón từ chối", tone: "danger" },
  GV_TU_CHOI: { label: "Giáo viên từ chối", tone: "danger" },
  DA_HUY: { label: "Đã huỷ", tone: "muted" },
  HET_HAN: { label: "Hết hạn", tone: "muted" },
  KHONG_GIAO_DUOC: { label: "Không giao được", tone: "danger" },
};

export const PIN_MAX_ATTEMPTS = 5;
/** Mã đón có hiệu lực từ 30 phút trước giờ đón đến hết khung giờ. */
export const CODE_EARLY_MS = 30 * 60_000;
/** Sau khi quét mã, GV có 15 phút để bấm "Đã giao". */
export const GATE_VERIFY_TTL_MS = 15 * 60_000;
/** Đã giao mà phụ huynh không xác nhận → tự đóng sau 24 giờ. */
export const AUTO_CLOSE_MS = 24 * 3600_000;

export function codeUsableAt(now: Date, windowStart: Date, windowEnd: Date): boolean {
  return now.getTime() >= windowStart.getTime() - CODE_EARLY_MS && now.getTime() <= windowEnd.getTime();
}
