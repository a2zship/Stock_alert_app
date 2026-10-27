// Danh sách người tin cậy (GV duyệt một lần) và danh sách người không được đón.
import { normalizePhone } from "@/domain/phone";
import { parseDataUrl } from "@/domain/photo";
import { requireGuardian, requireTeacher } from "./access";
import { AppError, db } from "./db";
import { guardiansOf, notify, teachersOf } from "./notify";

export type TrustedInput = { studentId: string; name: string; phone: string; relation: string; cccdLast4: string; photo: string };

export async function addTrusted(parentId: string, input: TrustedInput): Promise<string> {
  await requireGuardian(parentId, input.studentId);
  const phone = normalizePhone(input.phone);
  const name = input.name.trim();
  const relation = input.relation.trim();
  if (name.length < 2) throw new AppError("Nhập họ tên người tin cậy.");
  if (!phone) throw new AppError("Số điện thoại chưa đúng.");
  if (!relation) throw new AppError("Nhập quan hệ với trẻ.");
  if (!/^\d{4}$/.test(input.cccdLast4)) throw new AppError("Nhập đúng 4 số cuối CCCD.");
  const p = parseDataUrl(input.photo ?? "");
  if ("error" in p) throw new AppError(input.photo ? p.error : "Cần ảnh chân dung để giáo viên nhận diện.");

  if (await db.blockedPerson.findFirst({ where: { studentId: input.studentId, phone } })) {
    throw new AppError("Số này nằm trong danh sách KHÔNG ĐƯỢC ĐÓN của trẻ.");
  }
  if (await db.trustedPerson.findFirst({ where: { studentId: input.studentId, phone, status: { in: ["CHO_DUYET", "DA_DUYET"] } } })) {
    throw new AppError("Người này đã có trong danh sách.");
  }

  return db.$transaction(async (tx) => {
    const photo = await tx.photo.create({ data: { kind: "CHAN_DUNG", mime: p.mime, bytes: p.bytes, ownerId: parentId } });
    const t = await tx.trustedPerson.create({
      data: { studentId: input.studentId, addedById: parentId, name, phone, relation, cccdLast4: input.cccdLast4, photoId: photo.id },
    });
    await tx.auditLog.create({ data: { actorId: parentId, action: "THEM_NGUOI_TIN_CAY", target: t.id } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });
    await notify(tx, await teachersOf(tx, input.studentId), "PUSH", `Phụ huynh bé ${student.name} xin thêm người tin cậy: ${name} (${relation}). Cần cô/thầy duyệt.`, "/giao-vien/nguoi-tin-cay");
    return t.id;
  });
}

export async function reviewTrusted(teacherId: string, trustedId: string, approve: boolean, note = "") {
  const t = await db.trustedPerson.findUniqueOrThrow({ where: { id: trustedId }, include: { student: true } });
  await requireTeacher(teacherId, t.studentId);
  if (t.status !== "CHO_DUYET") throw new AppError("Người này đã được xử lý rồi.");
  if (!approve && note.trim().length < 3) throw new AppError("Ghi lý do không duyệt để phụ huynh biết.");
  await db.$transaction(async (tx) => {
    const res = await tx.trustedPerson.updateMany({
      where: { id: t.id, status: "CHO_DUYET" },
      data: { status: approve ? "DA_DUYET" : "TU_CHOI", reviewedById: teacherId, reviewedAt: new Date(), reviewNote: note.trim() || null },
    });
    if (res.count !== 1) throw new AppError("Người này vừa được xử lý.");
    await tx.auditLog.create({ data: { actorId: teacherId, action: approve ? "DUYET_NGUOI_TIN_CAY" : "TU_CHOI_NGUOI_TIN_CAY", target: t.id, meta: { note } } });
    await notify(tx, await guardiansOf(tx, t.studentId), "PUSH",
      approve ? `${t.name} đã được duyệt vào danh sách tin cậy của bé ${t.student.name}.` : `${t.name} KHÔNG được duyệt. Lý do: ${note}`, "/nguoi-tin-cay");
  });
}

export async function removeTrusted(parentId: string, trustedId: string) {
  const t = await db.trustedPerson.findUniqueOrThrow({ where: { id: trustedId } });
  await requireGuardian(parentId, t.studentId);
  await db.$transaction([
    db.trustedPerson.update({ where: { id: t.id }, data: { status: "DA_XOA" } }),
    db.auditLog.create({ data: { actorId: parentId, action: "XOA_NGUOI_TIN_CAY", target: t.id } }),
  ]);
}

/** Phụ huynh chỉ được THÊM người cấm; gỡ ra phải qua nhà trường (tránh một phụ huynh gỡ lệnh cấm của người kia). */
export async function addBlocked(parentId: string, input: { studentId: string; name: string; phone?: string; note?: string }) {
  await requireGuardian(parentId, input.studentId);
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Nhập họ tên người không được đón.");
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new AppError("Số điện thoại chưa đúng (có thể để trống).");
  await db.$transaction(async (tx) => {
    const b = await tx.blockedPerson.create({ data: { studentId: input.studentId, addedById: parentId, name, phone, note: (input.note ?? "").trim() } });
    if (phone) await tx.trustedPerson.updateMany({ where: { studentId: input.studentId, phone, status: { in: ["CHO_DUYET", "DA_DUYET"] } }, data: { status: "DA_XOA" } });
    await tx.auditLog.create({ data: { actorId: parentId, action: "THEM_NGUOI_CAM", target: b.id } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });
    await notify(tx, [...(await teachersOf(tx, input.studentId)), ...(await guardiansOf(tx, input.studentId))], "PUSH",
      `Đã thêm "${name}" vào danh sách KHÔNG ĐƯỢC ĐÓN bé ${student.name}.`, "/nguoi-tin-cay");
  });
}
