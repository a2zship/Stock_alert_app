// Đón theo tháng: một người đón có phí cố định cho các buổi trong tháng.
// Người đón: phụ huynh chỉ định (người đón có phí đã được duyệt cùng trường), hoặc mở trên bảng việc — 24 giờ đầu chỉ hạng Kim cương nhận.
// Cô duyệt người đón + lịch MỘT LẦN (gọi xác minh phụ huynh); mỗi buổi app tự sinh yêu cầu đã duyệt, cổng vẫn kiểm mã/ảnh/CCCD.
// Tiền: TRỌN GÓI ĐẦU THÁNG, phụ huynh chuyển VietQR THẲNG cho người đón — app không giữ tiền, chỉ ghi sổ và tính phần hoàn.
import type { MonthlyContract, Prisma } from "@prisma/client";
import { jobRate } from "@/domain/membership";
import { commissionOf } from "@/domain/money";
import {
  firstDay, monthOptions, parseMonthFee, parseWeekdays, PRIORITY_MS, refundableDays, refundOf, REFUND_DAYS, scheduleDays, showMonth,
} from "@/domain/monthly";
import { parseDrop, type DropInput } from "@/domain/drop";
import { normalizePhone } from "@/domain/phone";
import { addDays, showDateTime, vnDayRange, vnToday } from "@/domain/time";
import { bankName, transferNote, vietQr } from "@/domain/vietqr";
import { isGuardian, isTeacherOfStudent, requireGuardian, requireTeacher } from "./access";
import { AppError, db, platformRate } from "./db";
import { requirePaidHelper } from "./earn";
export { refundOverdue } from "./earn";
import { tierOf, tiersOf } from "./membership";
import { guardiansOf, notify, teachersOf } from "./notify";
import { cancelRequest, helperSkipRequest, sweep } from "./requests";

type Tx = Prisma.TransactionClient;
const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
const RUNNING = ["TIM_NGUOI", "CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET"] as const;

/** Đổi trạng thái hợp đồng chỉ khi chưa ai đổi trước (hai người bấm cùng lúc). */
async function moveContract(tx: Tx, c: Pick<MonthlyContract, "id" | "status">, data: Prisma.MonthlyContractUncheckedUpdateManyInput) {
  const res = await tx.monthlyContract.updateMany({ where: { id: c.id, status: c.status }, data });
  if (res.count !== 1) throw new AppError("Hợp đồng vừa được người khác cập nhật. Tải lại trang để xem trạng thái mới.");
}

const daysOf = (c: Pick<MonthlyContract, "month" | "weekdays" | "firstDay">) => scheduleDays(c.month, c.weekdays, c.firstDay);

async function contractOf(id: string) {
  const c = await db.monthlyContract.findUnique({ where: { id }, include: { student: { include: { class: true } }, helper: true, requester: true } });
  if (!c) throw new AppError("Không tìm thấy hợp đồng.");
  return c;
}

// ─────────────────────────── Phụ huynh tạo hợp đồng ───────────────────────────

export type MonthlyInput = {
  studentId: string; month: string; weekdays: unknown[]; fee: unknown;
  helperPhone?: string; // bỏ trống = mở trên bảng việc của trường
  note?: string; drop?: DropInput;
};

export async function createMonthly(parentId: string, input: MonthlyInput, now = new Date()): Promise<string> {
  await requireGuardian(parentId, input.studentId);
  const student = await db.student.findUniqueOrThrow({ where: { id: input.studentId }, include: { class: { include: { school: true } } } });
  if (!monthOptions(now).includes(input.month)) throw new AppError("Chỉ đăng ký cho tháng này hoặc tháng sau.");
  const weekdays = parseWeekdays(input.weekdays);
  if ("error" in weekdays) throw new AppError(weekdays.error);
  const from = firstDay(input.month, now);
  const days = scheduleDays(input.month, weekdays, from);
  if (!days.length) throw new AppError("Tháng này không còn buổi đón nào theo các ngày đã chọn.");
  const fee = parseMonthFee(input.fee, days.length);
  if (typeof fee === "object") throw new AppError(fee.error);
  const drop = parseDrop(input.drop);
  if (drop && "error" in drop) throw new AppError(drop.error);
  const dup = await db.monthlyContract.count({ where: { studentId: student.id, month: input.month, status: { in: [...RUNNING] } } });
  if (dup) throw new AppError(`Bé đã có hợp đồng đón ${showMonth(input.month)} đang chạy. Kết thúc hợp đồng cũ trước.`);

  let helper: { id: string; phone: string; name: string } | null = null;
  if (input.helperPhone?.trim()) {
    const phone = normalizePhone(input.helperPhone);
    if (!phone) throw new AppError("Số điện thoại người đón chưa đúng.");
    const prof = await db.helperProfile.findFirst({ where: { user: { phone } }, include: { user: true } });
    if (!prof || prof.status !== "DA_DUYET" || prof.schoolId !== student.class.schoolId) {
      throw new AppError("Số này chưa phải người đón có phí được duyệt của trường. Nhờ người đó đăng ký ở mục Kiếm thêm, hoặc để trống để mở cho cả trường.");
    }
    if (prof.userId === parentId) throw new AppError("Không thể tự chỉ định chính mình.");
    if (await db.blockedPerson.count({ where: { studentId: student.id, phone } })) throw new AppError("Người này nằm trong danh sách KHÔNG ĐƯỢC ĐÓN của trẻ.");
    await requirePaidHelper(prof.userId, student.classId, now).catch(() => { throw new AppError("Người này đang tạm không nhận việc có phí (nợ phí hoặc chưa hoàn tiền)."); });
    helper = { id: prof.userId, phone, name: prof.user.name };
  }

  return db.$transaction(async (tx) => {
    const c = await tx.monthlyContract.create({ data: {
      studentId: student.id, requesterId: parentId, helperId: helper?.id, designated: !!helper, month: input.month, weekdays, firstDay: from,
      fee, note: (input.note ?? "").trim().slice(0, 300), status: helper ? "CHO_NGUOI_DON" : "TIM_NGUOI",
      priorityUntil: helper ? null : new Date(now.getTime() + PRIORITY_MS), createdAt: now,
      ...(drop && { dropLabel: drop.label, dropAddress: drop.address, dropWard: drop.ward, dropLat: drop.lat, dropLng: drop.lng }),
    } });
    const what = `đón ${student.class.name} ${showMonth(input.month)} (${days.length} buổi), trọn gói ${vnd(fee)}`;
    if (helper) {
      await notify(tx, [{ userId: helper.id, phone: helper.phone }], "SMS", `Phu huynh chi dinh ban ${transferNote(what).toLowerCase()}. Mo app de nhan loi.`, `/thang/${c.id}`);
    } else {
      // báo trước cho người đón Kim cương của trường — họ có 24 giờ ưu tiên
      const profs = await tx.helperProfile.findMany({ where: { schoolId: student.class.schoolId, status: "DA_DUYET", userId: { not: parentId } }, include: { user: true } });
      const tiers = await tiersOf(profs.map((p) => p.userId), now);
      const vip = profs.filter((p) => tiers.get(p.userId)!.key === "KIM_CUONG");
      await notify(tx, vip.map((p) => ({ userId: p.userId, phone: p.user.phone })), "PUSH", `Ưu tiên Kim cương: có hợp đồng ${what}. Bạn nhận được trước 24 giờ.`, "/kiem-tien#thang");
    }
    await tx.auditLog.create({ data: { actorId: parentId, action: "TAO_HOP_DONG_THANG", target: c.id, meta: { month: input.month, fee, designated: !!helper } } });
    return c.id;
  });
}

export async function cancelMonthly(parentId: string, id: string, now = new Date()) {
  const c = await contractOf(id);
  await requireGuardian(parentId, c.studentId);
  if (!["TIM_NGUOI", "CHO_NGUOI_DON", "CHO_GIAO_VIEN"].includes(c.status)) throw new AppError("Hợp đồng đã duyệt — dùng nút Kết thúc sớm.");
  await db.$transaction(async (tx) => {
    await moveContract(tx, c, { status: "DA_HUY", endedAt: now, endedBy: "PHU_HUYNH", endReason: "Phụ huynh huỷ trước khi duyệt", dropAddress: null, dropLat: null, dropLng: null });
    if (c.helper) await notify(tx, [{ userId: c.helper.id, phone: c.helper.phone }], "PUSH", `Phụ huynh đã huỷ hợp đồng đón ${showMonth(c.month)}.`, `/thang/${c.id}`);
  });
}

// ─────────────────────────── Bảng việc: người đón nhận hợp đồng mở ───────────────────────────

/** Hợp đồng tháng đang tìm người trong trường — không lộ tên bé, chỉ lớp, phường/xã, lịch, tiền. */
export async function monthlyBoard(userId: string, now = new Date()) {
  const prof = await db.helperProfile.findUnique({ where: { userId } });
  if (!prof || prof.status !== "DA_DUYET") return { vip: false, rows: [] };
  const me = await tierOf(userId, now);
  const myKids = (await db.guardian.findMany({ where: { userId }, select: { studentId: true } })).map((g) => g.studentId);
  const list = await db.monthlyContract.findMany({
    where: { status: "TIM_NGUOI", student: { class: { schoolId: prof.schoolId } }, studentId: { notIn: myKids }, requesterId: { not: userId } },
    include: { student: { include: { class: true } }, offers: { select: { userId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const tiers = await tiersOf([...new Set(list.map((c) => c.requesterId))], now);
  const base = platformRate();
  return {
    vip: me.key === "KIM_CUONG",
    rows: list.map((c) => {
      const rate = jobRate(me, tiers.get(c.requesterId)!, base);
      const locked = !!c.priorityUntil && now < c.priorityUntil && me.key !== "KIM_CUONG";
      return {
        id: c.id, className: c.student.class.name, time: `${c.student.class.pickupStart}–${c.student.class.pickupEnd}`, month: c.month, weekdays: c.weekdays,
        days: daysOf(c).length, ward: c.dropWard, note: c.note, fee: c.fee, net: c.fee - commissionOf(c.fee, rate),
        priority: !!c.priorityUntil && now < c.priorityUntil, priorityUntil: c.priorityUntil, locked,
        offered: c.offers.some((o) => o.userId === userId), offers: c.offers.length,
      };
    }),
  };
}

export async function offerMonthly(userId: string, id: string, now = new Date()) {
  const c = await contractOf(id);
  if (c.status !== "TIM_NGUOI") throw new AppError("Hợp đồng này đã có người nhận.");
  if (c.requesterId === userId || (await isGuardian(userId, c.studentId))) throw new AppError("Đây là hợp đồng cho con bạn.");
  await requirePaidHelper(userId, c.student.classId, now);
  if (c.priorityUntil && now < c.priorityUntil && (await tierOf(userId, now)).key !== "KIM_CUONG") {
    throw new AppError(`24 giờ đầu dành cho thành viên Kim cương. Bạn nhận được từ ${showDateTime(c.priorityUntil)}.`);
  }
  await db.$transaction(async (tx) => {
    await tx.monthlyOffer.upsert({ where: { contractId_userId: { contractId: id, userId } }, create: { contractId: id, userId, createdAt: now }, update: {} });
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await notify(tx, [{ userId: c.requesterId, phone: c.requester.phone }], "PUSH", `${u.name} muốn nhận đón bé ${c.student.name} ${showMonth(c.month)}. Mở hợp đồng để chọn.`, `/thang/${c.id}`);
  });
}

export async function withdrawMonthlyOffer(userId: string, id: string) {
  await db.monthlyOffer.deleteMany({ where: { contractId: id, userId, contract: { status: "TIM_NGUOI" } } });
}

/** Phụ huynh chọn một người trong số người muốn nhận → chờ cô duyệt. */
export async function chooseMonthlyOffer(parentId: string, id: string, helperId: string, now = new Date()) {
  const c = await contractOf(id);
  await requireGuardian(parentId, c.studentId);
  if (c.status !== "TIM_NGUOI") throw new AppError("Hợp đồng đã có người đón.");
  if (!(await db.monthlyOffer.count({ where: { contractId: id, userId: helperId } }))) throw new AppError("Người này chưa nhận hợp đồng.");
  await requirePaidHelper(helperId, c.student.classId, now);
  const h = await db.user.findUniqueOrThrow({ where: { id: helperId } });
  if (await db.blockedPerson.count({ where: { studentId: c.studentId, phone: h.phone } })) throw new AppError("Người này nằm trong danh sách KHÔNG ĐƯỢC ĐÓN của trẻ.");
  await db.$transaction(async (tx) => {
    await moveContract(tx, c, { status: "CHO_GIAO_VIEN", helperId });
    await notify(tx, [{ userId: h.id, phone: h.phone }], "PUSH", `Bạn được chọn đón bé ${c.student.name} ${showMonth(c.month)}. Đang chờ cô duyệt.`, `/thang/${c.id}`);
    await notify(tx, await teachersOf(tx, c.studentId), "PUSH", `Hợp đồng đón theo tháng cần duyệt: bé ${c.student.name}, người đón ${h.name}.`, `/thang/${c.id}`);
  });
}

/** Người được chỉ định nhận lời hoặc từ chối. */
export async function helperRespondMonthly(userId: string, id: string, accept: boolean, note = "", now = new Date()) {
  const c = await contractOf(id);
  if (c.helperId !== userId || c.status !== "CHO_NGUOI_DON") throw new AppError("Hợp đồng này không chờ bạn trả lời.");
  if (accept) await requirePaidHelper(userId, c.student.classId, now);
  await db.$transaction(async (tx) => {
    await moveContract(tx, c, accept ? { status: "CHO_GIAO_VIEN" } : { status: "TU_CHOI", endedAt: now, endedBy: "NGUOI_DON", endReason: note.trim() || "Người đón từ chối" });
    await notify(tx, await guardiansOf(tx, c.studentId), "PUSH",
      accept ? `${c.helper!.name} nhận đón bé ${c.student.name} ${showMonth(c.month)}. Đang chờ cô duyệt.` : `${c.helper!.name} từ chối hợp đồng đón ${showMonth(c.month)}. Bạn có thể tạo lại và mở cho cả trường.`, `/thang/${c.id}`);
    if (accept) await notify(tx, await teachersOf(tx, c.studentId), "PUSH", `Hợp đồng đón theo tháng cần duyệt: bé ${c.student.name}, người đón ${c.helper!.name}.`, `/thang/${c.id}`);
  });
}

// ─────────────────────────── Giáo viên duyệt một lần ───────────────────────────

export async function teacherDecideMonthly(teacherId: string, id: string, approve: boolean, opts: { calledParent?: boolean; note?: string } = {}, now = new Date()) {
  const c = await contractOf(id);
  await requireTeacher(teacherId, c.studentId);
  if (c.status !== "CHO_GIAO_VIEN") throw new AppError("Hợp đồng không ở bước chờ duyệt.");
  const note = (opts.note ?? "").trim();
  await db.$transaction(async (tx) => {
    if (!approve) {
      if (note.length < 3) throw new AppError("Ghi lý do từ chối để phụ huynh biết.");
      await moveContract(tx, c, { status: "TU_CHOI", decidedById: teacherId, decidedAt: now, decisionNote: note, endedAt: now, endedBy: "GIAO_VIEN", endReason: note });
      const msg = `Cô KHÔNG duyệt hợp đồng đón ${showMonth(c.month)} cho ${c.helper!.name}. Lý do: ${note}`;
      await notify(tx, await guardiansOf(tx, c.studentId), "PUSH", msg, `/thang/${c.id}`);
      await notify(tx, [{ userId: c.helper!.id, phone: c.helper!.phone }], "PUSH", msg, `/thang/${c.id}`);
      return;
    }
    if (!opts.calledParent) throw new AppError("Đón theo tháng: cần gọi điện xác minh với phụ huynh rồi tích ô xác nhận.");
    const prof = await tx.helperProfile.findUnique({ where: { userId: c.helperId! } });
    if (prof?.status !== "DA_DUYET") throw new AppError("Người đón không còn được duyệt nhận đón có phí.");
    await moveContract(tx, c, { status: "DA_DUYET", decidedById: teacherId, decidedAt: now, decisionNote: note || null, teacherCalledParent: true });
    await tx.auditLog.create({ data: { actorId: teacherId, action: "DUYET_HOP_DONG_THANG", target: c.id, meta: { helperId: c.helperId } } });
    await notify(tx, await guardiansOf(tx, c.studentId), "PUSH",
      `Cô đã duyệt ${c.helper!.name} đón bé ${c.student.name} ${showMonth(c.month)}. Chuyển trọn gói ${vnd(c.fee)} cho người đón để bắt đầu lịch đón.`, `/thang/${c.id}`);
    await notify(tx, [{ userId: c.helper!.id, phone: c.helper!.phone }], "PUSH", `Cô đã duyệt hợp đồng đón ${showMonth(c.month)}. Lịch bắt đầu khi phụ huynh chuyển trọn gói.`, `/thang/${c.id}`);
  });
}

// ─────────────────────────── Trả trọn gói đầu tháng ───────────────────────────

/** Mã VietQR trọn gói — chỉ phụ huynh của bé thấy, sau khi cô duyệt. */
export async function monthlyPayInfo(userId: string, id: string) {
  const c = await contractOf(id);
  if (!(await isGuardian(userId, c.studentId)) || !c.helperId || !["DA_DUYET", "KET_THUC"].includes(c.status)) return null;
  const prof = await db.helperProfile.findUnique({ where: { userId: c.helperId } });
  if (!prof) return null;
  const note = `DONHO THANG ${c.id.slice(-6)}`;
  return { amount: c.paidAmount ?? c.fee, bank: bankName(prof.bankBin), account: prof.bankAccount, accountName: prof.accountName,
    note: transferNote(note), qr: vietQr({ bin: prof.bankBin, account: prof.bankAccount, amount: c.fee, note }) };
}

export async function markMonthlyPaid(parentId: string, id: string, now = new Date()) {
  const c = await contractOf(id);
  await requireGuardian(parentId, c.studentId);
  if (c.status !== "DA_DUYET") throw new AppError("Chỉ trả trọn gói sau khi cô duyệt hợp đồng.");
  const tiers = await tiersOf([c.helperId!, c.requesterId], now);
  const rate = jobRate(tiers.get(c.helperId!)!, tiers.get(c.requesterId)!, platformRate());
  await db.$transaction(async (tx) => {
    const res = await tx.monthlyContract.updateMany({ where: { id, paidAt: null }, data: { paidAt: now, paidAmount: c.fee, rate, commission: commissionOf(c.fee, rate) } });
    if (res.count !== 1) return;
    await notify(tx, [{ userId: c.helper!.id, phone: c.helper!.phone }], "PUSH",
      `Phụ huynh báo đã chuyển trọn gói ${vnd(c.fee)} đón bé ${c.student.name} ${showMonth(c.month)}. Kiểm tra tài khoản rồi bấm "Đã nhận tiền".`, `/thang/${c.id}`);
  });
  await sweep(now); // hôm nay có buổi thì sinh ngay
}

export async function markMonthlyReceived(userId: string, id: string, now = new Date()) {
  const c = await contractOf(id);
  if (c.helperId !== userId) throw new AppError("Hợp đồng này không phải của bạn.");
  if (c.status !== "DA_DUYET" && c.status !== "KET_THUC") throw new AppError("Hợp đồng chưa được duyệt.");
  // người đón xác nhận đã nhận cũng tính là đã trả (phụ huynh quên bấm)
  if (!c.paidAt) await markMonthlyPaid(c.requesterId, id, now);
  await db.monthlyContract.updateMany({ where: { id, receivedAt: null }, data: { receivedAt: now } });
}

// ─────────────────────────── Huỷ một buổi / báo nghỉ / kết thúc ───────────────────────────

function checkDay(c: Pick<MonthlyContract, "status" | "month" | "weekdays" | "firstDay" | "skipDates" | "missDates" | "endDate">, date: string, now: Date) {
  if (c.status !== "DA_DUYET") throw new AppError("Hợp đồng không còn chạy.");
  if (!daysOf(c).includes(date)) throw new AppError("Ngày này không có buổi đón trong hợp đồng.");
  if (date < vnToday(now)) throw new AppError("Buổi này đã qua.");
  if (c.endDate && date > c.endDate) throw new AppError("Hợp đồng đã kết thúc trước ngày này.");
  if (c.skipDates.includes(date) || c.missDates.includes(date)) throw new AppError("Buổi này đã huỷ rồi.");
}

/** Buổi đã sinh (hôm nay) của hợp đồng, nếu còn hiệu lực. */
async function liveRequest(contractId: string, date: string) {
  const { start, end } = vnDayRange(date);
  return db.pickupRequest.findFirst({ where: { contractId, status: "DA_DUYET", windowStart: { gte: start, lte: end } } });
}

/** Phụ huynh huỷ một buổi (bé nghỉ học…) — không hoàn tiền vì người đón đã giữ lịch. */
export async function skipMonthlyDay(parentId: string, id: string, date: string, now = new Date()) {
  const c = await contractOf(id);
  await requireGuardian(parentId, c.studentId);
  checkDay(c, date, now);
  const r = await liveRequest(id, date);
  if (r) await cancelRequest(parentId, r.id, now);
  await db.$transaction(async (tx) => {
    await tx.monthlyContract.update({ where: { id }, data: { skipDates: { push: date } } });
    if (!r) await notify(tx, [{ userId: c.helper!.id, phone: c.helper!.phone }], "PUSH", `Phụ huynh huỷ buổi đón bé ${c.student.name} ngày ${date.split("-").reverse().join("/")}.`, `/thang/${c.id}`);
  });
}

/** Người đón báo nghỉ một buổi — phụ huynh và cô được báo ngay; buổi này được hoàn tiền khi hợp đồng kết thúc. */
export async function missMonthlyDay(userId: string, id: string, date: string, note = "", now = new Date()) {
  const c = await contractOf(id);
  if (c.helperId !== userId) throw new AppError("Hợp đồng này không phải của bạn.");
  checkDay(c, date, now);
  const r = await liveRequest(id, date);
  if (r) await helperSkipRequest(userId, r.id, note);
  await db.$transaction(async (tx) => {
    await tx.monthlyContract.update({ where: { id }, data: { missDates: { push: date } } });
    if (!r) await notify(tx, await guardiansOf(tx, c.studentId), "PUSH",
      `${c.helper!.name} báo NGHỈ buổi đón bé ${c.student.name} ngày ${date.split("-").reverse().join("/")}${note ? ` (${note})` : ""}. Bạn cần nhờ người khác cho buổi này.`, `/thang/${c.id}`);
  });
}

/**
 * Một bên dừng hợp đồng sớm. Người đón dừng → hoàn mọi buổi còn lại (kể cả hôm nay, huỷ mã hôm nay);
 * phụ huynh dừng → buổi hôm nay vẫn giữ, hoàn các buổi còn lại trừ NOTICE_DAYS buổi báo trước.
 */
export async function endMonthly(userId: string, id: string, reason: string, now = new Date()) {
  const c = await contractOf(id);
  const isParent = await isGuardian(userId, c.studentId);
  if (!isParent && c.helperId !== userId) throw new AppError("Bạn không thuộc hợp đồng này.");
  if (c.status !== "DA_DUYET") throw new AppError("Hợp đồng không còn chạy.");
  const why = reason.trim();
  if (why.length < 3) throw new AppError("Ghi lý do dừng để bên kia biết.");
  const by = isParent ? "PHU_HUYNH" : "NGUOI_DON";
  const today = vnToday(now);
  if (!isParent) {
    const r = await liveRequest(id, today);
    if (r) await helperSkipRequest(userId, r.id, why);
  }
  const endDate = isParent ? today : addDays(today, -1);
  const days = daysOf(c);
  const refund = c.paidAmount ? refundOf(c.paidAmount, days.length, refundableDays({ days, missed: c.missDates, endDate, by })) : 0;
  await db.$transaction(async (tx) => {
    await moveContract(tx, c, {
      status: "KET_THUC", endedAt: now, endedBy: by, endDate, endReason: why, refundDue: refund || null, dropAddress: null, dropLat: null, dropLng: null,
      ...(c.paidAmount && c.rate != null && !c.settlementId && { commission: commissionOf(c.paidAmount - refund, c.rate) }),
    });
    const msg = `Hợp đồng đón bé ${c.student.name} ${showMonth(c.month)} đã dừng (${isParent ? "phụ huynh" : "người đón"} dừng: ${why}).${refund ? ` Người đón hoàn lại ${vnd(refund)} trong ${REFUND_DAYS} ngày.` : ""}`;
    await notify(tx, [...(await guardiansOf(tx, c.studentId)), { userId: c.helper!.id, phone: c.helper!.phone }], "PUSH", msg, `/thang/${c.id}`);
    await notify(tx, await teachersOf(tx, c.studentId), "PUSH", msg, `/thang/${c.id}`);
  });
}

/** Ghi nhận đã hoàn tiền — người đón báo đã chuyển, hoặc phụ huynh báo đã nhận. */
export async function markRefunded(userId: string, id: string, now = new Date()) {
  const c = await contractOf(id);
  if (c.helperId !== userId && !(await isGuardian(userId, c.studentId))) throw new AppError("Bạn không thuộc hợp đồng này.");
  if (!c.refundDue) throw new AppError("Hợp đồng không có khoản hoàn.");
  await db.$transaction(async (tx) => {
    const res = await tx.monthlyContract.updateMany({ where: { id, refundedAt: null }, data: { refundedAt: now } });
    if (res.count !== 1) return;
    await tx.auditLog.create({ data: { actorId: userId, action: "HOAN_TIEN_THANG", target: id, meta: { amount: c.refundDue } } });
    const other = c.helperId === userId ? await guardiansOf(tx, c.studentId) : [{ userId: c.helper!.id, phone: c.helper!.phone }];
    await notify(tx, other, "PUSH", `Đã ghi nhận hoàn ${vnd(c.refundDue!)} cho hợp đồng đón ${showMonth(c.month)}.`, `/thang/${c.id}`);
  });
}

// ─────────────────────────── Xem ───────────────────────────

export type DayState = "SAP_TOI" | "HOM_NAY" | "HOAN_TAT" | "DANG_DON" | "PH_HUY" | "NGUOI_DON_NGHI" | "KHONG_DON" | "SAU_KET_THUC";

/** Chi tiết hợp đồng cho phụ huynh, người đón được giao, hoặc cô lớp của bé. */
export async function monthlyDetail(userId: string, id: string, now = new Date()) {
  await sweep(now);
  const c = await db.monthlyContract.findUnique({
    where: { id },
    include: { student: { include: { class: { include: { school: true } } } }, helper: { include: { helper: true } }, requester: true,
      offers: { include: { user: { include: { helper: true } } }, orderBy: { createdAt: "asc" } },
      requests: { select: { id: true, status: true, windowStart: true }, orderBy: { windowStart: "asc" } } },
  });
  if (!c) return null;
  const role = (await isGuardian(userId, c.studentId)) ? "PHU_HUYNH" : c.helperId === userId ? "NGUOI_DON" : (await isTeacherOfStudent(userId, c.studentId)) ? "GIAO_VIEN" : null;
  if (!role) return null;
  const today = vnToday(now);
  const days = daysOf(c).map((date) => {
    const req = c.requests.find((r) => vnToday(r.windowStart) === date);
    let state: DayState;
    if (c.missDates.includes(date)) state = "NGUOI_DON_NGHI";
    else if (c.skipDates.includes(date)) state = "PH_HUY";
    else if (c.endDate && date > c.endDate) state = "SAU_KET_THUC";
    else if (req) state = req.status === "HOAN_TAT" ? "HOAN_TAT" : req.status === "DA_DUYET" || req.status === "DA_GIAO" ? "DANG_DON" : "KHONG_DON";
    else state = date < today ? "KHONG_DON" : date === today ? "HOM_NAY" : "SAP_TOI";
    return { date, state, requestId: req?.id ?? null };
  });
  return { c, role, days, today, total: days.length };
}

/** Hợp đồng của tôi: con tôi (phụ huynh), tôi đón (người đón), lớp tôi (giáo viên). */
export async function myMonthly(userId: string) {
  const classIds = (await db.teacherAssignment.findMany({ where: { userId }, select: { classId: true } })).map((t) => t.classId);
  return db.monthlyContract.findMany({
    where: { OR: [{ student: { guardians: { some: { userId } } } }, { helperId: userId }, { student: { classId: { in: classIds } }, status: { in: ["CHO_GIAO_VIEN", "DA_DUYET", "KET_THUC"] } }] },
    include: { student: { include: { class: true } }, helper: true },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
}

/** Nhóm lọc hợp đồng trên trang quản lý đón theo tháng. */
export const MONTHLY_FILTER = {
  "dang-chay": ["DA_DUYET"],
  cho: ["TIM_NGUOI", "CHO_NGUOI_DON", "CHO_GIAO_VIEN"],
  "da-xong": ["TU_CHOI", "DA_HUY", "KET_THUC"],
} as const;

/** Các buổi đón theo hợp đồng tháng trong hôm nay mà người này liên quan (phụ huynh, người đón, cô lớp). */
export async function monthlySessionsToday(userId: string, now = new Date()) {
  await sweep(now);
  const classIds = (await db.teacherAssignment.findMany({ where: { userId }, select: { classId: true } })).map((t) => t.classId);
  const { start, end } = vnDayRange(vnToday(now));
  return db.pickupRequest.findMany({
    where: {
      contractId: { not: null }, windowStart: { gte: start, lte: end },
      OR: [{ student: { guardians: { some: { userId } } } }, { delegateId: userId }, { student: { classId: { in: classIds } } }],
    },
    include: { student: { include: { class: true } }, requester: true },
    orderBy: { windowStart: "asc" },
  });
}
