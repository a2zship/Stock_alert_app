// Đăng ký tài khoản + khu vực thực tế (tỉnh → phường/xã → trường) + xin xác nhận là phụ huynh của bé.
// Tự đăng ký vào được app ngay, nhưng CHƯA là phụ huynh của bé nào: cô lớp gọi điện xác minh rồi mới gắn với hồ sơ bé.
// Phường/xã không có trong danh sách thì gõ tay → lưu "chưa xác minh", không hiện cho người khác chọn.
import type { Prisma } from "@prisma/client";
import { parseArea, parseChild, parseName, type Area, type AreaInput, type ChildInput } from "@/domain/area";
import { consumeOtp, requestOtp } from "./auth";
import { AppError, db } from "./db";
import { notify } from "./notify";
import { applyReferral, checkRefCode } from "./share";

type Tx = Prisma.TransactionClient;
const MAX_PENDING_CLAIMS = 5;

const must = <T>(v: T | { error: string }): T => {
  if (v && typeof v === "object" && "error" in v) throw new AppError(v.error);
  return v as T;
};

// ─────────────────────────── Danh mục cho bộ chọn ───────────────────────────

/** Sắp theo bảng chữ cái tiếng Việt (Postgres sắp "Đ" xuống cuối, "Cà Mau" sau "Cao Bằng"). */
const vi = new Intl.Collator("vi");
const byName = <T extends { name: string }>(rows: T[]) => rows.sort((a, b) => vi.compare(a.name, b.name));

export const provinces = async () => byName(await db.province.findMany({ select: { id: true, name: true, formedFrom: true } }));

/** Chỉ phường/xã đã xác minh — tên người khác gõ tay không hiện cho người sau chọn. */
export const wardsOf = async (provinceId: number) =>
  byName(await db.ward.findMany({ where: { provinceId, verified: true }, select: { id: true, name: true } }));

export const schoolsOf = (wardId: number) =>
  db.school.findMany({
    where: { wardId }, orderBy: { name: "asc" },
    select: { id: true, name: true, classes: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });

/** Kiểm khu vực với dữ liệu thật; phường/xã gõ tay thì tạo mới (chưa xác minh) hoặc dùng lại tên trùng. */
export async function resolveArea(tx: Tx, a: Area) {
  const province = await tx.province.findUnique({ where: { id: a.provinceId } });
  if (!province) throw new AppError("Tỉnh/thành không có trong danh sách.");
  let wardId = a.wardId;
  if (wardId) {
    const w = await tx.ward.findUnique({ where: { id: wardId } });
    if (!w || w.provinceId !== province.id) throw new AppError("Phường/xã không thuộc tỉnh/thành đã chọn.");
  } else {
    const w = await tx.ward.upsert({
      where: { provinceId_name: { provinceId: province.id, name: a.wardName! } },
      update: {}, create: { provinceId: province.id, name: a.wardName!, verified: false },
    });
    wardId = w.id;
  }
  if (a.schoolId) {
    const s = await tx.school.findUnique({ where: { id: a.schoolId } });
    if (!s || s.wardId !== wardId) throw new AppError("Trường không thuộc phường/xã đã chọn.");
  }
  return { provinceId: province.id, wardId, schoolId: a.schoolId, pendingSchool: a.schoolId ? null : a.schoolName };
}

async function createClaim(tx: Tx, userId: string, schoolId: string | null, input: ChildInput) {
  const child = must(parseChild(input));
  if (!child) return null;
  const cls = await tx.class.findUnique({ where: { id: child.classId }, include: { teachers: { include: { user: true } } } });
  if (!cls || cls.schoolId !== schoolId) throw new AppError("Lớp không thuộc trường đã chọn.");
  const pending = await tx.guardianClaim.count({ where: { userId, status: "CHO_DUYET" } });
  if (pending >= MAX_PENDING_CLAIMS) throw new AppError(`Đang có ${MAX_PENDING_CLAIMS} yêu cầu chờ cô xác nhận. Đợi cô xác nhận bớt rồi gửi thêm.`);
  const dup = await tx.guardianClaim.findFirst({ where: { userId, classId: cls.id, studentName: { equals: child.studentName, mode: "insensitive" }, status: { in: ["CHO_DUYET", "DA_DUYET"] } } });
  if (dup) throw new AppError(`Đã gửi xác nhận bé ${child.studentName} ở ${cls.name} rồi.`);
  const claim = await tx.guardianClaim.create({ data: { userId, classId: cls.id, studentName: child.studentName, relation: child.relation } });
  await notify(tx, cls.teachers.map((t) => ({ userId: t.userId, phone: t.user.phone })), "PUSH",
    `Có phụ huynh xin xác nhận là ${child.relation.toLowerCase()} của bé ${child.studentName} (${cls.name}). Gọi điện xác minh rồi duyệt.`, "/giao-vien/phu-huynh-moi");
  return claim.id;
}

// ─────────────────────────── Đăng ký ───────────────────────────

export type SignupInput = AreaInput & ChildInput & { name?: unknown; phone?: unknown; refCode?: unknown };

/** Bước 1: kiểm form trước (không ghi gì), rồi mới gửi mã — tránh gửi mã cho form sai. */
export async function startSignup(input: SignupInput, now = new Date()) {
  must(parseName(input.name));
  must(parseArea(input));
  must(parseChild(input));
  await checkRefCode(input.refCode);
  return requestOtp(String(input.phone ?? ""), now, { signup: true });
}

/**
 * Bước 2: đúng mã → tạo tài khoản với khu vực + yêu cầu xác nhận bé.
 * Số đã có tài khoản: chỉ đăng nhập (không đổi tên/quyền), bổ sung khu vực nếu còn trống — không để lộ số đã đăng ký.
 */
export async function finishSignup(input: SignupInput & { code?: unknown }, now = new Date()): Promise<string> {
  const name = must(parseName(input.name));
  const area = must(parseArea(input));
  must(parseChild(input));
  const refCode = await checkRefCode(input.refCode);
  const phone = await consumeOtp(String(input.phone ?? ""), String(input.code ?? "").replace(/\s/g, ""), now);
  return db.$transaction(async (tx) => {
    const where = await resolveArea(tx, area);
    const existing = await tx.user.findUnique({ where: { phone } });
    if (existing) {
      if (!existing.provinceId) await tx.user.update({ where: { id: existing.id }, data: where });
      await tx.auditLog.create({ data: { actorId: existing.id, action: "DANG_NHAP", target: phone, meta: { via: "dang-ky" } } });
      return existing.id;
    }
    const user = await tx.user.create({ data: { phone, name, ...where } });
    await createClaim(tx, user.id, where.schoolId, input);
    // người giới thiệu chỉ gắn cho tài khoản MỚI (số đã có tài khoản thì bỏ qua mã)
    if (refCode) await applyReferral(tx, user.id, refCode, now);
    await tx.auditLog.create({ data: { actorId: user.id, action: "DANG_KY", target: phone, meta: { wardId: where.wardId, schoolId: where.schoolId, pendingSchool: where.pendingSchool } } });
    return user.id;
  });
}

// ─────────────────────────── Sau đăng nhập ───────────────────────────

export async function updateArea(userId: string, input: AreaInput) {
  const area = must(parseArea(input));
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: await resolveArea(tx, area) });
  });
}

export async function addClaim(userId: string, input: ChildInput) {
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!me.schoolId) throw new AppError("Chọn trường của con ở phần khu vực trước.");
  return db.$transaction((tx) => createClaim(tx, userId, me.schoolId, input));
}

/** Trang "Khu vực của tôi": khu vực, các yêu cầu xác nhận con, trường khác cùng phường/xã. */
export async function myArea(userId: string) {
  const me = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      province: true, ward: true, school: { include: { classes: { orderBy: { name: "asc" } } } },
      claims: { include: { class: { include: { school: true } } }, orderBy: { createdAt: "desc" } },
      guardianOf: { include: { student: { include: { class: { include: { school: true } } } } } },
    },
  });
  const nearby = me.wardId
    ? await db.school.findMany({ where: { wardId: me.wardId, id: { not: me.schoolId ?? undefined } }, include: { _count: { select: { classes: true } } }, orderBy: { name: "asc" } })
    : [];
  const sameProvince = me.provinceId ? await db.school.count({ where: { ward: { provinceId: me.provinceId } } }) : 0;
  return { me, nearby, sameProvince };
}

// ─────────────────────────── Cô xác nhận phụ huynh ───────────────────────────

export async function claimsForTeacher(teacherId: string) {
  const classIds = (await db.teacherAssignment.findMany({ where: { userId: teacherId }, select: { classId: true } })).map((t) => t.classId);
  return db.guardianClaim.findMany({
    where: { classId: { in: classIds } },
    include: { user: { include: { ward: true, province: true } }, class: { include: { students: { orderBy: { name: "asc" } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
}

/** Duyệt: cô chọn bé có sẵn trong lớp hoặc thêm bé mới; bắt buộc đã gọi điện xác minh. Từ chối phải có lý do. */
export async function reviewClaim(teacherId: string, claimId: string, d: { approve: boolean; studentId?: string; calledParent?: boolean; note?: string }, now = new Date()) {
  const claim = await db.guardianClaim.findUnique({ where: { id: claimId }, include: { user: true, class: true } });
  if (!claim) throw new AppError("Không tìm thấy yêu cầu.");
  if (!(await db.teacherAssignment.count({ where: { userId: teacherId, classId: claim.classId } }))) throw new AppError("Bạn không phụ trách lớp này.");
  if (claim.status !== "CHO_DUYET") throw new AppError("Yêu cầu này đã được xử lý.");
  const note = (d.note ?? "").trim();
  if (!d.approve) {
    if (note.length < 5) throw new AppError("Ghi lý do từ chối để phụ huynh biết.");
    await db.$transaction(async (tx) => {
      await tx.guardianClaim.update({ where: { id: claim.id }, data: { status: "TU_CHOI", decidedById: teacherId, decidedAt: now, note } });
      await notify(tx, [{ userId: claim.userId, phone: claim.user.phone }], "SMS", `Co ${claim.class.name} chua xac nhan ban la phu huynh cua be ${claim.studentName}: ${note}`, "/khu-vuc");
    });
    return;
  }
  if (!d.calledParent) throw new AppError("Gọi điện xác minh với phụ huynh trước khi xác nhận.");
  await db.$transaction(async (tx) => {
    let studentId = d.studentId && d.studentId !== "moi" ? d.studentId : null;
    if (studentId) {
      const s = await tx.student.findUnique({ where: { id: studentId } });
      if (!s || s.classId !== claim.classId) throw new AppError("Bé không thuộc lớp này.");
    } else {
      studentId = (await tx.student.create({ data: { classId: claim.classId, name: claim.studentName } })).id;
    }
    const linked = await tx.guardian.findUnique({ where: { userId_studentId: { userId: claim.userId, studentId } } });
    if (!linked) await tx.guardian.create({ data: { userId: claim.userId, studentId, relation: claim.relation } });
    await tx.guardianClaim.update({ where: { id: claim.id }, data: { status: "DA_DUYET", studentId, decidedById: teacherId, decidedAt: now, calledParent: true, note } });
    await tx.auditLog.create({ data: { actorId: teacherId, action: "XAC_NHAN_PHU_HUYNH", target: studentId, meta: { claimId: claim.id, userId: claim.userId } } });
    await notify(tx, [{ userId: claim.userId, phone: claim.user.phone }], "SMS", `Co ${claim.class.name} da xac nhan ban la phu huynh cua be ${claim.studentName}. Mo app de nho don ho.`, "/phu-huynh");
  });
}
