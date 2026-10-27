// Thành viên ưu đãi: hạng hiện tại, mua gói bằng VietQR (chuyển thẳng tới tài khoản nền tảng), lịch sử gói.
import { addMonths, FREE_TIER, isPaidTier, MONTH_OPTIONS, priceOf, startOfNew, tierInfo, type MemberTier, type PaidTierKey } from "@/domain/membership";
import { bankName, transferNote, vietQr } from "@/domain/vietqr";
import { AppError, db, platformAccount } from "./db";
import { notify } from "./notify";
import { creditBalance, lockUser, recordMembership, useCredit } from "./share";

const activeWhere = (userId: string, now: Date) => ({ userId, status: { not: "HUY" as const }, startsAt: { lte: now }, endsAt: { gt: now } });

/** Hạng đang có (gói còn hạn cao nhất), kèm ngày hết hạn của hạng đó. Không có gói → Thường. */
export async function tierOf(userId: string, now = new Date()): Promise<MemberTier & { endsAt: Date | null }> {
  const rows = await db.membership.findMany({ where: activeWhere(userId, now) });
  if (!rows.length) return { ...FREE_TIER, endsAt: null };
  const best = rows.reduce((a, b) => (tierInfo(b.tier).monthly > tierInfo(a.tier).monthly ? b : a));
  // các gói cùng hạng nối tiếp nhau → hạn thật là ngày kết thúc xa nhất của chuỗi
  const chain = await db.membership.findMany({ where: { userId, tier: best.tier, status: { not: "HUY" }, endsAt: { gt: now } } });
  return { ...tierInfo(best.tier), endsAt: new Date(Math.max(...chain.map((m) => m.endsAt.getTime()))) };
}

/** Hạng của nhiều người một lúc (bảng việc, nhóm lớp). */
export async function tiersOf(userIds: string[], now = new Date()) {
  const rows = await db.membership.findMany({ where: { userId: { in: userIds }, status: { not: "HUY" }, startsAt: { lte: now }, endsAt: { gt: now } } });
  const out = new Map<string, MemberTier>();
  for (const id of userIds) out.set(id, FREE_TIER);
  for (const r of rows) if (tierInfo(r.tier).monthly > out.get(r.userId)!.monthly) out.set(r.userId, tierInfo(r.tier));
  return out;
}

function parseOrder(tier: unknown, months: unknown) {
  if (!isPaidTier(tier)) throw new AppError("Chọn hạng thành viên.");
  const m = Number(months);
  if (!MONTH_OPTIONS.includes(m as (typeof MONTH_OPTIONS)[number])) throw new AppError("Chọn gói 1 tháng hoặc 12 tháng.");
  return { tier: tier as PaidTierKey, months: m };
}

async function requireParent(userId: string) {
  if (!(await db.guardian.count({ where: { userId } }))) throw new AppError("Gói thành viên dành cho phụ huynh.");
}

/** Mã chuyển khoản mua gói — tiền vào thẳng tài khoản nền tảng. Tín dụng giới thiệu (nếu có) trừ trước. */
export async function membershipQr(userId: string, tier: unknown, months: unknown, now = new Date()) {
  const o = parseOrder(tier, months);
  const acct = platformAccount();
  if (!acct) return null;
  const price = priceOf(o.tier, o.months);
  const credit = Math.min((await creditBalance(userId, now)).available, price);
  const amount = price - credit;
  const note = `DONHO TV ${o.tier.replace("_", "")} ${userId.slice(-6)}`;
  return { ...o, price, credit, amount, bank: bankName(acct.bin), account: acct.account, name: acct.name, note: transferNote(note),
    qr: amount > 0 ? vietQr({ bin: acct.bin, account: acct.account, amount, note }) : null };
}

/** Phụ huynh báo đã chuyển khoản → gói có hiệu lực ngay (chờ đối soát). Bấm trùng trong 2 phút không tạo 2 gói. */
export async function buyMembership(userId: string, tier: unknown, months: unknown, now = new Date()) {
  await requireParent(userId);
  const o = parseOrder(tier, months);
  if (!platformAccount()) throw new AppError("Nền tảng chưa cấu hình tài khoản nhận tiền.");
  const dup = await db.membership.count({ where: { userId, tier: o.tier, months: o.months, createdAt: { gt: new Date(now.getTime() - 120_000) } } });
  if (dup) throw new AppError("Bạn vừa báo chuyển khoản gói này rồi.");
  const active = await db.membership.findMany({ where: { userId, status: { not: "HUY" }, endsAt: { gt: now } } });
  const startsAt = startOfNew(active, o.tier, now);
  const amount = priceOf(o.tier, o.months);
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const m = await tx.membership.create({ data: { userId, tier: o.tier, months: o.months, amount, startsAt, endsAt: addMonths(startsAt, o.months), createdAt: now } });
    // tín dụng giới thiệu trừ trước; chỉ phần tiền mặt mới được chia cho người giới thiệu, trường, cô
    const credit = await useCredit(tx, userId, amount, "THANH_VIEN", m.id, now);
    if (credit) await tx.membership.update({ where: { id: m.id }, data: { creditUsed: credit } });
    await recordMembership(tx, m.id, userId, amount - credit, now);
    await tx.auditLog.create({ data: { actorId: userId, action: "MUA_THANH_VIEN", target: m.id, meta: { tier: o.tier, months: o.months, amount, credit } } });
    const me = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
    await notify(tx, [{ userId, phone: me.phone }], "PUSH",
      `Đã ghi nhận gói thành viên ${tierInfo(o.tier).name} ${o.months} tháng (${vnd(amount)}đ${credit ? `, trừ ${vnd(credit)}đ tín dụng giới thiệu` : ""}). Ưu đãi có hiệu lực từ ${startsAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`, "/thanh-vien");
  });
}

export function membershipHistory(userId: string) {
  return db.membership.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
}
