// Đón hộ có phí: đăng ký + cô duyệt, nhận việc trong trường, trả thù lao qua VietQR, nộp phí nền tảng.
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { appSecret, db } from "@/server/db";
import * as C from "@/server/chat";
import * as E from "@/server/earn";
import { rewardOf } from "@/server/rewards";
import * as R from "@/server/requests";
import { unseal } from "@/server/seal";
import { phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

const date = addDays(vnToday(), 1);
const atGate = new Date(vnDateTime(date, "16:30").getTime() + 5 * 60_000);
const helperForm = { cccdLast4: "5566", photo: photoDataUrl(), bankBin: "970436", bankAccount: "0123 456 789", accountName: "Vo Thanh Nga", agree: true };

/** Chị Nga (lớp Chồi 2) đăng ký, cô Mai (GV lớp con chị) duyệt. */
async function approvedHelper() {
  const nga = await uid(phoneOf.meBinh);
  await E.registerHelper(nga, helperForm);
  const prof = await db.helperProfile.findUniqueOrThrow({ where: { userId: nga } });
  await E.reviewHelper(await uid(phoneOf.coMai), prof.id, "approve");
  return nga;
}

/** Anh Bảo (lớp Lá 1) nhờ đón bé Ngọc có thù lao 50.000đ. */
async function paidAsk() {
  const bao = await uid(phoneOf.bao);
  const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
  await C.postPickupAsk(bao, { studentId: ngoc.id, date, fee: "50000" });
  return { bao, ngoc, post: await db.chatPost.findFirstOrThrow({ where: { studentId: ngoc.id, status: "MO" } }) };
}

/** Đi trọn một lượt đón có phí tới lúc phụ huynh xác nhận bé về. */
async function paidJobDone() {
  const nga = await approvedHelper();
  const { bao, post } = await paidAsk();
  await C.offerHelp(nga, post.id);
  const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id } });
  const id = await C.chooseOffer(bao, offer.id);
  const lan = await uid(phoneOf.coLan);
  await R.delegateRespond(nga, id, true); // không phải khai lại CCCD/ảnh
  await R.teacherDecide(lan, id, true, { calledParent: true });
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
  const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
  await R.gateByPin(lan, id, codes.pin, atGate);
  await R.handover(lan, id, { face: true, cccd: true, child: true }, photoDataUrl(), atGate);
  await R.confirmHome(bao, id);
  return { id, nga, bao };
}

beforeEach(resetDb);

describe("đón hộ có phí", () => {
  it("đăng ký: tài khoản phải đứng tên chính mình; cô lớp của con duyệt; từ chối/tạm dừng phải có lý do", async () => {
    const nga = await uid(phoneOf.meBinh);
    await expect(E.registerHelper(nga, { ...helperForm, accountName: "Nguyen Van Khac" })).rejects.toThrow(/đứng tên chính bạn/);
    await expect(E.registerHelper(nga, { ...helperForm, agree: false })).rejects.toThrow(/đồng ý/);
    await expect(E.registerHelper(await uid(phoneOf.coLan), helperForm)).rejects.toThrow();
    await E.registerHelper(nga, helperForm);
    const prof = await db.helperProfile.findUniqueOrThrow({ where: { userId: nga } });
    expect(prof).toMatchObject({ status: "CHO_DUYET", bankAccount: "0123456789", accountName: "VO THANH NGA" });

    // cô Lan không dạy lớp con chị Nga → không thấy, không duyệt được
    const lan = await uid(phoneOf.coLan);
    const mai = await uid(phoneOf.coMai);
    expect(await E.helpersToReview(lan)).toHaveLength(0);
    await expect(E.reviewHelper(lan, prof.id, "approve")).rejects.toThrow();
    expect(await E.helpersToReview(mai)).toHaveLength(1);
    await expect(E.reviewHelper(mai, prof.id, "reject")).rejects.toThrow(/lý do/);
    await E.reviewHelper(mai, prof.id, "approve");
    await E.reviewHelper(mai, prof.id, "suspend", "Phụ huynh phản ánh");
    await expect(E.registerHelper(nga, helperForm)).rejects.toThrow(/tạm dừng/);
  });

  it("lời nhờ có thù lao: người đón đã duyệt cả trường thấy (không lộ tên bé); chưa duyệt thì không nhận được", async () => {
    const { post } = await paidAsk();
    const nga = await uid(phoneOf.meBinh);
    await expect(C.offerHelp(nga, post.id)).rejects.toThrow(/đăng ký người đón có phí/);
    await expect(C.offerHelp(await uid(phoneOf.coLan), post.id)).rejects.toThrow(/Chỉ phụ huynh/);
    await expect(C.postPickupAsk(await uid(phoneOf.bo), { studentId: (await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } })).id, date, fee: "10000" }))
      .rejects.toThrow(/Thù lao tối thiểu từ/);

    await approvedHelper();
    const board = await E.paidBoard(nga);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ className: "Lớp Lá 1", fee: 50000, net: 45000, offered: false });
    expect(JSON.stringify(board)).not.toContain("Ngọc");
    await C.offerHelp(nga, post.id);
    expect((await E.paidBoard(nga))[0].offered).toBe(true);
  });

  it("trọn lượt: chọn người → yêu cầu có phí → bé về → VietQR → báo đã chuyển → nhận tiền → nợ phí → nộp phí", async () => {
    const { id, nga, bao } = await paidJobDone();
    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(r).toMatchObject({ fee: 50000, commission: 5000, isAdhoc: true, status: "HOAN_TAT", cccdLast4: "5566" });

    // chỉ phụ huynh của bé thấy mã chuyển khoản
    expect(await E.payInfo(nga, id)).toBeNull();
    const pay = (await E.payInfo(bao, id))!;
    expect(pay).toMatchObject({ min: 50000, amount: 50000, account: "0123456789", accountName: "VO THANH NGA", paidAt: null });
    expect(pay.qr).toContain("0123456789");
    // phụ huynh tự chọn cảm ơn thêm; thấp hơn mức đã hứa thì giữ mức tối thiểu và báo lỗi
    expect((await E.payInfo(bao, id, "60000"))!.qr).toContain("540560000");
    expect(await E.payInfo(bao, id, "30000")).toMatchObject({ amount: 50000, error: expect.stringMatching(/tối thiểu/) });
    await expect(E.markPaid(bao, id, { amount: "30000" })).rejects.toThrow(/tối thiểu/);

    await E.remindPayment(nga, id);
    await expect(E.remindPayment(nga, id)).rejects.toThrow(/24 giờ/);
    await E.markPaid(bao, id, { amount: "60000", thanks: "Cảm ơn chị" });
    await E.markPaid(bao, id, { amount: "60000", thanks: "Cảm ơn chị" }); // bấm trùng không ghi 2 lần
    expect(await db.requestEvent.count({ where: { requestId: id, action: "DA_TRA_THU_LAO" } })).toBe(1);
    expect(await db.pickupRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({ paidAmount: 60000, commission: 6000, thanks: "Cảm ơn chị" });
    expect((await E.payInfo(bao, id))!.amount).toBe(60000);
    await E.markReceived(nga, id);
    expect(await db.requestEvent.count({ where: { requestId: id, action: "DA_NHAN_THU_LAO" } })).toBe(1);

    // lượt có phí không cộng điểm tương trợ
    expect(await rewardOf(nga)).toHaveLength(0);

    const earn = await E.earnings(nga);
    expect(earn.month).toMatchObject({ jobs: 1, gross: 60000, net: 54000 });
    expect(earn.owed.amount).toBe(6000);
    await E.settleCommission(nga);
    expect((await E.owedOf(nga)).amount).toBe(0);
    await expect(E.settleCommission(nga)).rejects.toThrow(/không còn nợ/);
  });

  it("nợ phí nền tảng quá hạn thì tạm không nhận việc có phí mới", async () => {
    const { id, nga } = await paidJobDone();
    // giả lập nhiều lượt đã được trả từ 40 ngày trước, chưa nộp phí
    const old = new Date(Date.now() - 40 * 86_400_000);
    await db.pickupRequest.update({ where: { id }, data: { paidAt: old, commission: 300_000 } });
    expect((await E.owedOf(nga)).overdue).toBe(true);
    const { post } = await paidAsk();
    await expect(C.offerHelp(nga, post.id)).rejects.toThrow(/nợ phí nền tảng/);
    await E.settleCommission(nga);
    await C.offerHelp(nga, post.id);
  });
});
