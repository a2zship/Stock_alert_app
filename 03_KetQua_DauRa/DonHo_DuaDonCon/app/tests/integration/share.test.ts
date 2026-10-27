// Giới thiệu bạn bè (tín dụng 20%/12 tháng) + chia sẻ doanh thu: trường 10%, cô lớp 5%, chuyển hằng tháng sau đối soát.
import { beforeEach, describe, expect, it } from "vitest";
import { payableFrom, vnMonth } from "@/domain/share";
import * as A from "@/server/area";
import { db } from "@/server/db";
import * as E from "@/server/earn";
import * as M from "@/server/membership";
import * as S from "@/server/share";
import { phoneOf, resetDb, uid } from "./helpers";
import { paidJobDone } from "./paid";

beforeEach(resetDb);

const ADMIN = "0908000000";
const HIEU_TRUONG = "0901000030";
const later = (days: number) => new Date(Date.now() + days * 86_400_000);
/** Ngày nền tảng được chuyển phần chia sẻ của tháng hiện tại (giữa trưa giờ VN). */
const payDay = () => new Date(`${payableFrom(vnMonth(new Date()))}T12:00:00+07:00`);
const entries = (where: object = {}) => db.shareEntry.findMany({ where, orderBy: [{ kind: "asc" }, { amount: "desc" }] });
const codeOf = (phone: string) => uid(phone).then(S.ensureRefCode);

describe("giới thiệu bạn bè", () => {
  it("nhập mã lúc đăng ký; sai mã báo ngay; không tự giới thiệu, không giới thiệu chéo, chỉ trong 7 ngày đầu", async () => {
    const tuan = await uid(phoneOf.bo);
    const code = await codeOf(phoneOf.bo);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(await S.ensureRefCode(tuan)).toBe(code); // mã cố định

    const cto = await db.province.findUniqueOrThrow({ where: { code: "CTO" } });
    const ward = await db.ward.findFirstOrThrow({ where: { provinceId: cto.id, name: "Phường Ninh Kiều" } });
    const base = { name: "Nguyễn Thị Mai", phone: "0912345678", provinceId: String(cto.id), wardId: String(ward.id), schoolId: "khac", schoolName: "Trường Mầm non Hướng Dương" };
    await expect(A.startSignup({ ...base, refCode: "ZZZZZZ" })).rejects.toThrow(/Mã giới thiệu không đúng/);
    await A.startSignup({ ...base, refCode: code.toLowerCase() });
    const otp = /(\d{6})/.exec((await db.message.findFirstOrThrow({ where: { toPhone: base.phone }, orderBy: { createdAt: "desc" } })).body)![1];
    const mai = await A.finishSignup({ ...base, refCode: code, code: otp });
    expect(await db.user.findUniqueOrThrow({ where: { id: mai } })).toMatchObject({ referredById: tuan });
    expect(await db.message.count({ where: { toUserId: tuan, link: "/gioi-thieu" } })).toBe(1);

    await expect(S.claimReferral(tuan, code)).rejects.toThrow(/chính mình/);
    await expect(S.claimReferral(tuan, await S.ensureRefCode(mai))).rejects.toThrow(/chéo/);
    const bao = await uid(phoneOf.bao);
    await S.claimReferral(bao, code);
    await expect(S.claimReferral(bao, await S.ensureRefCode(mai))).rejects.toThrow(/đã có người giới thiệu/);
    const hoa = await uid(phoneOf.me);
    await db.user.update({ where: { id: hoa }, data: { createdAt: later(-8) } });
    await expect(S.claimReferral(hoa, code)).rejects.toThrow(/7 ngày đầu/);
  });

  it("mua gói: người giới thiệu 20% tín dụng (dùng được sau 7 ngày), trường 10%, cô lớp 5%; trả bằng tín dụng thì phần đó không chia", async () => {
    const tuan = await uid(phoneOf.bo);
    const bao = await uid(phoneOf.bao);
    const lan = await uid(phoneOf.coLan);
    await S.claimReferral(bao, await codeOf(phoneOf.bo));
    await M.buyMembership(bao, "BAC", 1); // 39.000đ, bé Ngọc lớp Lá 1
    const school = await db.school.findFirstOrThrow({ where: { name: { contains: "Hoa Sen" } } });
    expect((await entries()).map((e) => [e.kind, e.userId ?? e.schoolId, e.amount])).toEqual([
      ["GIOI_THIEU", tuan, 7800], ["TRUONG", school.id, 3900], ["GIAO_VIEN", lan, 1950],
    ]);
    expect(await S.creditBalance(tuan)).toMatchObject({ available: 0, pending: 7800 });
    expect((await S.creditBalance(tuan, later(8))).available).toBe(7800);

    // anh Tuấn mua gói sau 8 ngày: trừ 7.800đ tín dụng, chỉ chia trên 31.200đ tiền mặt
    expect((await M.membershipQr(tuan, "BAC", 1, later(8)))).toMatchObject({ price: 39000, credit: 7800, amount: 31200 });
    await M.buyMembership(tuan, "BAC", 1, later(8));
    const mine = await db.membership.findFirstOrThrow({ where: { userId: tuan } });
    expect(mine.creditUsed).toBe(7800);
    expect((await entries({ sourceId: mine.id })).map((e) => [e.kind, e.base, e.amount])).toEqual([["TRUONG", 31200, 3120], ["GIAO_VIEN", 31200, 1560]]);
    expect(await S.creditBalance(tuan, later(8))).toMatchObject({ available: 0, used: 7800 });

    // gói của anh Bảo bị huỷ khi đối soát → tín dụng sinh từ gói đó mất
    await db.membership.updateMany({ where: { userId: bao }, data: { status: "HUY" } });
    expect((await S.creditBalance(tuan, later(8))).available).toBe(0);
    // hết 12 tháng thì không còn thưởng giới thiệu
    await db.user.update({ where: { id: bao }, data: { referredAt: later(-400) } });
    await M.buyMembership(bao, "VANG", 1, later(1));
    expect(await db.shareEntry.count({ where: { kind: "GIOI_THIEU", fromUserId: bao, status: { not: "HUY" }, createdAt: { gt: new Date() } } })).toBe(0);
  });

  it("nộp phí nền tảng: chia cho lớp của BÉ ĐƯỢC ĐÓN (không phải lớp người đón); người giới thiệu người đón nhận 20%", async () => {
    const { nga, bao } = await paidJobDone(); // chị Nga (con lớp Chồi 2) đón bé Ngọc lớp Lá 1, phí 5.000đ trên 50.000đ
    await S.claimReferral(nga, await S.ensureRefCode(bao));
    await db.pickupRequest.updateMany({ where: { delegateId: nga }, data: { paidAt: new Date(), paidAmount: 60000, commission: 6000 } });
    await E.settleCommission(nga);
    const lan = await uid(phoneOf.coLan);
    expect((await entries({ source: "PHI_NEN_TANG" })).map((e) => [e.kind, e.userId, e.amount])).toEqual([
      ["GIOI_THIEU", bao, 1200], ["TRUONG", null, 600], ["GIAO_VIEN", lan, 300],
    ]);
    expect(await db.shareEntry.count({ where: { userId: await uid(phoneOf.coMai) } })).toBe(0);
  });
});

describe("chia sẻ với nhà trường và giáo viên", () => {
  it("trường tắt phần giáo viên → gộp về trường; chỉ ban giám hiệu đổi được", async () => {
    const school = await db.school.findFirstOrThrow({ where: { name: { contains: "Hoa Sen" } } });
    await expect(S.setTeacherShare(await uid(phoneOf.coLan), school.id, false)).rejects.toThrow(/ban giám hiệu/);
    await S.setTeacherShare(await uid(HIEU_TRUONG), school.id, false);
    expect(await db.message.count({ where: { toUserId: await uid(phoneOf.coLan), link: "/chia-se" } })).toBe(1);
    await M.buyMembership(await uid(phoneOf.me), "BAC", 1);
    expect((await entries()).map((e) => [e.kind, e.amount, e.rate])).toEqual([["TRUONG", 5850, 0.15]]);
  });

  it("chuyển hằng tháng: chưa hết tháng thì chưa đến hạn; phải có tài khoản; quản trị bấm Đã chuyển thì người nhận được báo", async () => {
    const admin = await uid(ADMIN);
    const lan = await uid(phoneOf.coLan);
    const ht = await uid(HIEU_TRUONG);
    const school = await db.school.findFirstOrThrow({ where: { name: { contains: "Hoa Sen" } } });
    await M.buyMembership(await uid(phoneOf.bao), "BAC", 1);
    await M.buyMembership(await uid(phoneOf.me), "BAC", 1);
    await expect(S.payoutQueue(lan)).rejects.toThrow(/quản trị/);
    expect(await S.payoutQueue(admin)).toHaveLength(0);

    const q = await S.payoutQueue(admin, payDay());
    expect(q.map((g) => [g.kind, g.amount, !!g.pay])).toEqual([["TRUONG", 7800, false], ["GIAO_VIEN", 3900, false]]);
    await expect(S.markPayout(admin, q[0].key, payDay())).rejects.toThrow(/chưa khai tài khoản/);

    await expect(S.savePayAccount(await uid(phoneOf.bo), { bankBin: "970436", bankAccount: "0123456789", accountName: "LE MINH TUAN" })).rejects.toThrow(/giáo viên/);
    await expect(S.savePayAccount(lan, { bankBin: "970436", bankAccount: "0123456789", accountName: "TRAN VAN B" })).rejects.toThrow(/đứng tên chính bạn/);
    await S.savePayAccount(lan, { bankBin: "970436", bankAccount: "0123 456 789", accountName: "Nguyen Thi Lan" });
    await S.saveSchoolPay(ht, school.id, { bankBin: "970436", bankAccount: "9999888877", accountName: "Truong Mam non Hoa Sen" });

    for (const g of await S.payoutQueue(admin, payDay())) await S.markPayout(admin, g.key, payDay());
    expect(await S.payoutQueue(admin, payDay())).toHaveLength(0);
    expect(await db.shareEntry.count({ where: { status: "DA_TRA" } })).toBe(await db.shareEntry.count({ where: { kind: { in: ["TRUONG", "GIAO_VIEN"] } } }));
    expect(await db.payout.findMany({ orderBy: { amount: "desc" }, select: { kind: true, amount: true } })).toEqual([{ kind: "TRUONG", amount: 7800 }, { kind: "GIAO_VIEN", amount: 3900 }]);
    expect(await db.message.count({ where: { toUserId: ht, body: { contains: "7.800đ" } } })).toBe(1);
    expect(await db.message.count({ where: { toUserId: lan, body: { contains: "3.900đ" } } })).toBe(1);

    const v = await S.shareView(lan, payDay());
    expect(v.teacher!.months[0]).toMatchObject({ amount: 3900, base: 78000, state: "DA_TRA" });
    expect((await S.shareView(ht)).schools[0].months[0]).toMatchObject({ amount: 7800, state: "DA_TRA" });
  });
});
