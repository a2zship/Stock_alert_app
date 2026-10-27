// Đón hộ có phí: phụ huynh CÙNG TRƯỜNG đăng ký làm người đón có phí, giáo viên lớp con họ duyệt một lần.
// Tiền: người nhờ chuyển khoản VietQR THẲNG cho người đón sau khi bé về an toàn — app không giữ tiền, chỉ ghi sổ.
// Nền tảng trích % thu nhập người đón; người đón tự nộp định kỳ, nợ quá hạn thì tạm không nhận việc có phí mới.
import { commissionOf, OWED_DAYS, OWED_LIMIT, parsePay } from "@/domain/money";
import { parseDataUrl } from "@/domain/photo";
import { addDays, showWindow, vnDateTime, vnToday } from "@/domain/time";
import { bankName, BANKS, transferNote, vietQr } from "@/domain/vietqr";
import { isGuardian } from "./access";
import { AppError, db, platformAccount, platformRate } from "./db";
import { guardiansOf, notify } from "./notify";

// ─────────────────────────── Đăng ký & duyệt ───────────────────────────

/** Trường của phụ huynh (theo con). Có con ở nhiều trường thì lấy trường đầu tiên. */
async function schoolOfParent(userId: string) {
  const g = await db.guardian.findFirst({ where: { userId }, include: { student: { include: { class: true } } }, orderBy: { student: { name: "asc" } } });
  if (!g) throw new AppError("Chỉ phụ huynh có con đang học ở trường mới đăng ký đón hộ có phí.");
  return g.student.class.schoolId;
}

/** Giáo viên duyệt: GV lớp có con của người đăng ký. */
async function teachersOfHelper(userId: string) {
  const ts = await db.teacherAssignment.findMany({ where: { class: { students: { some: { guardians: { some: { userId } } } } } }, include: { user: true } });
  return [...new Map(ts.map((t) => [t.userId, { userId: t.userId, phone: t.user.phone }])).values()];
}

export type HelperInput = { cccdLast4: string; photo: string; bankBin: string; bankAccount: string; accountName: string; agree: boolean };

export async function registerHelper(userId: string, input: HelperInput) {
  const schoolId = await schoolOfParent(userId);
  if (!input.agree) throw new AppError("Cần đồng ý quy định người đón có phí.");
  if (!/^\d{4}$/.test(input.cccdLast4)) throw new AppError("Nhập đúng 4 số cuối CCCD.");
  if (!BANKS.some((b) => b.bin === input.bankBin)) throw new AppError("Chọn ngân hàng nhận tiền.");
  const account = input.bankAccount.replace(/\s/g, "");
  if (!/^\d{6,19}$/.test(account)) throw new AppError("Số tài khoản chỉ gồm 6–19 chữ số.");
  const name = transferNote(input.accountName);
  if (name.length < 4) throw new AppError("Nhập tên chủ tài khoản (in hoa, không dấu).");
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (transferNote(me.name).split(" ").at(-1) !== name.split(" ").at(-1)) {
    throw new AppError("Tài khoản phải đứng tên chính bạn (tên chủ tài khoản không khớp tên trong app).");
  }
  const old = await db.helperProfile.findUnique({ where: { userId } });
  if (old?.status === "TAM_DUNG") throw new AppError("Tài khoản người đón có phí của bạn đang bị tạm dừng. Liên hệ giáo viên.");
  if (!input.photo && !old) throw new AppError("Cần chụp ảnh chân dung để giáo viên nhận diện bạn.");

  await db.$transaction(async (tx) => {
    let photoId = old?.photoId;
    if (input.photo) {
      const p = parseDataUrl(input.photo);
      if ("error" in p) throw new AppError(p.error);
      photoId = (await tx.photo.create({ data: { kind: "CHAN_DUNG", mime: p.mime, bytes: p.bytes, ownerId: userId } })).id;
    }
    const data = { schoolId, cccdLast4: input.cccdLast4, photoId: photoId!, bankBin: input.bankBin, bankAccount: account, accountName: name,
      status: "CHO_DUYET" as const, note: null, reviewedById: null, reviewedAt: null };
    await tx.helperProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await notify(tx, await teachersOfHelper(userId), "PUSH", `${me.name} đăng ký làm người đón có phí của trường. Cô/thầy xem ảnh, CCCD và duyệt.`, "/giao-vien/nguoi-don-co-phi");
  });
}

/** Hồ sơ người đón có phí mà giáo viên này được duyệt (có con trong lớp mình). */
export async function helpersToReview(teacherId: string) {
  const classIds = (await db.teacherAssignment.findMany({ where: { userId: teacherId }, select: { classId: true } })).map((t) => t.classId);
  return db.helperProfile.findMany({
    where: { user: { guardianOf: { some: { student: { classId: { in: classIds } } } } } },
    include: { user: { include: { guardianOf: { include: { student: { include: { class: true } } } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function reviewHelper(teacherId: string, profileId: string, decision: "approve" | "reject" | "suspend", note = "") {
  const prof = await db.helperProfile.findUnique({ where: { id: profileId }, include: { user: true } });
  if (!prof || !(await teachersOfHelper(prof.userId)).some((t) => t.userId === teacherId)) throw new AppError("Bạn không phụ trách lớp có con của người này.");
  const why = note.trim();
  if (decision !== "approve" && why.length < 3) throw new AppError("Ghi lý do để phụ huynh biết.");
  const status = decision === "approve" ? "DA_DUYET" : decision === "reject" ? "TU_CHOI" : "TAM_DUNG";
  await db.$transaction(async (tx) => {
    await tx.helperProfile.update({ where: { id: profileId }, data: { status, note: why || null, reviewedById: teacherId, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: teacherId, action: `NGUOI_DON_CO_PHI_${status}`, target: prof.userId, meta: { note: why } } });
    const msg = status === "DA_DUYET" ? "Bạn đã được duyệt làm người đón có phí. Mở mục Kiếm thêm để xem việc đón trong trường."
      : status === "TU_CHOI" ? `Đăng ký người đón có phí chưa được duyệt. Lý do: ${why}` : `Tài khoản người đón có phí bị tạm dừng. Lý do: ${why}`;
    await notify(tx, [{ userId: prof.userId, phone: prof.user.phone }], "PUSH", msg, "/kiem-tien");
  });
}

// ─────────────────────────── Điều kiện nhận việc có phí ───────────────────────────

/** Phí nền tảng còn nợ (đã được trả thù lao nhưng chưa nộp phí). */
export async function owedOf(userId: string, now = new Date()) {
  const rows = await db.pickupRequest.findMany({
    where: { delegateId: userId, fee: { gt: 0 }, paidAt: { not: null }, settlementId: null },
    select: { id: true, commission: true, paidAt: true },
  });
  const amount = rows.reduce((s, r) => s + (r.commission ?? 0), 0);
  const oldest = rows.reduce<Date | null>((m, r) => (!m || r.paidAt! < m ? r.paidAt! : m), null);
  const overdue = amount >= OWED_LIMIT && !!oldest && now.getTime() - oldest.getTime() > OWED_DAYS * 86_400_000;
  return { amount, ids: rows.map((r) => r.id), overdue };
}

/** Người này nhận được lời nhờ có phí của lớp/trường này không? Ném lỗi kèm lý do dễ hiểu. */
export async function requirePaidHelper(userId: string, classId: string, now = new Date()) {
  const prof = await db.helperProfile.findUnique({ where: { userId } });
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId } });
  if (!prof || prof.status !== "DA_DUYET") throw new AppError("Lời nhờ có thù lao: bạn cần đăng ký người đón có phí và được cô duyệt (mục Kiếm thêm).");
  if (prof.schoolId !== cls.schoolId) throw new AppError("Chỉ phụ huynh cùng trường mới nhận đón có phí.");
  if ((await owedOf(userId, now)).overdue) throw new AppError(`Bạn còn nợ phí nền tảng quá ${OWED_DAYS} ngày. Nộp phí ở mục Kiếm thêm để nhận việc tiếp.`);
  return prof;
}

// ─────────────────────────── Bảng việc trong trường ───────────────────────────

/** Lời nhờ có thù lao đang mở trong trường — người ngoài lớp chỉ thấy lớp, giờ, phường/xã, thù lao (không thấy tên bé). */
export async function paidBoard(userId: string, now = new Date()) {
  const prof = await db.helperProfile.findUnique({ where: { userId } });
  if (!prof || prof.status !== "DA_DUYET") return [];
  const today = vnToday(now);
  const myKids = new Set((await db.guardian.findMany({ where: { userId }, select: { studentId: true } })).map((g) => g.studentId));
  const posts = await db.chatPost.findMany({
    where: { kind: "NHO_DON", status: "MO", fee: { gt: 0 }, date: { gte: today, lte: addDays(today, 7) }, class: { schoolId: prof.schoolId }, authorId: { not: userId } },
    include: { class: true, offers: { select: { userId: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  const rate = platformRate();
  return posts
    .filter((p) => !myKids.has(p.studentId!) && vnDateTime(p.date!, p.class.pickupEnd) > now)
    .map((p) => ({
      id: p.id, className: p.class.name, ward: p.dropWard, note: p.body, fee: p.fee!, net: p.fee! - commissionOf(p.fee!, rate),
      when: showWindow(vnDateTime(p.date!, p.class.pickupStart), vnDateTime(p.date!, p.class.pickupEnd)),
      offered: p.offers.some((o) => o.userId === userId), offers: p.offers.length,
    }));
}

// ─────────────────────────── Trả tiền ───────────────────────────

async function paidRequest(requestId: string) {
  const r = await db.pickupRequest.findUnique({ where: { id: requestId }, include: { student: true } });
  if (!r || !r.fee) throw new AppError("Yêu cầu này không có thù lao.");
  return r;
}

/** Thông tin chuyển khoản cho phụ huynh — chỉ khi bé đã về an toàn. `want` = số phụ huynh tự chọn (≥ mức tối thiểu). */
export async function payInfo(userId: string, requestId: string, want?: unknown) {
  const r = await paidRequest(requestId);
  if (!(await isGuardian(userId, r.studentId))) return null;
  if (r.status !== "HOAN_TAT") return null;
  const prof = await db.helperProfile.findUnique({ where: { userId: r.delegateId } });
  if (!prof) return null;
  const picked = parsePay(want, r.fee!);
  const amount = r.paidAmount ?? (typeof picked === "number" ? picked : r.fee!);
  const note = `DONHO ${r.id.slice(-6)} CAM ON`;
  return {
    min: r.fee!, amount, error: typeof picked === "object" ? picked.error : null,
    bank: bankName(prof.bankBin), account: prof.bankAccount, accountName: prof.accountName, note: transferNote(note),
    qr: vietQr({ bin: prof.bankBin, account: prof.bankAccount, amount, note }), paidAt: r.paidAt, receivedAt: r.receivedAt,
  };
}

export async function markPaid(userId: string, requestId: string, opts: { amount?: unknown; thanks?: string } = {}, now = new Date()) {
  const r = await paidRequest(requestId);
  if (!(await isGuardian(userId, r.studentId))) throw new AppError("Bạn không phải người giám hộ của trẻ này.");
  if (r.status !== "HOAN_TAT") throw new AppError("Chỉ trả thù lao sau khi bé về an toàn.");
  const paid = parsePay(opts.amount, r.fee!);
  const thanks = (opts.thanks ?? "").trim().slice(0, 200);
  if (typeof paid === "object") throw new AppError(paid.error);
  await db.$transaction(async (tx) => {
    // phí nền tảng tính trên số thực chuyển (phụ huynh có thể cảm ơn thêm)
    const res = await tx.pickupRequest.updateMany({ where: { id: r.id, paidAt: null },
      data: { paidAt: now, paidAmount: paid, commission: commissionOf(paid, platformRate()), ...(thanks && !r.thanks && { thanks }) } });
    if (res.count !== 1) return;
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: userId, actorRole: "PHU_HUYNH", action: "DA_TRA_THU_LAO", note: String(paid) } });
    await notify(tx, [{ userId: r.delegateId, phone: r.delegatePhone }], "PUSH",
      `Phụ huynh báo đã chuyển ${new Intl.NumberFormat("vi-VN").format(paid)}đ cảm ơn bạn đã đón bé ${r.student.name}${thanks ? `: “${thanks}”` : ""}. Kiểm tra tài khoản rồi bấm "Đã nhận tiền".`, `/yeu-cau/${r.id}`);
  });
}

export async function markReceived(userId: string, requestId: string, now = new Date()) {
  const r = await paidRequest(requestId);
  if (r.delegateId !== userId) throw new AppError("Yêu cầu này không gửi cho bạn.");
  if (r.status !== "HOAN_TAT") throw new AppError("Lượt đón chưa hoàn tất.");
  await db.$transaction(async (tx) => {
    // người đón xác nhận đã nhận cũng tính là đã trả (phụ huynh quên bấm)
    const res = await tx.pickupRequest.updateMany({ where: { id: r.id, receivedAt: null }, data: { receivedAt: now, paidAt: r.paidAt ?? now, paidAmount: r.paidAmount ?? r.fee } });
    if (res.count === 1) await tx.requestEvent.create({ data: { requestId: r.id, actorId: userId, actorRole: "NGUOI_DON", action: "DA_NHAN_THU_LAO" } });
  });
}

/** Người đón nhắc phụ huynh chuyển thù lao — tối đa một lần mỗi 24 giờ. */
export async function remindPayment(userId: string, requestId: string, now = new Date()) {
  const r = await paidRequest(requestId);
  if (r.delegateId !== userId) throw new AppError("Yêu cầu này không gửi cho bạn.");
  if (r.status !== "HOAN_TAT" || r.paidAt) throw new AppError("Không cần nhắc.");
  if (r.payRemindedAt && now.getTime() - r.payRemindedAt.getTime() < 86_400_000) throw new AppError("Bạn vừa nhắc rồi, thử lại sau 24 giờ.");
  await db.$transaction(async (tx) => {
    await tx.pickupRequest.update({ where: { id: r.id }, data: { payRemindedAt: now } });
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH",
      `Nhắc nhẹ: thù lao ${new Intl.NumberFormat("vi-VN").format(r.fee!)}đ cho ${r.delegateName} (đón bé ${r.student.name}) chưa được chuyển. Mở yêu cầu để quét mã chuyển khoản.`, `/yeu-cau/${r.id}`);
  });
}

// ─────────────────────────── Thu nhập & phí nền tảng ───────────────────────────

export async function earnings(userId: string, now = new Date()) {
  const jobs = await db.pickupRequest.findMany({
    where: { delegateId: userId, fee: { gt: 0 } },
    include: { student: { include: { class: true } } },
    orderBy: { windowStart: "desc" },
    take: 50,
  });
  const done = jobs.filter((j) => j.status === "HOAN_TAT");
  const month = vnToday(now).slice(0, 7);
  const got = (j: { fee: number | null; paidAmount: number | null }) => j.paidAmount ?? j.fee!;
  const inMonth = done.filter((j) => j.closedAt && vnToday(j.closedAt).slice(0, 7) === month);
  const owed = await owedOf(userId, now);
  const acct = platformAccount();
  const settleNote = `DONHO PHI ${userId.slice(-6)}`;
  return {
    rate: platformRate(),
    month: { jobs: inMonth.length, gross: inMonth.reduce((s, j) => s + got(j), 0), net: inMonth.reduce((s, j) => s + got(j) - (j.commission ?? 0), 0) },
    waitingPay: done.filter((j) => !j.paidAt).reduce((s, j) => s + j.fee!, 0),
    owed,
    settleQr: acct && owed.amount > 0 ? { bank: bankName(acct.bin), account: acct.account, name: acct.name, note: transferNote(settleNote),
      qr: vietQr({ bin: acct.bin, account: acct.account, amount: owed.amount, note: settleNote }) } : null,
    platformReady: !!acct,
    jobs: jobs.map((j) => ({ id: j.id, status: j.status, className: j.student.class.name, when: showWindow(j.windowStart, j.windowEnd),
      fee: j.fee!, paid: j.paidAmount, commission: j.commission ?? 0, paidAt: j.paidAt, receivedAt: j.receivedAt, settled: !!j.settlementId })),
  };
}

/** Người đón báo đã chuyển phí nền tảng còn nợ → ghi một lần nộp, gắn các lượt đón. [Cần màn quản trị đối soát sao kê.] */
export async function settleCommission(userId: string, now = new Date()) {
  const owed = await owedOf(userId, now);
  if (owed.amount <= 0) throw new AppError("Bạn không còn nợ phí nền tảng.");
  await db.$transaction(async (tx) => {
    const st = await tx.settlement.create({ data: { userId, amount: owed.amount, createdAt: now } });
    const res = await tx.pickupRequest.updateMany({ where: { id: { in: owed.ids }, settlementId: null }, data: { settlementId: st.id } });
    if (res.count !== owed.ids.length) throw new AppError("Số liệu vừa thay đổi, tải lại trang rồi thử lại.");
    await tx.auditLog.create({ data: { actorId: userId, action: "NOP_PHI_NEN_TANG", target: st.id, meta: { amount: owed.amount } } });
  });
}
