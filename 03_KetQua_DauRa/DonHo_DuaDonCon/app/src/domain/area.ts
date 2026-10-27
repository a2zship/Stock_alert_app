// Khu vực thực tế của người dùng: tỉnh/thành → phường/xã → trường. Hàm thuần, kiểm dữ liệu form đăng ký.

/** Quan hệ với bé khi phụ huynh tự xin nhận. */
export const CLAIM_RELATIONS = ["Bố", "Mẹ", "Ông", "Bà", "Người giám hộ"] as const;

export type AreaInput = {
  provinceId?: unknown; wardId?: unknown; wardName?: unknown; schoolId?: unknown; schoolName?: unknown;
};
export type Area = {
  provinceId: number;
  /** có sẵn trong danh sách → wardId; không có → wardName (gõ tay, chưa xác minh) */
  wardId: number | null; wardName: string | null;
  /** trường có trong hệ thống → schoolId; chưa có → schoolName (đề xuất) hoặc bỏ trống */
  schoolId: string | null; schoolName: string | null;
};

const clean = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");
const OTHER = "khac";

/** Tên phường/xã gõ tay: gọn khoảng trắng, viết hoa chữ đầu ("phường tân an" → "Phường tân an"). */
export function wardTitle(name: string): string {
  const n = clean(name);
  return n ? n[0].toUpperCase() + n.slice(1) : n;
}

export function parseArea(i: AreaInput): Area | { error: string } {
  const provinceId = Number(i.provinceId);
  if (!Number.isInteger(provinceId) || provinceId <= 0) return { error: "Chọn tỉnh/thành phố nơi bạn sống." };

  const wid = clean(i.wardId);
  let wardId: number | null = null;
  let wardName: string | null = null;
  if (wid && wid !== OTHER) {
    wardId = Number(wid);
    if (!Number.isInteger(wardId) || wardId <= 0) return { error: "Chọn phường/xã." };
  } else {
    const n = wardTitle(clean(i.wardName));
    if (n.length < 4) return { error: "Chọn phường/xã, hoặc gõ tên nếu không có trong danh sách (ví dụ: Phường Tân An)." };
    if (n.length > 60) return { error: "Tên phường/xã quá dài." };
    if (!/^(Phường|Xã|Đặc khu)\s/i.test(n)) return { error: "Ghi rõ \"Phường …\" hoặc \"Xã …\"." };
    wardName = n;
  }

  const sid = clean(i.schoolId);
  let schoolId: string | null = null;
  let schoolName: string | null = null;
  if (sid && sid !== OTHER) schoolId = sid;
  else {
    const n = clean(i.schoolName);
    if (n.length > 120) return { error: "Tên trường quá dài." };
    if (n && n.length < 5) return { error: "Ghi đủ tên trường, ví dụ: Trường Mầm non Hoa Mai." };
    schoolName = n || null;
  }
  // phường/xã gõ tay thì chắc chắn chưa có trường trong hệ thống
  if (wardName && schoolId) return { error: "Phường/xã mới chưa có trường trong hệ thống — ghi tên trường để đề xuất." };
  return { provinceId, wardId, wardName, schoolId, schoolName };
}

export type ChildInput = { classId?: unknown; studentName?: unknown; relation?: unknown };
export type Child = { classId: string; studentName: string; relation: string };

/** Bé cần xác nhận: không bắt buộc (người chỉ đi đón giúp không có con ở trường), nhưng đã ghi thì phải đủ. */
export function parseChild(i: ChildInput): Child | null | { error: string } {
  const classId = clean(i.classId);
  const studentName = clean(i.studentName);
  const relation = clean(i.relation);
  if (!classId && !studentName) return null;
  if (!classId) return { error: "Chọn lớp của bé." };
  if (studentName.length < 4 || studentName.split(" ").length < 2) return { error: "Ghi đủ họ và tên của bé." };
  if (studentName.length > 60) return { error: "Tên bé quá dài." };
  if (!(CLAIM_RELATIONS as readonly string[]).includes(relation)) return { error: "Chọn bạn là gì của bé." };
  return { classId, studentName, relation };
}

export function parseName(v: unknown): string | { error: string } {
  const n = clean(v);
  if (n.length < 4 || n.split(" ").length < 2) return { error: "Ghi đủ họ và tên của bạn." };
  if (n.length > 60) return { error: "Họ tên quá dài." };
  return n;
}

/** "Phường Ninh Kiều, Cần Thơ" */
export const showArea = (a: { ward?: { name: string } | null; province?: { name: string } | null }) =>
  [a.ward?.name, a.province?.name].filter(Boolean).join(", ");
