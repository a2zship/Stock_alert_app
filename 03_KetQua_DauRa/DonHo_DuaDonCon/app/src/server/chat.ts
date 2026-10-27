// Nhóm chat của lớp: phụ huynh + giáo viên lớp. Phụ huynh đăng "lời nhờ đón", phụ huynh khác bấm "Tôi đón giúp được",
// người nhờ chọn một người → tạo yêu cầu đón hộ bình thường (vẫn đủ 3 bên xác nhận + kiểm tại cổng).
// Lời nhờ phát theo vòng LỚP → TRƯỜNG → KHU VỰC SỐNG (domain/ask.ts, server/asks.ts): lớp trước, chưa ai nhận mới mở rộng.
// Số điện thoại KHÔNG hiện trong nhóm. Điểm trả: cả nhóm chỉ thấy phường/xã, địa chỉ chi tiết chỉ phụ huynh của bé thấy.
import { CLEAR_DROP, parseDrop, showDrop, type DropInput } from "@/domain/drop";
import { commissionOf, parseFee } from "@/domain/money";
import { computeReward, TIERS } from "@/domain/reward";
import { addDays, showWindow, vnDateTime, vnToday } from "@/domain/time";
import { requireGuardian } from "./access";
import { canReach, escalateAsks, scopeOf, scopeView } from "./asks";
import { jobRate } from "@/domain/membership";
import { AppError, db, platformRate } from "./db";
import { tiersOf } from "./membership";
import { requirePaidHelper } from "./earn";
import { notify } from "./notify";
import { createRequest } from "./requests";
import { rewardOf } from "./rewards";

/** Các lớp người này thuộc về: lớp của con (phụ huynh) + lớp mình dạy (giáo viên). */
export async function classesOf(userId: string) {
  const [asParent, asTeacher] = await Promise.all([
    db.class.findMany({ where: { students: { some: { guardians: { some: { userId } } } } }, include: { school: true } }),
    db.class.findMany({ where: { teachers: { some: { userId } } }, include: { school: true } }),
  ]);
  const map = new Map([...asParent, ...asTeacher].map((c) => [c.id, c]));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

async function membership(userId: string, classId: string) {
  const [parent, teacher] = await Promise.all([
    db.guardian.count({ where: { userId, student: { classId } } }),
    db.teacherAssignment.count({ where: { userId, classId } }),
  ]);
  if (!parent && !teacher) throw new AppError("Bạn không ở trong nhóm của lớp này.");
  return { parent: parent > 0, teacher: teacher > 0 };
}

async function classMembers(classId: string) {
  const [gs, ts] = await Promise.all([
    db.guardian.findMany({ where: { student: { classId } }, include: { user: true } }),
    db.teacherAssignment.findMany({ where: { classId }, include: { user: true } }),
  ]);
  return [...gs.map((g) => g.user), ...ts.map((t) => t.user)];
}

export async function postMessage(userId: string, classId: string, body: string) {
  await membership(userId, classId);
  const text = body.trim();
  if (!text) throw new AppError("Tin nhắn đang trống.");
  if (text.length > 500) throw new AppError("Tin nhắn tối đa 500 ký tự.");
  await db.chatPost.create({ data: { classId, authorId: userId, kind: "TIN_NHAN", body: text } });
}

/** Phụ huynh đăng lời nhờ đón: vòng đầu là nhóm lớp — nhắn thẳng từng phụ huynh, giáo viên cùng lớp. */
export async function postPickupAsk(userId: string, input: { studentId: string; date: string; note?: string; drop?: DropInput; fee?: string | number }, now = new Date()) {
  await requireGuardian(userId, input.studentId);
  const fee = parseFee(input.fee);
  if (fee && typeof fee === "object") throw new AppError(fee.error);
  const drop = parseDrop(input.drop);
  if (drop && "error" in drop) throw new AppError(drop.error);
  const student = await db.student.findUniqueOrThrow({ where: { id: input.studentId }, include: { class: { include: { school: true } } } });
  const today = vnToday(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < today || input.date > addDays(today, 7)) throw new AppError("Chỉ nhờ đón trong 7 ngày tới.");
  if (vnDateTime(input.date, student.class.pickupEnd) <= now) throw new AppError("Đã qua giờ đón của ngày này.");
  const open = await db.chatPost.count({ where: { kind: "NHO_DON", studentId: student.id, date: input.date, status: "MO" } });
  if (open) throw new AppError("Đã có lời nhờ đón cho bé vào ngày này trong nhóm.");

  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const note = (input.note ?? "").trim().slice(0, 300);
  const when = showWindow(vnDateTime(input.date, student.class.pickupStart), vnDateTime(input.date, student.class.pickupEnd));
  await db.$transaction(async (tx) => {
    const post = await tx.chatPost.create({
      data: { classId: student.classId, authorId: userId, kind: "NHO_DON", studentId: student.id, date: input.date, body: note,
        ...(drop && { dropLabel: drop.label, dropAddress: drop.address, dropWard: drop.ward, dropLat: drop.lat, dropLng: drop.lng }),
        ...(fee && { fee }),
        // khu vực sống của người nhờ (chưa chọn thì lấy phường/xã của trường) — phạm vi vòng cuối
        scope: "LOP", scopeAt: now, areaWardId: me.wardId ?? student.class.school.wardId },
    });
    const others = (await classMembers(student.classId)).filter((u) => u.id !== userId);
    await notify(tx, others.map((u) => ({ userId: u.id, phone: u.phone })), "PUSH",
      `${me.name} cần người đón giúp bé ${student.name} lúc ${when}${drop ? `, trả bé ở ${drop.ward}` : ""}. Ai đón giúp được thì bấm nhận trong nhóm lớp.`, `/nhom?lop=${student.classId}#p-${post.id}`);
    // người đón có phí ngoài lớp chỉ được báo khi lời nhờ lên vòng TRƯỜNG (asks.ts)
  });
}

export async function offerHelp(userId: string, postId: string, note = "") {
  const post = await db.chatPost.findUnique({ where: { id: postId }, include: { student: true } });
  if (!post || post.kind !== "NHO_DON" || !post.studentId) throw new AppError("Không tìm thấy lời nhờ.");
  const m = await membership(userId, post.classId).catch(() => null);
  if (m?.teacher && !m.parent) throw new AppError("Chỉ phụ huynh mới nhận đón giúp. Giáo viên kiểm tra tại cổng.");
  const cls = await db.class.findUniqueOrThrow({ where: { id: post.classId } });
  const reach = await canReach(userId, post, cls.schoolId);
  if (!reach.viewer) throw new AppError("Lời nhờ này không gửi tới bạn.");
  if (!reach.ok) throw new AppError("Lời nhờ đang ưu tiên phụ huynh gần bé hơn. Nếu chưa ai nhận, app sẽ gửi tới bạn.");
  // Có thù lao: phải là người đón có phí đã được duyệt của trường
  if (post.fee) await requirePaidHelper(userId, post.classId);
  if (post.status !== "MO") throw new AppError("Lời nhờ này đã có người nhận hoặc đã đóng.");
  if (await db.guardian.count({ where: { userId, studentId: post.studentId } })) throw new AppError("Bạn là phụ huynh của bé — hãy tự đón hoặc nhờ người khác.");
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // Người trong danh sách không được đón: từ chối với câu trung tính, báo giáo viên
  if (await db.blockedPerson.count({ where: { studentId: post.studentId, phone: me.phone } })) {
    await db.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorId: userId, action: "CHAN_NHAN_DON_NHOM", target: post.studentId!, meta: { postId } } });
      const ts = await tx.teacherAssignment.findMany({ where: { classId: post.classId }, include: { user: true } });
      await notify(tx, ts.map((t) => ({ userId: t.userId, phone: t.user.phone })), "PUSH",
        `Cảnh báo: người trong danh sách KHÔNG ĐƯỢC ĐÓN vừa nhận đón bé ${post.student!.name} trong nhóm lớp. Hệ thống đã chặn.`);
    });
    throw new AppError("Bạn không thể nhận lời nhờ này.");
  }
  const exists = await db.chatOffer.findUnique({ where: { postId_userId: { postId, userId } } });
  if (exists) throw new AppError("Bạn đã nhận lời rồi, chờ phụ huynh chọn.");
  await db.$transaction(async (tx) => {
    await tx.chatOffer.create({ data: { postId, userId, note: note.trim().slice(0, 200) } });
    const author = await tx.user.findUniqueOrThrow({ where: { id: post.authorId } });
    await notify(tx, [{ userId: author.id, phone: author.phone }], "PUSH",
      `${me.name} có thể đón giúp bé ${post.student!.name}. Mở nhóm lớp để chọn người đón.`, `/nhom?lop=${post.classId}#p-${post.id}`);
  });
}

export async function withdrawOffer(userId: string, postId: string) {
  const post = await db.chatPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== "MO") throw new AppError("Lời nhờ đã có người nhận, không rút được. Hãy báo phụ huynh.");
  await db.chatOffer.deleteMany({ where: { postId, userId } });
}

/** Phụ huynh của bé chọn một người đã nhận → tạo yêu cầu đón hộ. Người trong danh sách tin cậy đi luồng tin cậy, còn lại là người ngoài danh sách. */
export async function chooseOffer(userId: string, offerId: string, now = new Date()): Promise<string> {
  const offer = await db.chatOffer.findUnique({ where: { id: offerId }, include: { post: true, user: true } });
  if (!offer || !offer.post.studentId || !offer.post.date) throw new AppError("Không tìm thấy người nhận.");
  const post = offer.post;
  await requireGuardian(userId, post.studentId!);
  // Giữ chỗ trước: chỉ một người chọn được, bấm trùng không tạo 2 yêu cầu
  const claim = await db.chatPost.updateMany({ where: { id: post.id, status: "MO" }, data: { status: "DA_CHON" } });
  if (claim.count !== 1) throw new AppError("Lời nhờ này đã được chọn người hoặc đã đóng.");
  try {
    const drop = post.dropAddress && post.dropWard
      ? { label: post.dropLabel ?? "", address: post.dropAddress, ward: post.dropWard, lat: post.dropLat, lng: post.dropLng }
      : undefined;
    if (post.fee) {
      const prof = await requirePaidHelper(offer.userId, post.classId, now);
      const tiers = await tiersOf([offer.userId, userId], now);
      const id = await createRequest(userId, {
        studentId: post.studentId!, date: post.date!, mode: "adhoc", name: offer.user.name, phone: offer.user.phone,
        relation: "Phụ huynh cùng trường (đón có phí)", reason: post.body, drop,
        paid: { fee: post.fee, commission: commissionOf(post.fee, jobRate(tiers.get(offer.userId)!, tiers.get(userId)!, platformRate())), cccdLast4: prof.cccdLast4, photoId: prof.photoId },
      }, now);
      await db.chatPost.update({ where: { id: post.id }, data: { requestId: id, ...CLEAR_DROP } });
      return id;
    }
    const trusted = await db.trustedPerson.findFirst({ where: { studentId: post.studentId!, phone: offer.user.phone, status: "DA_DUYET" } });
    const cls = await db.class.findUniqueOrThrow({ where: { id: post.classId } });
    const from = await scopeOf(offer.userId, post, cls.schoolId);
    const relation = from === "TRUONG" ? "Phụ huynh cùng trường" : from === "KHU_VUC" ? "Phụ huynh cùng khu vực sống" : "Phụ huynh cùng lớp";
    const id = await createRequest(userId, trusted
      ? { studentId: post.studentId!, date: post.date!, mode: "trusted", trustedPersonId: trusted.id, reason: post.body, drop }
      : { studentId: post.studentId!, date: post.date!, mode: "adhoc", name: offer.user.name, phone: offer.user.phone, relation, reason: post.body, drop },
    now);
    // Địa chỉ đã chuyển sang yêu cầu (có phân quyền + tự xoá khi xong) → bỏ khỏi bài đăng
    await db.chatPost.update({ where: { id: post.id }, data: { requestId: id, ...CLEAR_DROP } });
    return id;
  } catch (e) {
    await db.chatPost.update({ where: { id: post.id }, data: { status: "MO" } });
    throw e;
  }
}

export async function closePost(userId: string, postId: string) {
  const post = await db.chatPost.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) throw new AppError("Chỉ người đăng mới đóng được lời nhờ.");
  await db.chatPost.updateMany({ where: { id: postId, status: "MO" }, data: { status: "DA_DONG", ...CLEAR_DROP } });
}

/** Nội dung nhóm cho một lớp: tin mới nhất + lời nhờ đang mở (người có hạng tương trợ cao lên trước). */
export async function chatFeed(userId: string, classId: string, now = new Date()) {
  const m = await membership(userId, classId);
  await escalateAsks(now);
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, include: { school: true } });
  const posts = await db.chatPost.findMany({
    where: { classId },
    include: { author: true, offers: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  posts.reverse();
  const studentIds = [...new Set(posts.map((p) => p.studentId).filter((x): x is string => !!x))];
  const [students, guardians, teachers, requests] = await Promise.all([
    db.student.findMany({ where: { id: { in: studentIds } }, include: { class: true } }),
    db.guardian.findMany({ where: { student: { classId } }, include: { student: true } }),
    db.teacherAssignment.findMany({ where: { classId } }),
    db.pickupRequest.findMany({ where: { id: { in: posts.map((p) => p.requestId).filter((x): x is string => !!x) } }, select: { id: true, status: true, delegateId: true } }),
  ]);
  const studentOf = new Map(students.map((s) => [s.id, s]));
  const reqOf = new Map(requests.map((r) => [r.id, r]));
  const myStudents = new Set(guardians.filter((g) => g.userId === userId).map((g) => g.studentId));

  const people = new Set<string>([...posts.map((p) => p.authorId), ...posts.flatMap((p) => p.offers.map((o) => o.userId))]);
  // người nhận từ ngoài lớp (vòng trường/khu vực): ghi rõ họ ở đâu để phụ huynh và cô cân nhắc
  const outsider = new Map<string, string>();
  for (const p of posts) {
    for (const o of p.offers) {
      if (outsider.has(o.userId) || guardians.some((g) => g.userId === o.userId)) continue;
      const sc = await scopeOf(o.userId, p, cls.schoolId);
      outsider.set(o.userId, sc === "KHU_VUC" ? "Phụ huynh cùng khu vực sống" : "Phụ huynh cùng trường");
    }
  }
  const tiers = new Map<string, { tier: string; tierIdx: number; pickups: number }>();
  for (const id of people) {
    const rw = computeReward(await rewardOf(id));
    tiers.set(id, { tier: rw.tier.name, tierIdx: TIERS.findIndex((t) => t.key === rw.tier.key), pickups: rw.pickups });
  }
  const who = (id: string) => {
    if (teachers.some((t) => t.userId === id)) return "Giáo viên";
    const g = guardians.filter((x) => x.userId === id);
    return g.length ? g.map((x) => `${x.relation} bé ${x.student.name.split(" ").pop()}`).join(", ") : outsider.get(id) ?? "Phụ huynh ngoài lớp";
  };
  const myHelper = await db.helperProfile.findUnique({ where: { userId } });

  const view = posts.map((p) => {
    const st = p.studentId ? studentOf.get(p.studentId) : undefined;
    return {
      id: p.id, kind: p.kind, body: p.body, status: p.status, createdAt: p.createdAt, mine: p.authorId === userId,
      author: { id: p.authorId, name: p.author.name, who: who(p.authorId), ...tiers.get(p.authorId)! },
      ask: st && p.date ? {
        studentName: st.name,
        ward: p.dropWard,
        fee: p.fee,
        needHelper: !!p.fee && myHelper?.status !== "DA_DUYET",
        // địa chỉ chi tiết chỉ phụ huynh của bé thấy; phụ huynh khác chỉ thấy phường/xã để biết có tiện đường không
        dropAddress: myStudents.has(st.id) && p.dropAddress && p.dropWard ? `${p.dropLabel ?? "Điểm trả"}: ${showDrop({ address: p.dropAddress, ward: p.dropWard })}` : null,
        when: showWindow(vnDateTime(p.date, st.class.pickupStart), vnDateTime(p.date, st.class.pickupEnd)),
        canChoose: myStudents.has(st.id) && p.status === "MO",
        canOffer: m.parent && !myStudents.has(st.id) && p.status === "MO" && !p.offers.some((o) => o.userId === userId),
        offered: p.offers.some((o) => o.userId === userId),
        requestId: p.requestId, requestStatus: p.requestId ? reqOf.get(p.requestId)?.status ?? null : null,
        // chỉ người liên quan mới mở được yêu cầu (người khác sẽ gặp 404)
        canView: !!p.requestId && (myStudents.has(st.id) || m.teacher || reqOf.get(p.requestId)?.delegateId === userId),
        expired: vnDateTime(p.date, st.class.pickupEnd) <= now,
        round: scopeView(p, st.class.pickupStart),
      } : null,
      offers: p.offers.map((o) => ({ id: o.id, userId: o.userId, name: o.user.name, who: who(o.userId), note: o.note, ...tiers.get(o.userId)! })),
    };
  });
  // hạng tương trợ (giúp người) đứng trước; thành viên Vàng+ chỉ đứng trước người CÙNG hạng tương trợ
  const members = await tiersOf([...new Set(view.map((p) => p.author.id))], now);
  const openAsks = view
    .filter((p) => p.ask && p.status === "MO" && !p.ask.expired)
    .sort((a, b) => b.author.tierIdx - a.author.tierIdx
      || Number(members.get(b.author.id)!.askBoost) - Number(members.get(a.author.id)!.askBoost)
      || +a.createdAt - +b.createdAt);
  const myKids = guardians.filter((g) => g.userId === userId).map((g) => g.student);
  return { cls, isParent: m.parent, isTeacher: m.teacher, posts: view, openAsks, myKids, members: (await classMembers(classId)).length };
}
