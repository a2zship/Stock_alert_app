// Đọc dữ liệu cho từng màn hình. Mọi hàm nhận userId và tự lọc theo quyền.
import { cookies } from "next/headers";
import { cache } from "react";
import { canSeeDropAddress, showDrop } from "@/domain/drop";
import { GATE_VERIFY_TTL_MS } from "@/domain/state";
import { vnDayRange, vnToday } from "@/domain/time";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { isGuardian, isTeacherOfStudent } from "./access";
import { appSecret, db } from "./db";
import { sweep } from "./requests";
import { unseal } from "./seal";

export type Me = Awaited<ReturnType<typeof loadMe>>;

async function loadMe(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      guardianOf: { include: { student: { include: { class: true } } } },
      teaches: { include: { class: { include: { school: true } } } },
    },
  });
  if (!user) return null;
  const delegateCount = await db.pickupRequest.count({ where: { delegateId: userId } });
  return {
    ...user,
    isParent: user.guardianOf.length > 0,
    isTeacher: user.teaches.length > 0,
    isDelegate: delegateCount > 0,
  };
}

/** Người đang đăng nhập (null nếu chưa). Gọi nhiều lần trong một request chỉ truy vấn một lần. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = await readSession(process.env.APP_SECRET, token);
  return userId ? loadMe(userId) : null;
});

const requestInclude = { student: { include: { class: true } }, requester: true } as const;

export async function parentHome(userId: string) {
  await sweep();
  const studentIds = (await db.guardian.findMany({ where: { userId }, select: { studentId: true } })).map((g) => g.studentId);
  const [students, active, recent] = await Promise.all([
    db.student.findMany({ where: { id: { in: studentIds } }, include: { class: { include: { school: true } } }, orderBy: { name: "asc" } }),
    db.pickupRequest.findMany({ where: { studentId: { in: studentIds }, status: { in: ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA", "DA_GIAO"] } }, include: requestInclude, orderBy: { windowStart: "asc" } }),
    db.pickupRequest.findMany({ where: { studentId: { in: studentIds }, status: { in: ["HOAN_TAT", "NGUOI_DON_TU_CHOI", "GV_TU_CHOI", "DA_HUY", "HET_HAN", "KHONG_GIAO_DUOC"] } }, include: requestInclude, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { students, active, recent };
}

export async function parentTrusted(userId: string) {
  const studentIds = (await db.guardian.findMany({ where: { userId }, select: { studentId: true } })).map((g) => g.studentId);
  return db.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      class: { include: { school: true } },
      trusted: { where: { status: { in: ["CHO_DUYET", "DA_DUYET", "TU_CHOI"] } }, orderBy: { createdAt: "asc" } },
      blocked: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { name: "asc" },
  });
}

export async function delegateInbox(userId: string) {
  await sweep();
  return db.pickupRequest.findMany({ where: { delegateId: userId }, include: requestInclude, orderBy: [{ windowStart: "desc" }], take: 30 });
}

export async function teacherToday(userId: string, now = new Date()) {
  await sweep(now);
  const classIds = (await db.teacherAssignment.findMany({ where: { userId }, select: { classId: true } })).map((t) => t.classId);
  const { start, end } = vnDayRange(vnToday(now));
  const [today, waiting, pendingTrusted] = await Promise.all([
    db.pickupRequest.findMany({ where: { student: { classId: { in: classIds } }, windowStart: { gte: start, lte: end } }, include: requestInclude, orderBy: { windowStart: "asc" } }),
    // yêu cầu chờ duyệt cho các ngày tới
    db.pickupRequest.findMany({ where: { student: { classId: { in: classIds } }, status: "CHO_GIAO_VIEN", windowStart: { gt: end } }, include: requestInclude, orderBy: { windowStart: "asc" } }),
    db.trustedPerson.count({ where: { status: "CHO_DUYET", student: { classId: { in: classIds } } } }),
  ]);
  return { today, waiting, pendingTrusted };
}

export async function teacherTrusted(userId: string) {
  const classIds = (await db.teacherAssignment.findMany({ where: { userId }, select: { classId: true } })).map((t) => t.classId);
  return db.trustedPerson.findMany({
    where: { status: { in: ["CHO_DUYET", "DA_DUYET"] }, student: { classId: { in: classIds } } },
    include: { student: { include: { class: true, guardians: { include: { user: true } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

/** Một yêu cầu, nhìn từ góc của người đang xem. null = không có quyền (trả 404, không tiết lộ là có tồn tại). */
export async function requestView(userId: string, id: string, now = new Date()) {
  await sweep(now);
  const r = await db.pickupRequest.findUnique({
    where: { id },
    include: {
      student: { include: { class: { include: { school: true } }, guardians: { include: { user: true } } } },
      requester: true,
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!r) return null;
  const asParent = await isGuardian(userId, r.studentId);
  const asTeacher = await isTeacherOfStudent(userId, r.studentId);
  const asDelegate = r.delegateId === userId;
  if (!asParent && !asTeacher && !asDelegate) return null;

  const actorIds = [...new Set(r.events.map((e) => e.actorId).filter((x): x is string => !!x))];
  const actors = new Map((await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  const codes = asDelegate && r.status === "DA_DUYET" && r.codeSealed ? unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed) : null;
  const gateReady = asTeacher && r.status === "DA_DUYET" && r.gateVerifiedById === userId && !!r.gateVerifiedAt && now.getTime() - r.gateVerifiedAt.getTime() <= GATE_VERIFY_TTL_MS;
  const trusted = r.trustedPersonId ? await db.trustedPerson.findUnique({ where: { id: r.trustedPersonId }, select: { reviewedAt: true } }) : null;

  // Người đón chưa được duyệt chỉ thấy phường/xã của điểm trả
  const seeDrop = canSeeDropAddress(r.status, { guardian: asParent, teacher: asTeacher, delegate: asDelegate });
  const drop = r.dropWard
    ? { label: r.dropLabel ?? "Điểm trả", ward: r.dropWard, address: seeDrop && r.dropAddress ? showDrop({ address: r.dropAddress, ward: r.dropWard }) : null, pinned: seeDrop && r.dropLat != null }
    : null;

  return {
    r: seeDrop ? r : { ...r, dropAddress: null, dropLat: null, dropLng: null },
    asParent, asTeacher, asDelegate, codes, gateReady, drop,
    trustedReviewedAt: trusted?.reviewedAt ?? null,
    actorName: (id: string | null) => (id ? actors.get(id) ?? "Người dùng" : "Hệ thống"),
  };
}

export async function inbox(userId: string) {
  const items = await db.message.findMany({ where: { toUserId: userId }, orderBy: { createdAt: "desc" }, take: 50 });
  await db.message.updateMany({ where: { toUserId: userId, readAt: null }, data: { readAt: new Date() } });
  return items;
}

export async function devInbox() {
  return db.message.findMany({ where: { channel: "SMS" }, orderBy: { createdAt: "desc" }, take: 40 });
}
