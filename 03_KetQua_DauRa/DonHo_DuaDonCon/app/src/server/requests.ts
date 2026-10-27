// Nghiệp vụ yêu cầu đón hộ. Mọi lần đổi trạng thái: kiểm quyền → máy trạng thái → cập nhật có điều kiện
// (chỉ thành công nếu trạng thái chưa bị ai đổi trước) → ghi nhật ký → thông báo, tất cả trong một giao dịch.
import type { PickupRequest, Prisma, RequestStatus } from "@prisma/client";
import { hashCode, newPin, newToken, sameHash } from "@/domain/codes";
import { CLEAR_DROP, parseDrop, showDrop, type DropInput } from "@/domain/drop";
import { normalizePhone } from "@/domain/phone";
import { parseDataUrl } from "@/domain/photo";
import {
  AUTO_CLOSE_MS, GATE_VERIFY_TTL_MS, PIN_MAX_ATTEMPTS, STATUS_LABEL,
  codeUsableAt, transition, type Action, type Role, type Status,
} from "@/domain/state";
import { addDays, showWindow, vnDateTime, vnToday } from "@/domain/time";
import { requireGuardian, requireTeacher } from "./access";
import { AppError, appSecret, db, publicUrl } from "./db";
import { guardiansOf, notify, teachersOf } from "./notify";
import { seal } from "./seal";

type Tx = Prisma.TransactionClient;

/** Đổi trạng thái an toàn khi có nhiều người bấm cùng lúc: chỉ cập nhật nếu trạng thái vẫn là `from`. */
async function move(
  tx: Tx, req: Pick<PickupRequest, "id" | "status">, action: Action, role: Role, actorId: string | null,
  data: Prisma.PickupRequestUpdateManyMutationInput = {}, note = "",
): Promise<Status> {
  const to = transition(req.status as Status, action, role);
  const res = await tx.pickupRequest.updateMany({ where: { id: req.id, status: req.status }, data: { ...data, status: to } });
  if (res.count !== 1) throw new AppError("Yêu cầu vừa được người khác cập nhật. Tải lại trang để xem trạng thái mới.");
  await tx.requestEvent.create({ data: { requestId: req.id, actorId, actorRole: role, action, fromStatus: req.status, toStatus: to as RequestStatus, note } });
  return to;
}

async function savePhoto(tx: Tx, dataUrl: string, kind: "CHAN_DUNG" | "BAN_GIAO", ownerId: string): Promise<string> {
  const p = parseDataUrl(dataUrl);
  if ("error" in p) throw new AppError(p.error);
  const photo = await tx.photo.create({ data: { kind, mime: p.mime, bytes: p.bytes, ownerId } });
  return photo.id;
}

const link = (path: string) => `${publicUrl()}${path}`;

/** Yêu cầu đóng thì xoá vị trí người đón và địa chỉ điểm trả — chỉ giữ khi cần theo dõi. */
const CLEAR_LOC = { delegateLat: null, delegateLng: null, delegateLocAt: null, ...CLEAR_DROP } as const;

// ─────────────────────────── Dọn trạng thái quá hạn ───────────────────────────

/** Hết khung giờ mà chưa giao → HET_HAN; đã giao 24 giờ mà phụ huynh chưa xác nhận → tự đóng. Gọi mỗi lần đọc. */
export async function sweep(now = new Date()) {
  const overdue = await db.pickupRequest.findMany({
    where: { status: { in: ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET"] }, windowEnd: { lt: now } },
    select: { id: true, status: true, studentId: true },
  });
  for (const r of overdue) {
    await db.$transaction(async (tx) => {
      await move(tx, r, "HET_HAN", "HE_THONG", null, { tokenHash: null, pinHash: null, codeSealed: null, closedAt: now, ...CLEAR_LOC }, "Hết khung giờ đón");
      await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", "Yêu cầu đón hộ đã hết hạn vì quá giờ đón mà chưa hoàn tất.", `/yeu-cau/${r.id}`);
    }).catch((e) => { if (!(e instanceof AppError)) throw e; });
  }
  const stale = await db.pickupRequest.findMany({
    where: { status: "DA_GIAO", handedOverAt: { lt: new Date(now.getTime() - AUTO_CLOSE_MS) } },
    select: { id: true, status: true },
  });
  for (const r of stale) {
    await db.$transaction((tx) => move(tx, r, "TU_DONG_DONG", "HE_THONG", null, { closedAt: now, autoClosed: true, ...CLEAR_LOC }, "Tự đóng sau 24 giờ"))
      .catch((e) => { if (!(e instanceof AppError)) throw e; });
  }
}

// ─────────────────────────── Phụ huynh ───────────────────────────

export type CreateInput = {
  studentId: string;
  date: string; // YYYY-MM-DD
  mode: "trusted" | "adhoc";
  trustedPersonId?: string;
  name?: string;
  phone?: string;
  relation?: string;
  reason?: string;
  drop?: DropInput; // điểm trả bé lần này — không bắt buộc
};

export async function createRequest(parentId: string, input: CreateInput, now = new Date()): Promise<string> {
  await requireGuardian(parentId, input.studentId);
  const student = await db.student.findUniqueOrThrow({ where: { id: input.studentId }, include: { class: { include: { school: true } } } });

  const drop = parseDrop(input.drop);
  if (drop && "error" in drop) throw new AppError(drop.error);

  const today = vnToday(now);
  if (input.date < today || input.date > addDays(today, 7)) throw new AppError("Chỉ nhờ đón trong 7 ngày tới.");
  const windowStart = vnDateTime(input.date, student.class.pickupStart);
  const windowEnd = vnDateTime(input.date, student.class.pickupEnd);
  if (windowEnd <= now) throw new AppError("Đã qua giờ đón của ngày này.");

  let delegate: { name: string; phone: string; relation: string; trustedPersonId?: string; cccdLast4?: string; photoId?: string };
  if (input.mode === "trusted") {
    const t = await db.trustedPerson.findFirst({ where: { id: input.trustedPersonId ?? "", studentId: student.id } });
    if (!t) throw new AppError("Chưa chọn người tin cậy.");
    if (t.status !== "DA_DUYET") throw new AppError("Người này chưa được giáo viên duyệt vào danh sách tin cậy.");
    delegate = { name: t.name, phone: t.phone, relation: t.relation, trustedPersonId: t.id, cccdLast4: t.cccdLast4, photoId: t.photoId };
  } else {
    if (!student.class.school.allowAdhoc) throw new AppError("Trường chỉ cho phép người trong danh sách tin cậy đón trẻ.");
    const phone = normalizePhone(input.phone ?? "");
    const name = (input.name ?? "").trim();
    const relation = (input.relation ?? "").trim();
    if (!phone) throw new AppError("Số điện thoại người đón chưa đúng.");
    if (name.length < 2) throw new AppError("Nhập họ tên người đón.");
    if (!relation) throw new AppError("Nhập quan hệ với trẻ (ví dụ: Cô ruột, Hàng xóm).");
    delegate = { name, phone, relation };
  }

  const requester = await db.user.findUniqueOrThrow({ where: { id: parentId } });
  if (delegate.phone === requester.phone) throw new AppError("Không thể tự nhờ chính mình đón.");

  return db.$transaction(async (tx) => {
    const blocked = await tx.blockedPerson.findFirst({ where: { studentId: student.id, phone: delegate.phone } });
    if (blocked) {
      await tx.auditLog.create({ data: { actorId: parentId, action: "CHAN_NGUOI_CAM", target: student.id, meta: { phone: delegate.phone } } });
      await notify(tx, await teachersOf(tx, student.id), "PUSH", `Cảnh báo: có yêu cầu nhờ người trong danh sách KHÔNG ĐƯỢC ĐÓN đón bé ${student.name}. Hệ thống đã chặn.`);
      // Ghi nhật ký + cảnh báo trước rồi mới báo lỗi; giao dịch vẫn commit nhờ không ném trong tx
      return "BLOCKED";
    }
    const clash = await tx.pickupRequest.findFirst({
      where: { studentId: student.id, status: { in: ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET"] }, windowStart },
    });
    if (clash) throw new AppError("Đã có một yêu cầu đón hộ đang chạy cho ca này. Huỷ yêu cầu cũ trước nếu muốn đổi người.");

    let du = await tx.user.findUnique({ where: { phone: delegate.phone } });
    if (!du) du = await tx.user.create({ data: { phone: delegate.phone, name: delegate.name } });

    const r = await tx.pickupRequest.create({
      data: {
        studentId: student.id, requesterId: parentId, delegateId: du.id, trustedPersonId: delegate.trustedPersonId,
        isAdhoc: input.mode === "adhoc", delegateName: delegate.name, delegatePhone: delegate.phone, relation: delegate.relation,
        cccdLast4: delegate.cccdLast4, delegatePhotoId: delegate.photoId, reason: (input.reason ?? "").trim().slice(0, 300),
        windowStart, windowEnd,
        ...(drop && { dropLabel: drop.label, dropAddress: drop.address, dropWard: drop.ward, dropLat: drop.lat, dropLng: drop.lng }),
      },
    });
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: parentId, actorRole: "PHU_HUYNH", action: "TAO", toStatus: "CHO_NGUOI_DON", note: input.reason ?? "" } });

    const when = showWindow(windowStart, windowEnd);
    await notify(tx, [{ userId: du.id, phone: du.phone }], "SMS",
      `${requester.name} nho ban don be ${student.name} (${student.class.name}) luc ${when}${drop ? `, tra be tai ${drop.ward}` : ""}. Mo link de nhan loi: ${link(`/yeu-cau/${r.id}`)}`, `/yeu-cau/${r.id}`);
    const others = (await guardiansOf(tx, student.id)).filter((g) => g.userId !== parentId);
    await notify(tx, others, "PUSH", `${requester.name} vừa nhờ ${delegate.name} (${delegate.relation}) đón bé ${student.name} lúc ${when}.`, `/yeu-cau/${r.id}`);
    return r.id;
  }).then((id) => {
    if (id === "BLOCKED") throw new AppError("Người này nằm trong danh sách KHÔNG ĐƯỢC ĐÓN của trẻ. Giáo viên đã được báo.");
    return id;
  });
}

export async function cancelRequest(parentId: string, requestId: string, now = new Date()) {
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId } });
  await requireGuardian(parentId, r.studentId);
  await db.$transaction(async (tx) => {
    await move(tx, r, "PH_HUY", "PHU_HUYNH", parentId, { tokenHash: null, pinHash: null, codeSealed: null, closedAt: now, ...CLEAR_LOC });
    const msg = `Yêu cầu đón bé lúc ${showWindow(r.windowStart, r.windowEnd)} đã bị phụ huynh HUỶ. Mã đón không còn hiệu lực.`;
    await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "SMS", msg, `/yeu-cau/${r.id}`);
    await notify(tx, [...(await teachersOf(tx, r.studentId)), ...(await guardiansOf(tx, r.studentId))], "PUSH", msg, `/yeu-cau/${r.id}`);
  });
}

export async function confirmHome(parentId: string, requestId: string, now = new Date(), thanks = "") {
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireGuardian(parentId, r.studentId);
  const note = thanks.trim().slice(0, 200);
  await db.$transaction(async (tx) => {
    await move(tx, r, "PH_XAC_NHAN_VE", "PHU_HUYNH", parentId, { closedAt: now, thanks: note || null, ...CLEAR_LOC }, note);
    await notify(tx, await teachersOf(tx, r.studentId), "PUSH", "Phụ huynh đã xác nhận bé về nhà an toàn.", `/yeu-cau/${r.id}`);
    const parent = await tx.user.findUniqueOrThrow({ where: { id: parentId }, select: { name: true } });
    await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "PUSH",
      `Bé ${r.student.name} đã về an toàn. Bạn được cộng điểm tương trợ.${note ? ` ${parent.name} nhắn: “${note}”` : ""}`, "/nguoi-don");
  });
}

// ─────────────────────────── Người đón hộ ───────────────────────────

export async function delegateRespond(
  userId: string, requestId: string, accept: boolean, extra: { cccdLast4?: string; photo?: string; note?: string } = {},
) {
  await sweep();
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  if (r.delegateId !== userId) throw new AppError("Yêu cầu này không gửi cho bạn.");

  await db.$transaction(async (tx) => {
    if (!accept) {
      await move(tx, r, "NGUOI_DON_TU_CHOI", "NGUOI_DON", userId, { closedAt: new Date(), ...CLEAR_DROP }, extra.note ?? "");
      await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", `${r.delegateName} đã TỪ CHỐI đón bé ${r.student.name}. Bạn cần nhờ người khác.`, `/yeu-cau/${r.id}`);
      return;
    }
    const data: Prisma.PickupRequestUpdateManyMutationInput = {};
    if (r.isAdhoc) {
      if (!/^\d{4}$/.test(extra.cccdLast4 ?? "")) throw new AppError("Nhập đúng 4 số cuối CCCD của bạn.");
      if (!extra.photo) throw new AppError("Cần chụp ảnh chân dung để giáo viên nhận diện bạn.");
      data.cccdLast4 = extra.cccdLast4;
      data.delegatePhotoId = await savePhoto(tx, extra.photo, "CHAN_DUNG", userId);
    }
    await move(tx, r, "NGUOI_DON_NHAN", "NGUOI_DON", userId, data);
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", `${r.delegateName} đã nhận lời đón bé ${r.student.name}. Đang chờ giáo viên duyệt.`, `/yeu-cau/${r.id}`);
    await notify(tx, await teachersOf(tx, r.studentId), "PUSH",
      `Có yêu cầu đón hộ cần duyệt: bé ${r.student.name}, người đón ${r.delegateName}${r.isAdhoc ? " (NGOÀI DANH SÁCH)" : ""}.`, `/yeu-cau/${r.id}`);
  });
}

// ─────────────────────────── Giáo viên: duyệt ───────────────────────────

export async function teacherDecide(
  teacherId: string, requestId: string, approve: boolean, opts: { calledParent?: boolean; note?: string } = {}, now = new Date(),
) {
  await sweep(now);
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireTeacher(teacherId, r.studentId);
  const note = (opts.note ?? "").trim();

  await db.$transaction(async (tx) => {
    if (!approve) {
      if (note.length < 3) throw new AppError("Ghi lý do từ chối để phụ huynh biết.");
      await move(tx, r, "GV_TU_CHOI", "GIAO_VIEN", teacherId, { decidedById: teacherId, decidedAt: now, decisionNote: note, closedAt: now, ...CLEAR_DROP }, note);
      const msg = `Giáo viên KHÔNG duyệt cho ${r.delegateName} đón bé ${r.student.name}. Lý do: ${note}`;
      await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", msg, `/yeu-cau/${r.id}`);
      await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "SMS", msg, `/yeu-cau/${r.id}`);
      return;
    }
    if (r.isAdhoc && !opts.calledParent) throw new AppError("Người đón nằm ngoài danh sách tin cậy: cần gọi điện xác minh với phụ huynh rồi tích ô xác nhận.");
    if (now > r.windowEnd) throw new AppError("Đã quá giờ đón, không duyệt được nữa.");

    const token = newToken();
    const pin = newPin();
    const secret = appSecret();
    await move(tx, r, "GV_DUYET", "GIAO_VIEN", teacherId, {
      decidedById: teacherId, decidedAt: now, decisionNote: note || null, teacherCalledParent: !!opts.calledParent,
      tokenHash: hashCode(secret, "token", token), pinHash: hashCode(secret, `pin:${r.id}`, pin), codeSealed: seal(secret, { token, pin }), pinAttempts: 0,
    }, r.isAdhoc ? "Đã gọi xác minh với phụ huynh" : note);
    await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "SMS",
      `Da duoc duyet don be ${r.student.name} luc ${showWindow(r.windowStart, r.windowEnd)}.${r.dropAddress && r.dropWard ? ` Tra be tai: ${showDrop({ address: r.dropAddress, ward: r.dropWard })}.` : ""} Mo link de lay ma don, mang theo CCCD: ${link(`/yeu-cau/${r.id}`)}`, `/yeu-cau/${r.id}`);
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", `Giáo viên đã duyệt cho ${r.delegateName} đón bé ${r.student.name}. Đủ 3 bên xác nhận.`, `/yeu-cau/${r.id}`);
  });
}

// ─────────────────────────── Giáo viên: giao trẻ tại cổng ───────────────────────────

function assertCodeWindow(r: Pick<PickupRequest, "status" | "windowStart" | "windowEnd">, now: Date) {
  if (r.status !== "DA_DUYET") throw new AppError(`Không giao được: yêu cầu đang ở trạng thái "${STATUS_LABEL[r.status as Status].label}".`);
  if (!codeUsableAt(now, r.windowStart, r.windowEnd)) throw new AppError(`Mã chỉ dùng được trong khung giờ đón (${showWindow(r.windowStart, r.windowEnd)}), sớm nhất 30 phút trước.`);
}

/** GV quét QR (mã nằm trong link) → mở màn đối chiếu. */
export async function gateByToken(teacherId: string, token: string, now = new Date()): Promise<string> {
  await sweep(now);
  const r = await db.pickupRequest.findUnique({ where: { tokenHash: hashCode(appSecret(), "token", token) } });
  if (!r) throw new AppError("Mã không hợp lệ hoặc đã được dùng / bị huỷ.");
  await requireTeacher(teacherId, r.studentId);
  assertCodeWindow(r, now);
  await db.$transaction(async (tx) => {
    await tx.pickupRequest.update({ where: { id: r.id }, data: { gateVerifiedById: teacherId, gateVerifiedAt: now } });
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: teacherId, actorRole: "GIAO_VIEN", action: "QUET_QR" } });
  });
  return r.id;
}

/** GV chọn trẻ trong danh sách rồi nhập PIN người đón đọc. Sai 5 lần → khoá yêu cầu. */
export async function gateByPin(teacherId: string, requestId: string, pin: string, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  await sweep(now);
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireTeacher(teacherId, r.studentId);
  assertCodeWindow(r, now);
  if (!r.pinHash) throw new AppError("Yêu cầu chưa có mã đón.");

  if (/^\d{6}$/.test(pin) && sameHash(r.pinHash, hashCode(appSecret(), `pin:${r.id}`, pin))) {
    await db.$transaction(async (tx) => {
      await tx.pickupRequest.update({ where: { id: r.id }, data: { gateVerifiedById: teacherId, gateVerifiedAt: now } });
      await tx.requestEvent.create({ data: { requestId: r.id, actorId: teacherId, actorRole: "GIAO_VIEN", action: "NHAP_PIN_DUNG" } });
    });
    return { ok: true };
  }
  const attempts = r.pinAttempts + 1;
  if (attempts >= PIN_MAX_ATTEMPTS) {
    await db.$transaction(async (tx) => {
      await move(tx, r, "KHOA_SAI_PIN", "HE_THONG", null, { pinAttempts: attempts, tokenHash: null, pinHash: null, codeSealed: null }, `Sai PIN ${attempts} lần`);
      const msg = `CẢNH BÁO: mã đón bé ${r.student.name} bị nhập sai ${attempts} lần, yêu cầu đã bị KHOÁ. Không giao trẻ. Phụ huynh cần liên hệ giáo viên.`;
      await notify(tx, await guardiansOf(tx, r.studentId), "SMS", msg, `/yeu-cau/${r.id}`);
      await notify(tx, await teachersOf(tx, r.studentId), "PUSH", msg, `/yeu-cau/${r.id}`);
    });
    return { ok: false, error: `Sai mã ${attempts} lần. Yêu cầu đã bị KHOÁ, KHÔNG giao trẻ. Phụ huynh đã được báo.` };
  }
  await db.$transaction(async (tx) => {
    await tx.pickupRequest.update({ where: { id: r.id }, data: { pinAttempts: attempts } });
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: teacherId, actorRole: "GIAO_VIEN", action: "NHAP_PIN_SAI", note: `Lần ${attempts}` } });
  });
  return { ok: false, error: `Mã chưa đúng. Còn ${PIN_MAX_ATTEMPTS - attempts} lần thử trước khi bị khoá.` };
}

export type HandoverChecks = { face: boolean; cccd: boolean; child: boolean };

export async function handover(teacherId: string, requestId: string, checks: HandoverChecks, photo?: string, now = new Date()) {
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireTeacher(teacherId, r.studentId);
  assertCodeWindow(r, now);
  if (r.gateVerifiedById !== teacherId || !r.gateVerifiedAt || now.getTime() - r.gateVerifiedAt.getTime() > GATE_VERIFY_TTL_MS) {
    throw new AppError("Cần quét QR hoặc nhập PIN của người đón trước khi giao (trong vòng 15 phút).");
  }
  if (!checks.face || !checks.cccd || !checks.child) throw new AppError("Phải tích đủ 3 ô kiểm: khuôn mặt, CCCD, bé nhận ra người đón.");

  await db.$transaction(async (tx) => {
    const photoId = photo ? await savePhoto(tx, photo, "BAN_GIAO", teacherId) : null;
    await move(tx, r, "GIAO_TRE", "GIAO_VIEN", teacherId, {
      handedOverById: teacherId, handedOverAt: now, handoverPhotoId: photoId, tokenHash: null, pinHash: null, codeSealed: null,
    }, "Đã đối chiếu: khuôn mặt, CCCD, bé nhận ra người đón");
    const msg = `Bé ${r.student.name} đã được giao cho ${r.delegateName} lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(now)}. Khi bé về tới nơi, hãy bấm "Con đã về an toàn".`;
    await notify(tx, await guardiansOf(tx, r.studentId), "SMS", msg, `/yeu-cau/${r.id}`);
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", msg, `/yeu-cau/${r.id}`);
  });
}

export async function failHandover(teacherId: string, requestId: string, reason: string, now = new Date()) {
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireTeacher(teacherId, r.studentId);
  const why = reason.trim();
  if (why.length < 3) throw new AppError("Ghi rõ lý do không giao được.");
  await db.$transaction(async (tx) => {
    await move(tx, r, "KHONG_GIAO_DUOC", "GIAO_VIEN", teacherId, { failReason: why, closedAt: now, tokenHash: null, pinHash: null, codeSealed: null, ...CLEAR_LOC }, why);
    const msg = `KHÔNG giao bé ${r.student.name} cho ${r.delegateName}. Lý do: ${why}. Bé vẫn ở trường, vui lòng liên hệ giáo viên.`;
    await notify(tx, await guardiansOf(tx, r.studentId), "SMS", msg, `/yeu-cau/${r.id}`);
    await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "SMS", msg);
  });
}
