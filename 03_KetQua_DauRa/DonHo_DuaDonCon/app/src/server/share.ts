// Giới thiệu bạn bè (tín dụng trừ phí) + chia sẻ doanh thu với nhà trường và giáo viên (quy tắc ở domain/share.ts).
// Ghi sổ ngay lúc nền tảng thu tiền (mua gói thành viên, người đón nộp phí nền tảng), trong cùng giao dịch.
// App vẫn không giữ tiền: nền tảng tự chuyển cho trường/cô hằng tháng, bấm "Đã chuyển" ở màn quản trị.
import type { Prisma } from "@prisma/client";
import {
  canClaimRef, CREDIT_HOLD_DAYS, evenSplit, isPayable, makeRefCode, parseRefCode, payableFrom, proRata, refActive, refEndsAt,
  splitShares, vnMonth, type SharePart,
} from "@/domain/share";
import { bankName, BANKS, transferNote, vietQr } from "@/domain/vietqr";
import { AppError, db } from "./db";
import { notify, type Recipient } from "./notify";

type Tx = Prisma.TransactionClient;
type Source = "THANH_VIEN" | "PHI_NEN_TANG";

// ─────────────────────────── Mã giới thiệu ───────────────────────────

/** Mã của người dùng — tạo khi cần lần đầu. */
export async function ensureRefCode(userId: string): Promise<string> {
  const me = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { refCode: true } });
  if (me.refCode) return me.refCode;
  for (let i = 0; i < 5; i++) {
    const code = makeRefCode();
    const res = await db.user.updateMany({ where: { id: userId, refCode: null }, data: { refCode: code } }).catch(() => null);
    if (res) return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { refCode: true } })).refCode!;
  }
  throw new AppError("Chưa tạo được mã, thử lại.");
}

/** Kiểm mã trước khi gửi mã đăng ký (để báo sai ngay). */
export async function checkRefCode(v: unknown) {
  const code = parseRefCode(v);
  if (code && typeof code === "object") throw new AppError(code.error);
  if (code && !(await db.user.count({ where: { refCode: code } }))) throw new AppError("Mã giới thiệu không đúng. Kiểm tra lại hoặc để trống.");
  return code;
}

/** Gắn người giới thiệu cho một tài khoản (một lần, không tự giới thiệu, không giới thiệu chéo hai chiều). */
export async function applyReferral(tx: Tx, userId: string, code: string, now: Date) {
  const ref = await tx.user.findUnique({ where: { refCode: code } });
  if (!ref) throw new AppError("Mã giới thiệu không đúng.");
  if (ref.id === userId) throw new AppError("Không dùng mã của chính mình.");
  if (ref.referredById === userId) throw new AppError("Người này đã dùng mã của bạn — không giới thiệu chéo được.");
  const res = await tx.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: ref.id, referredAt: now } });
  if (res.count !== 1) throw new AppError("Tài khoản này đã có người giới thiệu.");
  const me = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  await tx.auditLog.create({ data: { actorId: userId, action: "NHAP_MA_GIOI_THIEU", target: ref.id, meta: { code } } });
  await notify(tx, [{ userId: ref.id, phone: ref.phone }], "PUSH",
    `${me.name} đã đăng ký bằng mã giới thiệu của bạn. Bạn nhận 20% doanh thu nền tảng từ người này trong 12 tháng, dạng tín dụng trừ phí.`, "/gioi-thieu");
}

/** Quên nhập mã lúc đăng ký: nhập bổ sung trong 7 ngày đầu. */
export async function claimReferral(userId: string, v: unknown, now = new Date()) {
  const code = await checkRefCode(v);
  if (!code) throw new AppError("Nhập mã giới thiệu.");
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (me.referredById) throw new AppError("Tài khoản này đã có người giới thiệu.");
  if (!canClaimRef(me.createdAt, now)) throw new AppError("Chỉ nhập mã giới thiệu trong 7 ngày đầu sau khi đăng ký.");
  await db.$transaction((tx) => applyReferral(tx, userId, code, now));
}

// ─────────────────────────── Tín dụng ───────────────────────────

/** Khoá theo người dùng trong giao dịch: hai lần trừ tín dụng cùng lúc không dùng trùng một khoản. */
export const lockUser = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

/** Nguồn đã bị huỷ khi đối soát (gói thành viên HUY) → các dòng chia từ nó không tính. */
async function voidedSources(tx: Tx | typeof db, sourceIds: string[]) {
  if (!sourceIds.length) return new Set<string>();
  const rows = await tx.membership.findMany({ where: { id: { in: sourceIds }, status: "HUY" }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** Tín dụng giới thiệu: dùng được (sau 7 ngày đối soát), đang chờ, đã dùng. */
export async function creditBalance(userId: string, now = new Date(), tx: Tx | typeof db = db) {
  const rows = await tx.shareEntry.findMany({ where: { userId, kind: "GIOI_THIEU", status: { not: "HUY" } }, select: { amount: true, createdAt: true, sourceId: true } });
  const voided = await voidedSources(tx, rows.map((r) => r.sourceId));
  const live = rows.filter((r) => !voided.has(r.sourceId));
  const cut = now.getTime() - CREDIT_HOLD_DAYS * 86_400_000;
  const earned = live.filter((r) => r.createdAt.getTime() <= cut).reduce((s, r) => s + r.amount, 0);
  const pending = live.filter((r) => r.createdAt.getTime() > cut).reduce((s, r) => s + r.amount, 0);
  const uses = await tx.creditUse.findMany({ where: { userId }, select: { amount: true, refId: true } });
  const back = await voidedSources(tx, uses.map((u) => u.refId)); // gói bị huỷ khi đối soát → trả lại tín dụng đã dùng
  const used = uses.filter((u) => !back.has(u.refId)).reduce((s, u) => s + u.amount, 0);
  return { available: Math.max(0, earned - used), pending, used, total: earned + pending };
}

/** Trừ tín dụng cho một khoản phải trả nền tảng; trả về số đã trừ. Gọi trong giao dịch đã lockUser. */
export async function useCredit(tx: Tx, userId: string, due: number, purpose: Source, refId: string, now: Date) {
  const { available } = await creditBalance(userId, now, tx);
  const amount = Math.min(available, due);
  if (amount > 0) await tx.creditUse.create({ data: { userId, amount, purpose, refId, createdAt: now } });
  return amount;
}

// ─────────────────────────── Ghi sổ chia sẻ ───────────────────────────

async function classInfo(tx: Tx, classIds: string[]) {
  const rows = await tx.class.findMany({ where: { id: { in: classIds } }, include: { school: { select: { teacherShare: true } }, teachers: { select: { userId: true } } } });
  return new Map(rows.map((c) => [c.id, { schoolId: c.schoolId, teacherShare: c.school.teacherShare, teacherIds: c.teachers.map((t) => t.userId).sort() }]));
}

async function partsFor(tx: Tx, items: { classId: string; base: number }[]): Promise<SharePart[]> {
  const info = await classInfo(tx, [...new Set(items.map((i) => i.classId))]);
  return items.filter((i) => info.has(i.classId)).map((i) => ({ ...i, ...info.get(i.classId)! }));
}

/** Ghi các dòng chia cho một khoản tiền mặt nền tảng vừa thu. */
async function record(tx: Tx, source: Source, sourceId: string, fromUserId: string, items: { classId: string; base: number }[], now: Date) {
  const from = await tx.user.findUniqueOrThrow({ where: { id: fromUserId }, select: { referredById: true, referredAt: true } });
  const referrer = from.referredById && refActive(from.referredAt, now) ? from.referredById : null;
  const lines = splitShares(await partsFor(tx, items), referrer);
  if (!lines.length) return;
  await tx.shareEntry.createMany({ data: lines.map((l) => ({ ...l, source, sourceId, fromUserId, month: vnMonth(now), createdAt: now })) });
}

/** Gói thành viên: tiền mặt chia đều cho các lớp có con của người mua. */
export async function recordMembership(tx: Tx, membershipId: string, userId: string, cash: number, now: Date) {
  if (cash <= 0) return;
  const kids = await tx.guardian.findMany({ where: { userId }, select: { student: { select: { classId: true } } } });
  const classIds = [...new Set(kids.map((k) => k.student.classId))].sort();
  const split = evenSplit(cash, classIds.length);
  await record(tx, "THANH_VIEN", membershipId, userId, classIds.map((classId, i) => ({ classId, base: split[i] })), now);
}

/** Người đón nộp phí nền tảng: mỗi lượt/hợp đồng tính cho lớp của bé được đón, theo tỉ lệ tiền mặt thực nộp. */
export async function recordSettlement(tx: Tx, settlementId: string, userId: string, items: { classId: string; commission: number }[], cash: number, now: Date) {
  if (cash <= 0 || !items.length) return;
  const split = proRata(items.map((i) => i.commission), cash);
  await record(tx, "PHI_NEN_TANG", settlementId, userId, items.map((it, i) => ({ classId: it.classId, base: split[i] })), now);
}

// ─────────────────────────── Trang "Giới thiệu bạn bè" ───────────────────────────

export async function referralView(userId: string, now = new Date()) {
  const code = await ensureRefCode(userId);
  const me = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { referredBy: { select: { name: true } } } });
  const referrals = await db.user.findMany({
    where: { referredById: userId }, orderBy: { referredAt: "desc" },
    select: { id: true, name: true, referredAt: true, _count: { select: { guardianOf: true } } },
  });
  const earned = await db.shareEntry.groupBy({ by: ["fromUserId"], where: { userId, kind: "GIOI_THIEU", status: { not: "HUY" } }, _sum: { amount: true } });
  const byFrom = new Map(earned.map((e) => [e.fromUserId, e._sum.amount ?? 0]));
  const history = await db.shareEntry.findMany({ where: { userId, kind: "GIOI_THIEU" }, orderBy: { createdAt: "desc" }, take: 30 });
  const names = new Map(referrals.map((r) => [r.id, r.name]));
  return {
    code, balance: await creditBalance(userId, now),
    referredBy: me.referredBy?.name ?? null,
    canClaim: !me.referredById && canClaimRef(me.createdAt, now),
    referrals: referrals.map((r) => ({
      // chỉ hiện tên gọi (chữ cuối), không lộ họ tên đầy đủ của người khác
      name: r.name.split(" ").slice(-2).join(" "), since: r.referredAt!, until: refEndsAt(r.referredAt!), active: refActive(r.referredAt, now),
      parent: r._count.guardianOf > 0, earned: byFrom.get(r.id) ?? 0,
    })),
    history: history.map((h) => ({ id: h.id, at: h.createdAt, source: h.source, amount: h.amount, status: h.status, who: (names.get(h.fromUserId) ?? "").split(" ").slice(-2).join(" ") })),
    uses: await db.creditUse.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  };
}

// ─────────────────────────── Giáo viên & nhà trường ───────────────────────────

export type PayInput = { bankBin?: unknown; bankAccount?: unknown; accountName?: unknown };

function parsePayAccount(input: PayInput) {
  const bin = String(input.bankBin ?? "");
  if (!BANKS.some((b) => b.bin === bin)) throw new AppError("Chọn ngân hàng nhận tiền.");
  const account = String(input.bankAccount ?? "").replace(/\s/g, "");
  if (!/^\d{6,19}$/.test(account)) throw new AppError("Số tài khoản chỉ gồm 6–19 chữ số.");
  const name = transferNote(String(input.accountName ?? ""));
  if (name.length < 4) throw new AppError("Nhập tên chủ tài khoản (in hoa, không dấu).");
  return { bin, account, name };
}

/** Tài khoản nhận của giáo viên — phải đứng tên chính mình. */
export async function savePayAccount(userId: string, input: PayInput) {
  if (!(await db.teacherAssignment.count({ where: { userId } }))) throw new AppError("Chỉ giáo viên mới nhận phần chia sẻ.");
  const p = parsePayAccount(input);
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (transferNote(me.name).split(" ").at(-1) !== p.name.split(" ").at(-1)) throw new AppError("Tài khoản phải đứng tên chính bạn (tên chủ tài khoản không khớp tên trong app).");
  const data = { bankBin: p.bin, bankAccount: p.account, accountName: p.name };
  await db.payoutAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await db.auditLog.create({ data: { actorId: userId, action: "TK_NHAN_CHIA_SE", target: userId, meta: { bank: p.bin } } });
}

async function requireSchoolAdmin(userId: string, schoolId: string) {
  if (!(await db.schoolAdmin.count({ where: { userId, schoolId } }))) throw new AppError("Chỉ ban giám hiệu của trường mới đổi được.");
}

/** Tài khoản nhận của trường (tài khoản tổ chức, không kiểm tên cá nhân). */
export async function saveSchoolPay(userId: string, schoolId: string, input: PayInput) {
  await requireSchoolAdmin(userId, schoolId);
  const p = parsePayAccount(input);
  await db.school.update({ where: { id: schoolId }, data: { payBin: p.bin, payAccount: p.account, payName: p.name } });
  await db.auditLog.create({ data: { actorId: userId, action: "TK_NHAN_CHIA_SE_TRUONG", target: schoolId, meta: { bank: p.bin } } });
}

/** Trường bật/tắt phần chia cho giáo viên (tắt thì phần đó gộp về trường). Áp dụng cho doanh thu phát sinh từ lúc đổi. */
export async function setTeacherShare(userId: string, schoolId: string, on: boolean) {
  await requireSchoolAdmin(userId, schoolId);
  await db.$transaction(async (tx) => {
    await tx.school.update({ where: { id: schoolId }, data: { teacherShare: on } });
    await tx.auditLog.create({ data: { actorId: userId, action: on ? "BAT_CHIA_SE_GIAO_VIEN" : "TAT_CHIA_SE_GIAO_VIEN", target: schoolId } });
    const ts = await tx.teacherAssignment.findMany({ where: { class: { schoolId } }, include: { user: true } });
    await notify(tx, ts.map((t) => ({ userId: t.userId, phone: t.user.phone })), "PUSH",
      on ? "Nhà trường đã bật phần chia sẻ doanh thu cho giáo viên từ hôm nay." : "Nhà trường đã chuyển phần chia sẻ của giáo viên về quỹ trường từ hôm nay. Phần đã phát sinh trước đó giữ nguyên.", "/chia-se");
  });
}

type Row = { month: string; status: string; amount: number; base: number; source: string; payoutId: string | null; sourceId: string };

/** Gộp theo tháng: tổng, trạng thái (tạm tính / chờ chuyển / đã chuyển). */
function byMonth(rows: Row[], voided: Set<string>, now: Date) {
  const m = new Map<string, { month: string; amount: number; base: number; paid: number; from: string }>();
  for (const r of rows) {
    if (r.status === "HUY" || voided.has(r.sourceId)) continue;
    const x = m.get(r.month) ?? { month: r.month, amount: 0, base: 0, paid: 0, from: payableFrom(r.month) };
    x.amount += r.amount; x.base += r.base; if (r.status === "DA_TRA") x.paid += r.amount;
    m.set(r.month, x);
  }
  return [...m.values()].sort((a, b) => b.month.localeCompare(a.month))
    .map((x) => ({ ...x, state: x.paid >= x.amount ? "DA_TRA" : isPayable(x.month, now) ? "CHO_CHUYEN" : "TAM_TINH" }));
}

/** Màn "Chia sẻ doanh thu" của giáo viên và ban giám hiệu. */
export async function shareView(userId: string, now = new Date()) {
  const teaches = await db.teacherAssignment.findMany({ where: { userId }, include: { class: { include: { school: true } } } });
  const mine = await db.shareEntry.findMany({ where: { userId, kind: "GIAO_VIEN" } });
  const schools = await db.schoolAdmin.findMany({ where: { userId }, include: { school: true } });
  const schoolRows = schools.length ? await db.shareEntry.findMany({ where: { schoolId: { in: schools.map((s) => s.schoolId) }, kind: { in: ["TRUONG", "GIAO_VIEN"] } } }) : [];
  const voided = await voidedSources(db, [...mine, ...schoolRows].map((r) => r.sourceId));
  return {
    teacher: teaches.length ? {
      classes: teaches.map((t) => ({ name: t.class.name, school: t.class.school.name, on: t.class.school.teacherShare })),
      account: await db.payoutAccount.findUnique({ where: { userId } }),
      months: byMonth(mine, voided, now),
    } : null,
    schools: schools.map(({ school }) => ({
      id: school.id, name: school.name, teacherShare: school.teacherShare,
      account: school.payAccount ? { bank: bankName(school.payBin!), bankBin: school.payBin!, account: school.payAccount, name: school.payName! } : null,
      months: byMonth(schoolRows.filter((r) => r.schoolId === school.id && r.kind === "TRUONG"), voided, now),
      teacherMonths: byMonth(schoolRows.filter((r) => r.schoolId === school.id && r.kind === "GIAO_VIEN"), voided, now),
    })),
  };
}

// ─────────────────────────── Quản trị nền tảng: chuyển tiền cho trường/cô ───────────────────────────

/** Số điện thoại quản trị nền tảng (biến ADMIN_PHONES, cách nhau dấu phẩy). */
export const isPlatformAdmin = (phone: string) =>
  (process.env.ADMIN_PHONES ?? "").split(",").map((p) => p.trim()).filter(Boolean).includes(phone);

export async function requireAdmin(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!isPlatformAdmin(u.phone)) throw new AppError("Chỉ quản trị nền tảng.");
}

/** Các khoản đến hạn chuyển: gộp theo (trường hoặc giáo viên) × tháng. */
export async function payoutQueue(userId: string, now = new Date()) {
  await requireAdmin(userId);
  const rows = await db.shareEntry.findMany({
    where: { kind: { in: ["TRUONG", "GIAO_VIEN"] }, status: "TAM_TINH" },
    include: { school: true, user: { include: { payAccount: true } } },
    orderBy: { month: "asc" },
  });
  const voided = await voidedSources(db, rows.map((r) => r.sourceId));
  const groups = new Map<string, { key: string; kind: "TRUONG" | "GIAO_VIEN"; month: string; who: string; school: string; amount: number; ids: string[];
    pay: { bin: string; account: string; name: string } | null; verified: boolean }>();
  for (const r of rows) {
    if (voided.has(r.sourceId) || !isPayable(r.month, now)) continue;
    const kind = r.kind as "TRUONG" | "GIAO_VIEN";
    const key = `${kind}:${kind === "TRUONG" ? r.schoolId : r.userId}:${r.month}`;
    const g = groups.get(key) ?? {
      key, kind, month: r.month, school: r.school?.name ?? "", amount: 0, ids: [], verified: r.school?.verified ?? true,
      who: kind === "TRUONG" ? r.school?.name ?? "" : r.user?.name ?? "",
      pay: kind === "TRUONG"
        ? r.school?.payAccount ? { bin: r.school.payBin!, account: r.school.payAccount, name: r.school.payName! } : null
        : r.user?.payAccount ? { bin: r.user.payAccount.bankBin, account: r.user.payAccount.bankAccount, name: r.user.payAccount.accountName } : null,
    };
    g.amount += r.amount; g.ids.push(r.id);
    groups.set(key, g);
  }
  const order = (g: { month: string; kind: string; who: string }) => `${g.month}|${g.kind === "TRUONG" ? 0 : 1}|${g.who}`;
  return [...groups.values()].sort((a, b) => order(a).localeCompare(order(b), "vi")).map((g) => {
    const note = `DONHO CHIA SE ${g.month.replace("-", "")}`;
    return { ...g, bank: g.pay ? bankName(g.pay.bin) : null, note: transferNote(note), qr: g.pay ? vietQr({ bin: g.pay.bin, account: g.pay.account, amount: g.amount, note }) : null };
  });
}

/** Quản trị đã chuyển khoản một nhóm → ghi Payout, đánh dấu đã trả, báo người nhận. */
export async function markPayout(userId: string, key: string, now = new Date()) {
  const g = (await payoutQueue(userId, now)).find((x) => x.key === key);
  if (!g) throw new AppError("Khoản này đã chuyển hoặc chưa đến hạn.");
  if (!g.pay) throw new AppError("Người nhận chưa khai tài khoản ngân hàng.");
  if (!g.verified) throw new AppError("Trường chưa được xác minh. Gọi xác minh ở trang Phễu trường rồi mới chuyển.");
  const [, target] = key.split(":");
  await db.$transaction(async (tx) => {
    const p = await tx.payout.create({ data: {
      kind: g.kind, month: g.month, amount: g.amount, paidById: userId, paidAt: now,
      bank: `${bankName(g.pay!.bin)} ${g.pay!.account} ${g.pay!.name}`,
      ...(g.kind === "TRUONG" ? { schoolId: target } : { userId: target }),
    } });
    const res = await tx.shareEntry.updateMany({ where: { id: { in: g.ids }, status: "TAM_TINH", payoutId: null }, data: { status: "DA_TRA", payoutId: p.id } });
    if (res.count !== g.ids.length) throw new AppError("Số liệu vừa thay đổi, tải lại trang rồi thử lại.");
    await tx.auditLog.create({ data: { actorId: userId, action: "CHUYEN_CHIA_SE", target: p.id, meta: { kind: g.kind, month: g.month, amount: g.amount } } });
    const to: Recipient[] = g.kind === "TRUONG"
      ? (await tx.schoolAdmin.findMany({ where: { schoolId: target }, include: { user: true } })).map((a) => ({ userId: a.userId, phone: a.user.phone }))
      : [{ userId: target, phone: (await tx.user.findUniqueOrThrow({ where: { id: target } })).phone }];
    const [y, m] = g.month.split("-");
    await notify(tx, to, "PUSH", `Đón Hộ đã chuyển ${new Intl.NumberFormat("vi-VN").format(g.amount)}đ chia sẻ doanh thu tháng ${m}/${y}. Kiểm tra tài khoản ${bankName(g.pay!.bin)} ${g.pay!.account}.`, "/chia-se");
  });
}

/** Tổng quan cho quản trị: đã chuyển gần đây. */
export async function recentPayouts(userId: string) {
  await requireAdmin(userId);
  return db.payout.findMany({ include: { school: true, user: true }, orderBy: { paidAt: "desc" }, take: 20 });
}
