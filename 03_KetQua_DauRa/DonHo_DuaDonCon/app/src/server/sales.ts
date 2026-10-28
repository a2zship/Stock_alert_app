// Hệ thống tự bán: nhà trường tự mở trường trên app → thêm lớp, mời cô → bộ khởi động mỗi lớp (đường dẫn, áp phích QR, tin mẫu)
// → phễu cho quản trị nền tảng (bước của từng trường, nhu cầu phụ huynh đề xuất) → nhắc việc tự động khi một bước bị kẹt.
// Trường tự mở là "chưa xác minh": dùng được luồng miễn phí ngay; đón có phí và chuyển chia sẻ chỉ mở sau khi quản trị gọi xác minh.
import type { Prisma } from "@prisma/client";
import { parseArea, parseName, type AreaInput } from "@/domain/area";
import { normalizePhone } from "@/domain/phone";
import {
  ascii, DEMAND_MIN, msgHelpers, msgInviteSchool, msgParents, normSchoolName, nudgeDue, parseClass, schoolStage, stageIndex,
  type SchoolCounts, type Stage,
} from "@/domain/sales";
import { resolveArea } from "./area";
import { consumeOtp, requestOtp } from "./auth";
import { AppError, db, publicUrl } from "./db";
import { notify, type Recipient } from "./notify";
import { requireAdmin } from "./share";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;
const daysAgo = (now: Date, d: number) => new Date(now.getTime() - d * DAY);
const clean = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

const must = <T>(v: T | { error: string }): T => {
  if (v && typeof v === "object" && "error" in v) throw new AppError(v.error);
  return v as T;
};

// ─────────────────────────── Mở trường ───────────────────────────

export type OpenSchoolInput = AreaInput & { name?: unknown; phone?: unknown; address?: unknown };

function parseSchool(i: OpenSchoolInput) {
  const area = must(parseArea({ ...i, schoolId: "" }));
  if (!area.schoolName) throw new AppError("Ghi tên trường, ví dụ: Trường Mầm non Hoa Mai.");
  const address = clean(i.address);
  if (address.length > 160) throw new AppError("Địa chỉ quá dài.");
  return { area, schoolName: area.schoolName, address };
}

/** Trường cùng tên (đã chuẩn hoá) trong cùng phường/xã thì không mở lần nữa — tránh hai "bản sao" của một trường. */
async function assertNewSchool(tx: Tx | typeof db, wardId: number | null, name: string) {
  if (!wardId) return;
  const key = normSchoolName(name);
  const same = (await tx.school.findMany({ where: { wardId }, select: { name: true } })).find((s) => normSchoolName(s.name) === key);
  if (same) throw new AppError(`${same.name} đã có trên Đón Hộ. Nếu bạn ở ban giám hiệu, liên hệ Đón Hộ để được thêm quyền quản lý trường.`);
}

const adminRecipients = async (tx: Tx): Promise<Recipient[]> => {
  const phones = (process.env.ADMIN_PHONES ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return (await tx.user.findMany({ where: { phone: { in: phones } } })).map((u) => ({ userId: u.id, phone: u.phone }));
};

async function createSchool(tx: Tx, userId: string, s: ReturnType<typeof parseSchool>, now: Date) {
  const where = await resolveArea(tx, s.area);
  await assertNewSchool(tx, where.wardId, s.schoolName);
  const school = await tx.school.create({ data: { wardId: where.wardId, name: s.schoolName, address: s.address, verified: false, createdById: userId, createdAt: now } });
  await tx.schoolAdmin.create({ data: { userId, schoolId: school.id } });
  const me = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (!me.schoolId) await tx.user.update({ where: { id: userId }, data: { schoolId: school.id, pendingSchool: null, ...(me.provinceId ? {} : { provinceId: where.provinceId, wardId: where.wardId }) } });

  // Phụ huynh đã đề xuất đúng trường này ở cùng phường/xã: gắn trường và báo họ chọn lớp
  const key = normSchoolName(s.schoolName);
  const waiting = (await tx.user.findMany({ where: { wardId: where.wardId, schoolId: null, pendingSchool: { not: null }, id: { not: userId } } }))
    .filter((u) => normSchoolName(u.pendingSchool!) === key);
  if (waiting.length) {
    await tx.user.updateMany({ where: { id: { in: waiting.map((u) => u.id) } }, data: { schoolId: school.id, pendingSchool: null } });
    await notify(tx, waiting.map((u) => ({ userId: u.id, phone: u.phone })), "PUSH",
      `${school.name} vừa mở trên Đón Hộ. Vào Khu vực của tôi để chọn lớp của con và gửi cô xác nhận.`, "/khu-vuc");
  }
  await notify(tx, await adminRecipients(tx), "PUSH", `Trường mới tự mở: ${school.name}. Gọi xác minh trước khi mở đón có phí.`, "/quan-tri/truong");
  await tx.auditLog.create({ data: { actorId: userId, action: "MO_TRUONG", target: school.id, meta: { name: school.name, wardId: where.wardId, linkedParents: waiting.length } } });
  return school.id;
}

/** Bước 1 (chưa đăng nhập): kiểm form, chưa ghi gì, rồi gửi mã xác minh số điện thoại. */
export async function startOpenSchool(input: OpenSchoolInput, now = new Date()) {
  must(parseName(input.name));
  const s = parseSchool(input);
  await assertNewSchool(db, s.area.wardId, s.schoolName);
  return requestOtp(String(input.phone ?? ""), now, { signup: true });
}

/** Bước 2: đúng mã → tạo tài khoản (nếu chưa có) + trường chưa xác minh + quyền ban giám hiệu. */
export async function finishOpenSchool(input: OpenSchoolInput & { code?: unknown }, now = new Date()) {
  const name = must(parseName(input.name));
  const s = parseSchool(input);
  const phone = await consumeOtp(String(input.phone ?? ""), clean(input.code).replace(/\s/g, ""), now);
  return db.$transaction(async (tx) => {
    const user = (await tx.user.findUnique({ where: { phone } })) ?? (await tx.user.create({ data: { phone, name } }));
    const schoolId = await createSchool(tx, user.id, s, now);
    return { userId: user.id, schoolId };
  });
}

/** Người đã đăng nhập mở thêm trường. */
export async function openSchool(userId: string, input: OpenSchoolInput, now = new Date()) {
  const s = parseSchool(input);
  return db.$transaction((tx) => createSchool(tx, userId, s, now));
}

// ─────────────────────────── Ban giám hiệu: lớp và cô ───────────────────────────

async function requireSchoolAdmin(userId: string, schoolId: string) {
  if (!(await db.schoolAdmin.count({ where: { userId, schoolId } }))) throw new AppError("Chỉ ban giám hiệu của trường làm được việc này.");
}

export async function addClass(userId: string, schoolId: string, input: { name?: unknown; pickupStart?: unknown; pickupEnd?: unknown }) {
  await requireSchoolAdmin(userId, schoolId);
  const c = must(parseClass(input));
  if (await db.class.count({ where: { schoolId, name: { equals: c.name, mode: "insensitive" } } })) throw new AppError(`Trường đã có lớp ${c.name}.`);
  return (await db.class.create({ data: { schoolId, ...c } })).id;
}

/** Thêm cô phụ trách lớp bằng số điện thoại: số chưa có tài khoản thì tạo sẵn để cô đăng nhập bằng mã gửi về số đó. */
export async function addTeacher(userId: string, classId: string, input: { name?: unknown; phone?: unknown }) {
  const cls = await db.class.findUnique({ where: { id: classId }, include: { school: { include: { ward: true } } } });
  if (!cls) throw new AppError("Không tìm thấy lớp.");
  await requireSchoolAdmin(userId, cls.schoolId);
  const name = must(parseName(input.name));
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!phone) throw new AppError("Số điện thoại chưa đúng. Nhập 10 số, ví dụ 0901 234 567.");
  await db.$transaction(async (tx) => {
    const teacher = (await tx.user.findUnique({ where: { phone } }))
      ?? (await tx.user.create({ data: { phone, name, schoolId: cls.schoolId, wardId: cls.school.wardId, provinceId: cls.school.ward.provinceId } }));
    if (await tx.teacherAssignment.count({ where: { userId: teacher.id, classId } })) throw new AppError(`${teacher.name} đã phụ trách lớp ${cls.name}.`);
    await tx.teacherAssignment.create({ data: { userId: teacher.id, classId } });
    await tx.auditLog.create({ data: { actorId: userId, action: "THEM_GIAO_VIEN", target: teacher.id, meta: { classId } } });
    await notify(tx, [{ userId: teacher.id, phone }], "SMS",
      `${ascii(cls.school.name)} moi ban phu trach lop ${ascii(cls.name)} tren Don Ho. Dang nhap bang so nay: ${publicUrl()}/dang-nhap`, "/giao-vien");
  });
}

export async function removeTeacher(userId: string, classId: string, teacherId: string) {
  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls) throw new AppError("Không tìm thấy lớp.");
  await requireSchoolAdmin(userId, cls.schoolId);
  await db.$transaction(async (tx) => {
    const r = await tx.teacherAssignment.deleteMany({ where: { userId: teacherId, classId } });
    if (!r.count) throw new AppError("Người này không phụ trách lớp.");
    await tx.auditLog.create({ data: { actorId: userId, action: "BO_GIAO_VIEN", target: teacherId, meta: { classId } } });
  });
}

// ─────────────────────────── Bước của trường ───────────────────────────

/** Số liệu tính bước cho nhiều trường một lượt. Lượt đón và doanh thu: 30 ngày gần nhất (trường ngừng dùng thì tụt bước). */
async function countsFor(schoolIds: string[], now: Date): Promise<Map<string, SchoolCounts>> {
  const since = daysAgo(now, 30);
  const where = { schoolId: { in: schoolIds } };
  const [teachers, parents, helpers, pickups, revenue] = await Promise.all([
    db.teacherAssignment.findMany({ where: { class: where }, select: { userId: true, class: { select: { schoolId: true } } } }),
    db.guardian.findMany({ where: { student: { class: where } }, select: { userId: true, student: { select: { class: { select: { schoolId: true } } } } } }),
    db.helperProfile.groupBy({ by: ["schoolId"], where: { ...where, status: "DA_DUYET" }, _count: { _all: true } }),
    db.pickupRequest.findMany({ where: { status: "HOAN_TAT", createdAt: { gte: since }, student: { class: where } }, select: { student: { select: { class: { select: { schoolId: true } } } } } }),
    db.shareEntry.groupBy({ by: ["schoolId"], where: { ...where, kind: "TRUONG", status: { not: "HUY" }, createdAt: { gte: since } }, _sum: { amount: true } }),
  ]);
  const m = new Map(schoolIds.map((id) => [id, { teachers: 0, parents: 0, helpers: 0, pickups: 0, revenue: 0 }]));
  const distinct = (rows: { sid: string; uid: string }[]) => {
    const seen = new Map<string, Set<string>>();
    for (const r of rows) seen.set(r.sid, (seen.get(r.sid) ?? new Set()).add(r.uid));
    return seen;
  };
  for (const [sid, set] of distinct(teachers.map((t) => ({ sid: t.class.schoolId, uid: t.userId })))) m.get(sid)!.teachers = set.size;
  for (const [sid, set] of distinct(parents.map((g) => ({ sid: g.student.class.schoolId, uid: g.userId })))) m.get(sid)!.parents = set.size;
  for (const h of helpers) m.get(h.schoolId)!.helpers = h._count._all;
  for (const p of pickups) m.get(p.student.class.schoolId)!.pickups++;
  for (const r of revenue) if (r.schoolId) m.get(r.schoolId)!.revenue = r._sum.amount ?? 0;
  return m;
}

/** Trang "Trường của tôi" cho ban giám hiệu. */
export async function schoolConsole(userId: string, now = new Date()) {
  const schools = await db.school.findMany({
    where: { admins: { some: { userId } } },
    include: {
      ward: { include: { province: true } },
      classes: { orderBy: { name: "asc" }, include: { teachers: { include: { user: true } }, _count: { select: { students: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const counts = await countsFor(schools.map((s) => s.id), now);
  return schools.map((s) => ({ ...s, counts: counts.get(s.id)!, stage: schoolStage(counts.get(s.id)!) }));
}

/** Bộ khởi động của một lớp: đường dẫn đăng ký điền sẵn trường/lớp, tin mẫu cho nhóm Zalo và cho người đón tiên phong. */
export async function classKit(userId: string, classId: string, now = new Date()) {
  const cls = await db.class.findUnique({ where: { id: classId }, include: { school: true, teachers: { include: { user: true } } } });
  if (!cls) throw new AppError("Không tìm thấy lớp.");
  const isTeacher = cls.teachers.some((t) => t.userId === userId);
  const isAdmin = !!(await db.schoolAdmin.count({ where: { userId, schoolId: cls.schoolId } }));
  if (!isTeacher && !isAdmin) throw new AppError("Chỉ cô phụ trách lớp hoặc ban giám hiệu xem được bộ khởi động của lớp.");
  const url = `${publicUrl()}/dang-ky?lop=${cls.id}`;
  const counts = (await countsFor([cls.schoolId], now)).get(cls.schoolId)!;
  const [parents, waitingClaims] = await Promise.all([
    db.guardian.count({ where: { student: { classId } } }),
    db.guardianClaim.count({ where: { classId, status: "CHO_DUYET" } }),
  ]);
  const p = { school: cls.school.name, cls: cls.name, url };
  return { cls, url, isAdmin, parents, waitingClaims, stage: schoolStage(counts), counts, msgParents: msgParents(p), msgHelpers: msgHelpers(p) };
}

/** Điền sẵn bộ chọn khu vực khi phụ huynh mở đường dẫn của lớp. */
export async function classDefaults(classId: string) {
  const cls = await db.class.findUnique({ where: { id: classId }, include: { school: { include: { ward: true } } } });
  if (!cls) return null;
  return { provinceId: cls.school.ward.provinceId, wardId: cls.school.wardId, schoolId: cls.schoolId, classId: cls.id, label: `${cls.name} · ${cls.school.name}` };
}

// ─────────────────────────── Phễu cho quản trị nền tảng ───────────────────────────

/** Phụ huynh đề xuất trường chưa có trên app, gộp theo phường/xã + tên đã chuẩn hoá. */
export async function demandGroups() {
  const users = await db.user.findMany({
    where: { schoolId: null, pendingSchool: { not: null }, wardId: { not: null } },
    include: { ward: { include: { province: true } } },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, { key: string; wardId: number; ward: string; province: string; name: string; users: { id: string; phone: string }[] }>();
  for (const u of users) {
    const key = `${u.wardId}:${normSchoolName(u.pendingSchool!)}`;
    const g = groups.get(key) ?? { key, wardId: u.wardId!, ward: u.ward!.name, province: u.ward!.province.name, name: u.pendingSchool!, users: [] };
    g.users.push({ id: u.id, phone: u.phone });
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.users.length - a.users.length || a.name.localeCompare(b.name, "vi"));
}

export const inviteSchoolUrl = (g: { wardId: number; name: string }) =>
  `${publicUrl()}/mo-truong?phuong=${g.wardId}&ten=${encodeURIComponent(g.name)}`;

/** Phụ huynh đã đề xuất trường chưa có: tin mời nhà trường để tự gửi (trang Khu vực của tôi). */
export async function myDemand(userId: string) {
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (me.schoolId || !me.pendingSchool || !me.wardId) return null;
  const key = `${me.wardId}:${normSchoolName(me.pendingSchool)}`;
  const g = (await demandGroups()).find((x) => x.key === key);
  if (!g) return null;
  const url = inviteSchoolUrl(g);
  return { school: g.name, count: g.users.length, url, msg: msgInviteSchool({ school: g.name, count: g.users.length, url }) };
}

export async function funnel(adminId: string, now = new Date()) {
  await requireAdmin(adminId);
  const schools = await db.school.findMany({ include: { ward: { include: { province: true } }, _count: { select: { classes: true } } }, orderBy: { createdAt: "desc" } });
  const counts = await countsFor(schools.map((s) => s.id), now);
  const rows = schools.map((s) => ({ ...s, counts: counts.get(s.id)!, stage: schoolStage(counts.get(s.id)!) }));
  const byStage = new Map<Stage, number>();
  for (const r of rows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  const [demand, nudges] = await Promise.all([demandGroups(), db.nudge.findMany({ orderBy: { sentAt: "desc" }, take: 15 })]);
  return { rows, byStage, demand, nudges };
}

export async function verifySchool(adminId: string, schoolId: string) {
  await requireAdmin(adminId);
  const school = await db.school.findUnique({ where: { id: schoolId }, include: { admins: { include: { user: true } } } });
  if (!school) throw new AppError("Không tìm thấy trường.");
  if (school.verified) throw new AppError("Trường đã được xác minh.");
  await db.$transaction(async (tx) => {
    await tx.school.update({ where: { id: schoolId }, data: { verified: true } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "XAC_MINH_TRUONG", target: schoolId } });
    await notify(tx, school.admins.map((a) => ({ userId: a.userId, phone: a.user.phone })), "PUSH",
      `Đón Hộ đã xác minh ${school.name}. Phụ huynh của trường đã đăng ký được người đón có phí, trường nhận được chia sẻ doanh thu.`, "/truong");
  });
}

// ─────────────────────────── Nhắc việc tự động ───────────────────────────

/**
 * Chạy theo lịch (POST /api/nhac-viec) hoặc khi quản trị bấm. Mỗi loại × đối tượng tối đa 3 lần, cách nhau ≥ 7 ngày.
 * - Trường mở ≥ 2 ngày chưa có cô → nhắc ban giám hiệu.
 * - Lớp có cô, trường mở ≥ 3 ngày mà ít phụ huynh / thiếu người đón → nhắc cô kèm bộ khởi động của lớp.
 * - ≥ 3 phụ huynh cùng đề xuất một trường chưa có → nhắc từng người gửi đường dẫn mời nhà trường.
 */
export async function runNudges(now = new Date()) {
  let sent = 0;
  async function send(kind: string, target: string, to: Recipient[], body: string, link: string) {
    if (!to.length) return;
    const past = (await db.nudge.findMany({ where: { kind, target }, select: { sentAt: true } })).map((n) => n.sentAt);
    if (!nudgeDue(past, now)) return;
    await db.$transaction(async (tx) => {
      await tx.nudge.create({ data: { kind, target, sentAt: now } });
      await notify(tx, to, "PUSH", body, link);
    });
    sent++;
  }

  const schools = await db.school.findMany({
    where: { createdAt: { lte: daysAgo(now, 2) } },
    include: { admins: { include: { user: true } }, classes: { include: { teachers: { include: { user: true } } } } },
  });
  const counts = await countsFor(schools.map((s) => s.id), now);
  for (const s of schools) {
    const stage = schoolStage(counts.get(s.id)!);
    if (stage === "MOI_DANG_KY") {
      await send("truong-chua-co-co", s.id, s.admins.map((a) => ({ userId: a.userId, phone: a.user.phone })),
        `${s.name} đã mở trên Đón Hộ nhưng chưa có cô phụ trách lớp. Thêm lớp và số điện thoại cô để bắt đầu.`, "/truong");
      continue;
    }
    if (s.createdAt > daysAgo(now, 3) || stageIndex(stage) >= stageIndex("CO_NGUOI_DON")) continue;
    for (const c of s.classes) {
      const to = c.teachers.map((t) => ({ userId: t.userId, phone: t.user.phone }));
      if (stage === "CO_CO_GIAO") {
        await send("lop-it-phu-huynh", c.id, to, `Lớp ${c.name} còn ít phụ huynh trên Đón Hộ. Gửi đường dẫn hoặc áp phích QR của lớp vào nhóm Zalo phụ huynh.`, `/truong/lop/${c.id}`);
      } else {
        await send("thieu-nguoi-don", c.id, to, `Lớp ${c.name} chưa đủ người đón có phí. Gửi tin mời người đón tiên phong cho 2–3 phụ huynh hay đón sớm.`, `/truong/lop/${c.id}`);
      }
    }
  }

  for (const g of await demandGroups()) {
    if (g.users.length < DEMAND_MIN) continue;
    for (const u of g.users) {
      await send("de-xuat-truong", u.id, [{ userId: u.id, phone: u.phone }],
        `Đã có ${g.users.length} phụ huynh ở ${g.ward} đề xuất ${g.name} dùng Đón Hộ. Gửi đường dẫn này cho cô hoặc chủ trường để trường mở Đón Hộ (miễn phí, trường được chia 10% doanh thu): ${inviteSchoolUrl(g)}`,
        "/khu-vuc");
    }
  }
  return { sent };
}

/** Trường của người dùng có được xác minh chưa (đón có phí chỉ mở ở trường đã xác minh). */
export async function schoolVerified(schoolId: string) {
  return (await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { verified: true } })).verified;
}
