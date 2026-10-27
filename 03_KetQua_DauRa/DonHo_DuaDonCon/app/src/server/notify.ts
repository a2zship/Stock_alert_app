// Gửi thông báo. Bản mẫu chưa nối nhà mạng/Zalo ZNS/Web Push: mọi tin được ghi vào bảng Message
// và hiện ở "Hộp tin" của người nhận (+ "Hộp tin thử nghiệm" /thu-nghiem khi DEV_INBOX=1).
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient;
export type Recipient = { userId?: string | null; phone: string };

export async function notify(tx: Tx, to: Recipient[], channel: "SMS" | "PUSH", body: string, link?: string) {
  const seen = new Set<string>();
  const rows = to.filter((r) => !seen.has(r.phone) && seen.add(r.phone));
  if (rows.length === 0) return;
  await tx.message.createMany({ data: rows.map((r) => ({ toPhone: r.phone, toUserId: r.userId ?? null, channel, body, link })) });
}

/** Mọi người giám hộ của trẻ */
export async function guardiansOf(tx: Tx, studentId: string): Promise<Recipient[]> {
  const gs = await tx.guardian.findMany({ where: { studentId }, include: { user: true } });
  return gs.map((g) => ({ userId: g.userId, phone: g.user.phone }));
}

/** Giáo viên phụ trách lớp của trẻ */
export async function teachersOf(tx: Tx, studentId: string): Promise<Recipient[]> {
  const s = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { classId: true } });
  const ts = await tx.teacherAssignment.findMany({ where: { classId: s.classId }, include: { user: true } });
  return ts.map((t) => ({ userId: t.userId, phone: t.user.phone }));
}

export async function unreadCount(userId: string): Promise<number> {
  return db.message.count({ where: { toUserId: userId, readAt: null } });
}
