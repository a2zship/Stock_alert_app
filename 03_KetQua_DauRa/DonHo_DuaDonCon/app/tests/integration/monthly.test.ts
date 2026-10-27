// Đón theo tháng: chỉ định hoặc mở (24 giờ ưu tiên Kim cương), cô duyệt một lần, trả trọn gói, mỗi buổi tự sinh mã, huỷ/nghỉ/dừng sớm, hoàn tiền.
import { beforeEach, describe, expect, it } from "vitest";
import { monthOptions, scheduleDays } from "@/domain/monthly";
import { vnDateTime } from "@/domain/time";
import { appSecret, db } from "@/server/db";
import * as E from "@/server/earn";
import * as M from "@/server/membership";
import * as T from "@/server/monthly";
import * as Q from "@/server/queries";
import * as R from "@/server/requests";
import { rewardOf } from "@/server/rewards";
import { unseal } from "@/server/seal";
import { phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

beforeEach(resetDb);

const month = monthOptions()[1]; // tháng sau: lịch đủ, không phụ thuộc hôm nay
const WEEK = [1, 2, 3, 4, 5];
const days = scheduleDays(month, WEEK, `${month}-01`);
const at = (date: string, hhmm: string) => vnDateTime(date, hhmm);

async function helper(phone: string, account: string, name: string, teacher: string) {
  const id = await uid(phone);
  await E.registerHelper(id, { cccdLast4: "5566", photo: photoDataUrl(), bankBin: "970436", bankAccount: account, accountName: name, agree: true });
  await E.reviewHelper(await uid(teacher), (await db.helperProfile.findUniqueOrThrow({ where: { userId: id } })).id, "approve");
  return id;
}
const nga = () => helper(phoneOf.meBinh, "0123456789", "VO THANH NGA", phoneOf.coMai);
const tuan = () => helper(phoneOf.bo, "0987654321", "LE MINH TUAN", phoneOf.coLan);
const ngoc = () => db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });

describe("đón theo tháng", () => {
  it("hợp đồng mở: 24 giờ đầu chỉ Kim cương nhận; phụ huynh chọn; cô duyệt một lần có gọi xác minh; trả trọn gói", async () => {
    const bao = await uid(phoneOf.bao);
    const kid = await ngoc();
    const base = { studentId: kid.id, month, weekdays: WEEK };
    await expect(T.createMonthly(bao, { ...base, fee: "100000" })).rejects.toThrow(/tối thiểu/);
    await expect(T.createMonthly(bao, { ...base, month: "2020-01", fee: "900000" })).rejects.toThrow(/tháng này hoặc tháng sau/);
    await expect(T.createMonthly(bao, { ...base, weekdays: [] as number[], fee: "900000" })).rejects.toThrow(/ít nhất một ngày/);
    const fee = days.length * 30_000;
    const id = await T.createMonthly(bao, { ...base, fee: String(fee) });
    await expect(T.createMonthly(bao, { ...base, fee: String(fee) })).rejects.toThrow(/đang chạy/);
    const c = await db.monthlyContract.findUniqueOrThrow({ where: { id } });
    expect(c).toMatchObject({ status: "TIM_NGUOI", designated: false, fee });

    const n = await nga();
    const t = await tuan();
    const board = await T.monthlyBoard(n);
    expect(board.rows[0]).toMatchObject({ id, locked: true, priority: true, days: days.length, net: fee - fee / 10 });
    expect(JSON.stringify(board)).not.toContain("Ngọc");
    await expect(T.offerMonthly(n, id)).rejects.toThrow(/Kim cương/);

    await M.buyMembership(t, "KIM_CUONG", 1);
    expect((await T.monthlyBoard(t)).rows[0].locked).toBe(false);
    await T.offerMonthly(t, id);
    // qua 24 giờ thì mọi người đón đã duyệt đều nhận được
    await T.offerMonthly(n, id, new Date(c.priorityUntil!.getTime() + 60_000));

    await T.chooseMonthlyOffer(bao, id, t);
    await expect(T.offerMonthly(n, id)).rejects.toThrow(/đã có người nhận/);
    const mai = await uid(phoneOf.coMai);
    const lan = await uid(phoneOf.coLan);
    await expect(T.teacherDecideMonthly(mai, id, true, { calledParent: true })).rejects.toThrow(/không phụ trách/);
    await expect(T.teacherDecideMonthly(lan, id, true)).rejects.toThrow(/gọi điện xác minh/);
    expect(await T.monthlyPayInfo(bao, id)).toBeNull(); // chưa duyệt chưa trả
    await T.teacherDecideMonthly(lan, id, true, { calledParent: true });

    const pay = (await T.monthlyPayInfo(bao, id))!;
    expect(pay).toMatchObject({ amount: fee, account: "0987654321", accountName: "LE MINH TUAN" });
    expect(await T.monthlyPayInfo(t, id)).toBeNull(); // chỉ phụ huynh thấy mã chuyển khoản
    await T.markMonthlyPaid(bao, id);
    await T.markMonthlyPaid(bao, id); // bấm trùng không ghi 2 lần
    // Kim cương 3% phí nền tảng
    expect(await db.monthlyContract.findUniqueOrThrow({ where: { id } })).toMatchObject({ paidAmount: fee, commission: Math.round((fee * 0.03) / 1000) * 1000 });
    expect((await E.owedOf(t)).amount).toBe(Math.round((fee * 0.03) / 1000) * 1000);
    await E.settleCommission(t);
    expect((await E.owedOf(t)).amount).toBe(0);
  });

  it("chỉ định người đón; mỗi buổi tự sinh mã đã duyệt; cổng vẫn kiểm; huỷ buổi, báo nghỉ, dừng sớm, hoàn tiền", async () => {
    const bao = await uid(phoneOf.bao);
    const kid = await ngoc();
    const n = await nga();
    const lan = await uid(phoneOf.coLan);
    const fee = days.length * 30_000;
    await expect(T.createMonthly(bao, { studentId: kid.id, month, weekdays: WEEK, fee: String(fee), helperPhone: phoneOf.baNgoai })).rejects.toThrow(/chưa phải người đón có phí/);
    const id = await T.createMonthly(bao, { studentId: kid.id, month, weekdays: WEEK, fee: String(fee), helperPhone: phoneOf.meBinh });
    expect((await db.monthlyContract.findUniqueOrThrow({ where: { id } })).status).toBe("CHO_NGUOI_DON");
    await expect(T.helperRespondMonthly(bao, id, true)).rejects.toThrow(/không chờ bạn/);
    await T.helperRespondMonthly(n, id, true);
    await T.teacherDecideMonthly(lan, id, true, { calledParent: true });

    // chưa trả trọn gói → chưa sinh buổi
    const d0 = days[0];
    await R.ensureMonthlyDays(at(d0, "07:00"));
    expect(await db.pickupRequest.count({ where: { contractId: id } })).toBe(0);
    await T.markMonthlyPaid(bao, id);
    await R.ensureMonthlyDays(at(d0, "07:00"));
    await R.ensureMonthlyDays(at(d0, "08:00")); // gọi lại không sinh trùng
    const r = await db.pickupRequest.findFirstOrThrow({ where: { contractId: id } });
    expect(r).toMatchObject({ status: "DA_DUYET", fee: null, delegateId: n, cccdLast4: "5566", teacherCalledParent: true });

    // buổi theo tháng quản lý riêng: không lẫn vào danh sách nhờ đón lẻ của cô, phụ huynh, người đón
    const tToday = await Q.teacherToday(lan, at(d0, "07:00"));
    expect(tToday.monthly.map((x) => x.id)).toEqual([r.id]);
    expect(tToday.today.some((x) => x.id === r.id)).toBe(false);
    expect((await T.monthlySessionsToday(lan, at(d0, "07:00"))).map((x) => x.id)).toEqual([r.id]);
    expect((await T.monthlySessionsToday(n, at(d0, "07:00"))).map((x) => x.id)).toEqual([r.id]);
    const inbox = await Q.delegateInbox(n);
    expect(inbox.rows.some((x) => x.id === r.id)).toBe(false);
    expect(inbox.monthly.map((x) => x.id)).toContain(r.id);
    const home = await Q.parentHome(bao);
    expect(home.active.some((x) => x.id === r.id)).toBe(false);
    expect(home.monthly.map((x) => x.id)).toContain(r.id);
    // nhờ đón lẻ trùng ca vẫn theo quy tắc cũ, nhưng báo rõ là đã có buổi theo tháng
    await expect(R.createRequest(bao, { studentId: kid.id, date: d0, mode: "adhoc", name: "Lê Văn Tư", phone: "0909111222", relation: "Chú", reason: "Bận họp" }, at(d0, "07:00")))
      .rejects.toThrow(/hợp đồng tháng/);

    // tại cổng vẫn quét mã + kiểm ảnh/CCCD như mọi buổi
    const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
    const gate = new Date(at(d0, "16:30").getTime() + 5 * 60_000);
    await expect(R.handover(lan, r.id, { face: true, cccd: true, child: true }, photoDataUrl(), gate)).rejects.toThrow(/quét QR hoặc nhập PIN/);
    await R.gateByPin(lan, r.id, codes.pin, gate);
    await R.handover(lan, r.id, { face: true, cccd: true, child: true }, photoDataUrl(), gate);
    await R.confirmHome(bao, r.id);
    expect(await rewardOf(n)).toHaveLength(0); // đón theo tháng có thù lao → không cộng điểm tương trợ

    // phụ huynh huỷ buổi 4 (không hoàn), người đón báo nghỉ buổi 6 (hoàn)
    const now = at(days[1], "07:00");
    await T.skipMonthlyDay(bao, id, days[3], now);
    await expect(T.skipMonthlyDay(bao, id, days[3], now)).rejects.toThrow(/đã huỷ/);
    await T.missMonthlyDay(n, id, days[5], "Ốm", now);
    await R.ensureMonthlyDays(at(days[3], "07:00"));
    expect(await db.pickupRequest.count({ where: { contractId: id, windowStart: at(days[3], "16:30") } })).toBe(0);

    // hôm đã sinh mã, người đón báo nghỉ → mã huỷ ngay
    await R.ensureMonthlyDays(at(days[7], "07:00"));
    const r8 = await db.pickupRequest.findFirstOrThrow({ where: { contractId: id, status: "DA_DUYET" } });
    await T.missMonthlyDay(n, id, days[7], "Kẹt xe", at(days[7], "09:00"));
    expect(await db.pickupRequest.findUniqueOrThrow({ where: { id: r8.id } })).toMatchObject({ status: "NGUOI_DON_TU_CHOI", tokenHash: null, pinHash: null });

    // người đón dừng từ buổi 11: hoàn 2 buổi nghỉ + mọi buổi từ buổi 11
    await T.endMonthly(n, id, "Chuyển công tác", at(days[10], "07:00"));
    const end = await db.monthlyContract.findUniqueOrThrow({ where: { id } });
    const refund = 30_000 * (2 + days.length - 10);
    expect(end).toMatchObject({ status: "KET_THUC", endedBy: "NGUOI_DON", refundDue: refund, commission: Math.round(((fee - refund) * 0.1) / 1000) * 1000, dropAddress: null });
    await R.ensureMonthlyDays(at(days[11], "07:00"));
    expect(await db.pickupRequest.count({ where: { contractId: id, windowStart: { gte: at(days[11], "00:00") } } })).toBe(0);

    // quá 7 ngày chưa hoàn tiền → tạm không nhận việc có phí mới
    const later = new Date(end.endedAt!.getTime() + 8 * 86_400_000);
    expect(await E.refundOverdue(n, later)).toBe(true);
    await expect(E.requirePaidHelper(n, kid.classId, later)).rejects.toThrow(/hoàn tiền/);
    await T.markRefunded(bao, id);
    expect(await E.refundOverdue(n, later)).toBe(false);
  });

  it("phụ huynh dừng sớm: giữ 2 buổi báo trước; huỷ được trước khi duyệt", async () => {
    const bao = await uid(phoneOf.bao);
    const kid = await ngoc();
    const n = await nga();
    const lan = await uid(phoneOf.coLan);
    const fee = days.length * 30_000;
    const draft = await T.createMonthly(bao, { studentId: kid.id, month, weekdays: WEEK, fee: String(fee), helperPhone: phoneOf.meBinh });
    await T.cancelMonthly(bao, draft);
    expect((await db.monthlyContract.findUniqueOrThrow({ where: { id: draft } })).status).toBe("DA_HUY");

    const id = await T.createMonthly(bao, { studentId: kid.id, month, weekdays: WEEK, fee: String(fee), helperPhone: phoneOf.meBinh });
    await T.helperRespondMonthly(n, id, true);
    await T.teacherDecideMonthly(lan, id, true, { calledParent: true });
    await expect(T.endMonthly(bao, id, "x")).rejects.toThrow(/lý do/);
    await T.markMonthlyReceived(n, id); // người đón báo đã nhận = đã trả
    await T.endMonthly(bao, id, "Bà ngoại lên chơi", at(days[4], "07:00"));
    // dừng ngày buổi 5: buổi 5 vẫn đón; còn lại (total-5) buổi, trừ 2 buổi báo trước
    expect((await db.monthlyContract.findUniqueOrThrow({ where: { id } })).refundDue).toBe(30_000 * (days.length - 5 - 2));
  });
});
