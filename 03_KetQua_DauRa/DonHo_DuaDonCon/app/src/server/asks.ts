// Phát lời nhờ đón hộ theo vòng LỚP → TRƯỜNG → KHU VỰC SỐNG (quy tắc ở domain/ask.ts).
// Tự mở rộng khi có người mở app (sweep) — bản mẫu chưa có lịch chạy nền; người nhờ cũng có thể bấm mở rộng sớm.
// Ngoài lớp KHÔNG hiện tên bé và địa chỉ; chỉ phụ huynh đã được cô xác nhận (có con trong hệ thống) mới thấy và nhận.
import type { ChatPost, Prisma } from "@prisma/client";
import { dueEscalation, escalatesAt, nextScope, reaches, viewerScope, type AskScope } from "@/domain/ask";
import { showWindow, vnDateTime, vnToday } from "@/domain/time";
import { AppError, db } from "./db";
import { notify, type Recipient } from "./notify";

type Tx = Prisma.TransactionClient;
const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;

type AskPost = ChatPost & { class: { id: string; name: string; schoolId: string; pickupStart: string; pickupEnd: string }; author: { name: string } };

/** Người nhận tin khi lời nhờ lên vòng `scope` (không gồm người đã được báo ở vòng trước). */
async function newAudience(tx: Tx, p: AskPost, scope: AskScope): Promise<Recipient[]> {
  const out = (rows: { id: string; phone: string }[]) => rows.filter((u) => u.id !== p.authorId).map((u) => ({ userId: u.id, phone: u.phone }));
  if (scope === "TRUONG") {
    const parents = await tx.user.findMany({
      where: { guardianOf: { some: { student: { class: { schoolId: p.class.schoolId } } } }, NOT: { guardianOf: { some: { student: { classId: p.classId } } } } },
      select: { id: true, phone: true },
    });
    if (!p.fee) return out(parents);
    // có thù lao: thêm người đón có phí đã duyệt của trường (có thể chưa có con ở lớp khác)
    const helpers = await tx.user.findMany({ where: { helper: { schoolId: p.class.schoolId, status: "DA_DUYET" }, NOT: { guardianOf: { some: { student: { classId: p.classId } } } } }, select: { id: true, phone: true } });
    return out([...parents, ...helpers.filter((h) => !parents.some((x) => x.id === h.id))]);
  }
  if (scope === "KHU_VUC" && p.areaWardId) {
    return out(await tx.user.findMany({
      where: { wardId: p.areaWardId, guardianOf: { some: {} }, NOT: { guardianOf: { some: { student: { class: { schoolId: p.class.schoolId } } } } } },
      select: { id: true, phone: true },
    }));
  }
  return [];
}

async function moveTo(p: AskPost, scope: AskScope, now: Date, by: "HE_THONG" | "NGUOI_NHO") {
  const when = showWindow(vnDateTime(p.date!, p.class.pickupStart), vnDateTime(p.date!, p.class.pickupEnd));
  await db.$transaction(async (tx) => {
    // chỉ một lần chuyển vòng dù nhiều người cùng mở app
    const moved = await tx.chatPost.updateMany({ where: { id: p.id, status: "MO", scope: p.scope }, data: { scope, scopeAt: now } });
    if (moved.count !== 1) return;
    const where = scope === "TRUONG" ? "cả trường" : "phụ huynh cùng phường/xã";
    const body = `${p.author.name} cần người đón giúp một bé ${p.class.name} lúc ${when}${p.dropWard ? `, trả bé ở ${p.dropWard}` : ""}${p.fee ? `, thù lao từ ${vnd(p.fee)}` : ""}. Bạn tiện đường thì bấm nhận.`;
    await notify(tx, await newAudience(tx, p, scope), "PUSH", body, "/nhom#quanh-ban");
    const author = await tx.user.findUniqueOrThrow({ where: { id: p.authorId } });
    await notify(tx, [{ userId: author.id, phone: author.phone }], "PUSH",
      by === "HE_THONG" ? `Chưa ai trong ${scope === "TRUONG" ? "lớp" : "trường"} nhận lời nhờ, app đã gửi tiếp tới ${where}.` : `Đã gửi lời nhờ tới ${where}.`,
      `/nhom?lop=${p.classId}#p-${p.id}`);
    await tx.auditLog.create({ data: { actorId: by === "NGUOI_NHO" ? p.authorId : null, action: "MO_RONG_LOI_NHO", target: p.id, meta: { scope, by } } });
  });
}

const askInclude = { class: true, author: { select: { name: true } }, _count: { select: { offers: true } } } as const;

/** Tự mở rộng các lời nhờ tới hạn (gọi trong sweep). */
export async function escalateAsks(now = new Date()) {
  const posts = await db.chatPost.findMany({
    where: { kind: "NHO_DON", status: "MO", scope: { not: "KHU_VUC" }, date: { gte: vnToday(now) } },
    include: askInclude,
  });
  for (const p of posts) {
    const next = dueEscalation({ scope: p.scope, scopeAt: p.scopeAt, fee: p.fee, offers: p._count.offers,
      pickupStart: vnDateTime(p.date!, p.class.pickupStart), pickupEnd: vnDateTime(p.date!, p.class.pickupEnd) }, now);
    // người nhờ chưa chọn khu vực sống: không có vòng khu vực để gửi
    if (next && !(next === "KHU_VUC" && !p.areaWardId)) await moveTo(p, next, now, "HE_THONG");
  }
}

/** Người nhờ bấm mở rộng sớm — vẫn đi đúng thứ tự, mỗi lần một vòng. */
export async function widenAsk(userId: string, postId: string, now = new Date()) {
  const p = await db.chatPost.findUnique({ where: { id: postId }, include: askInclude });
  if (!p || p.kind !== "NHO_DON" || p.authorId !== userId) throw new AppError("Chỉ người đăng mới mở rộng được lời nhờ.");
  if (p.status !== "MO") throw new AppError("Lời nhờ đã có người nhận hoặc đã đóng.");
  if (vnDateTime(p.date!, p.class.pickupEnd) <= now) throw new AppError("Đã qua giờ đón.");
  const next = nextScope(p.scope, p.fee);
  if (!next) throw new AppError(p.fee ? "Lời nhờ có thù lao chỉ gửi trong trường (người đón có phí được duyệt theo trường)." : "Lời nhờ đã gửi tới vòng rộng nhất.");
  if (next === "KHU_VUC" && !p.areaWardId) throw new AppError("Bạn chưa chọn khu vực sống. Vào \"Khu vực của tôi\" để chọn.");
  await moveTo(p, next, now, "NGUOI_NHO");
  return next;
}

/** Người này đứng ở vòng nào so với lời nhờ (null = ngoài phạm vi). Chỉ phụ huynh đã được cô xác nhận mới tính trường/khu vực. */
export async function scopeOf(userId: string, p: Pick<ChatPost, "classId" | "areaWardId">, schoolId: string): Promise<AskScope | null> {
  const [inClass, inSchool, me] = await Promise.all([
    db.guardian.count({ where: { userId, student: { classId: p.classId } } }),
    db.guardian.count({ where: { userId, student: { class: { schoolId } } } }),
    db.user.findUnique({ where: { id: userId }, select: { wardId: true, _count: { select: { guardianOf: true } } } }),
  ]);
  return viewerScope({ sameClass: inClass > 0, sameSchool: inSchool > 0, sameWard: !!me && me._count.guardianOf > 0 && !!p.areaWardId && me.wardId === p.areaWardId });
}

/** Lời nhờ đã mở tới vòng của người này chưa → được nhận. */
export async function canReach(userId: string, p: Pick<ChatPost, "classId" | "areaWardId" | "scope">, schoolId: string) {
  const v = await scopeOf(userId, p, schoolId);
  return v ? { ok: reaches(p.scope, v), viewer: v } : { ok: false, viewer: null };
}

/** "Quanh bạn": lời nhờ từ lớp khác cùng trường + từ phụ huynh cùng phường/xã — không có tên bé, không có địa chỉ. */
export async function asksAround(userId: string, now = new Date()) {
  const me = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { wardId: true, guardianOf: { select: { studentId: true, student: { select: { classId: true, class: { select: { schoolId: true } } } } } } },
  });
  if (me.guardianOf.length === 0) return [];
  const myClasses = [...new Set(me.guardianOf.map((g) => g.student.classId))];
  const mySchools = [...new Set(me.guardianOf.map((g) => g.student.class.schoolId))];
  const posts = await db.chatPost.findMany({
    where: {
      kind: "NHO_DON", status: "MO", date: { gte: vnToday(now) }, authorId: { not: userId }, classId: { notIn: myClasses },
      OR: [
        { scope: { in: ["TRUONG", "KHU_VUC"] }, class: { schoolId: { in: mySchools } } },
        ...(me.wardId ? [{ scope: "KHU_VUC" as const, areaWardId: me.wardId }] : []),
      ],
    },
    include: { class: { include: { school: true } }, author: { select: { name: true } }, offers: { select: { userId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const helper = await db.helperProfile.findUnique({ where: { userId } });
  return posts
    .filter((p) => vnDateTime(p.date!, p.class.pickupEnd) > now)
    .map((p) => ({
      id: p.id, scope: p.scope, author: p.author.name, className: p.class.name, school: p.class.school.name,
      sameSchool: mySchools.includes(p.class.schoolId),
      when: showWindow(vnDateTime(p.date!, p.class.pickupStart), vnDateTime(p.date!, p.class.pickupEnd)),
      ward: p.dropWard, fee: p.fee, note: p.body, offers: p.offers.length,
      offered: p.offers.some((o) => o.userId === userId),
      needHelper: !!p.fee && helper?.status !== "DA_DUYET",
    }));
}

/** Thông tin vòng để hiện trên lời nhờ trong nhóm lớp. */
export function scopeView(p: Pick<ChatPost, "scope" | "scopeAt" | "fee" | "date" | "areaWardId">, pickupStart: string) {
  const at = escalatesAt({ scope: p.scope, scopeAt: p.scopeAt, fee: p.fee, pickupStart: vnDateTime(p.date!, pickupStart) });
  const next = nextScope(p.scope, p.fee);
  return { scope: p.scope, next: next === "KHU_VUC" && !p.areaWardId ? null : next, nextAt: at };
}
