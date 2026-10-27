// Kiểm quyền ở máy chủ — giao diện ẩn nút không phải là bảo mật. Quyền luôn tính theo trẻ / lớp cụ thể.
import { AppError, db } from "./db";

export async function isGuardian(userId: string, studentId: string): Promise<boolean> {
  return (await db.guardian.count({ where: { userId, studentId } })) > 0;
}

export async function isTeacherOfStudent(userId: string, studentId: string): Promise<boolean> {
  const s = await db.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!s) return false;
  return (await db.teacherAssignment.count({ where: { userId, classId: s.classId } })) > 0;
}

export async function requireGuardian(userId: string, studentId: string) {
  if (!(await isGuardian(userId, studentId))) throw new AppError("Bạn không phải người giám hộ của trẻ này.");
}

export async function requireTeacher(userId: string, studentId: string) {
  if (!(await isTeacherOfStudent(userId, studentId))) throw new AppError("Bạn không phụ trách lớp của trẻ này.");
}

/** Ảnh chỉ người liên quan mới xem được: chủ ảnh, phụ huynh và GV của trẻ, người đón (ảnh của chính họ). */
export async function canViewPhoto(userId: string, photoId: string): Promise<boolean> {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { ownerId: true } });
  if (!photo) return false;
  if (photo.ownerId === userId) return true;

  // Ảnh hồ sơ người đón có phí: GV lớp có con của người đó (để duyệt)
  const hp = await db.helperProfile.findFirst({ where: { photoId }, select: { userId: true } });
  if (hp && (await db.teacherAssignment.count({ where: { userId, class: { students: { some: { guardians: { some: { userId: hp.userId } } } } } } }))) return true;

  const studentIds = new Set<string>();
  for (const t of await db.trustedPerson.findMany({ where: { photoId }, select: { studentId: true } })) studentIds.add(t.studentId);
  for (const s of await db.student.findMany({ where: { photoId }, select: { id: true } })) studentIds.add(s.id);
  const reqs = await db.pickupRequest.findMany({
    where: { OR: [{ delegatePhotoId: photoId }, { handoverPhotoId: photoId }] },
    select: { studentId: true, delegateId: true, delegatePhotoId: true },
  });
  for (const r of reqs) {
    if (r.delegateId === userId && r.delegatePhotoId === photoId) return true;
    studentIds.add(r.studentId);
  }
  for (const sid of studentIds) {
    if ((await isGuardian(userId, sid)) || (await isTeacherOfStudent(userId, sid))) return true;
  }
  return false;
}
