// Thành viên ưu đãi: miễn phí vẫn dùng đủ; trả phí thì giảm phí nền tảng, nới hạn mức nợ, lưu nhiều điểm trả, nổi bật trên bảng việc.
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, vnToday } from "@/domain/time";
import { db } from "@/server/db";
import * as C from "@/server/chat";
import * as E from "@/server/earn";
import * as M from "@/server/membership";
import { placesOf, savePlace } from "@/server/places";
import { phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

beforeEach(resetDb);

async function approvedNga() {
  const nga = await uid(phoneOf.meBinh);
  await E.registerHelper(nga, { cccdLast4: "5566", photo: photoDataUrl(), bankBin: "970436", bankAccount: "0123456789", accountName: "VO THANH NGA", agree: true });
  const prof = await db.helperProfile.findUniqueOrThrow({ where: { userId: nga } });
  await E.reviewHelper(await uid(phoneOf.coMai), prof.id, "approve");
  return nga;
}

describe("thành viên ưu đãi", () => {
  it("mặc định là Thường; mua gói có hiệu lực ngay; giáo viên không mua; bấm trùng không tạo 2 gói", async () => {
    const bao = await uid(phoneOf.bao);
    expect((await M.tierOf(bao)).key).toBe("THUONG");
    await expect(M.buyMembership(await uid(phoneOf.coLan), "VANG", 1)).rejects.toThrow(/phụ huynh/);
    await expect(M.buyMembership(bao, "VIP", 1)).rejects.toThrow(/hạng/);
    await expect(M.buyMembership(bao, "VANG", 3)).rejects.toThrow(/12 tháng/);
    await M.buyMembership(bao, "VANG", 12);
    await expect(M.buyMembership(bao, "VANG", 12)).rejects.toThrow(/vừa báo/);
    const t = await M.tierOf(bao);
    expect(t.key).toBe("VANG");
    expect((await db.membership.findFirstOrThrow({ where: { userId: bao } })).amount).toBe(690_000);
    expect(await db.auditLog.count({ where: { actorId: bao, action: "MUA_THANH_VIEN" } })).toBe(1);
  });

  it("gói hết hạn hoặc bị huỷ đối soát thì về Thường", async () => {
    const bao = await uid(phoneOf.bao);
    await M.buyMembership(bao, "BAC", 1);
    expect((await M.tierOf(bao, addMonthsLater(2))).key).toBe("THUONG");
    await db.membership.updateMany({ where: { userId: bao }, data: { status: "HUY" } });
    expect((await M.tierOf(bao)).key).toBe("THUONG");
  });

  it("số điểm trả hay dùng theo hạng: Thường 5, Bạc 10", async () => {
    const bo = await uid(phoneOf.bo);
    const add = (i: number) => savePlace(bo, { label: `Điểm ${i}`, address: `${i} Lê Lợi`, ward: "Phường An Hòa" });
    for (let i = 1; i <= 7; i++) await add(i);
    expect(await placesOf(bo)).toHaveLength(5);
    await M.buyMembership(bo, "BAC", 1);
    for (let i = 8; i <= 14; i++) await add(i);
    expect(await placesOf(bo)).toHaveLength(10);
  });

  it("bảng việc: lời nhờ của thành viên Vàng nổi bật, người đón nhận theo mức phí thấp hơn của hai bên", async () => {
    const nga = await approvedNga();
    const bo = await uid(phoneOf.bo);
    const bao = await uid(phoneOf.bao);
    const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
    const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
    const date = addDays(vnToday(), 1);
    await C.postPickupAsk(bo, { studentId: an.id, date, fee: "50000" });
    await C.postPickupAsk(bao, { studentId: ngoc.id, date, fee: "50000" });
    await M.buyMembership(bao, "KIM_CUONG", 1);

    const board = await E.paidBoard(nga);
    expect(board.map((b) => b.featured)).toEqual([true, false]);
    expect(board[0]).toMatchObject({ net: 48_000, rate: 0.03 }); // người nhờ Kim cương → người đón chỉ chịu 3%
    expect(board[1]).toMatchObject({ net: 45_000, rate: 0.1 });
    // người đón tự mua Vàng → lời nhờ thường cũng chỉ chịu 5%
    await M.buyMembership(nga, "VANG", 1);
    expect((await E.paidBoard(nga))[1]).toMatchObject({ net: 47_000, rate: 0.05 }); // 5% của 50.000 = 2.500, làm tròn nghìn thành 3.000
    expect((await E.earnings(nga)).rate).toBe(0.05);
  });

  it("hạn mức nợ phí theo hạng: Thường bị chặn, Vàng (800 nghìn / 60 ngày) vẫn nhận việc", async () => {
    const nga = await approvedNga();
    const bo = await uid(phoneOf.bo);
    const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
    // giả lập một lượt cũ đã được trả 40 ngày trước, nợ 400 nghìn phí
    await db.pickupRequest.create({ data: {
      studentId: an.id, requesterId: bo, delegateId: nga, delegateName: "Chị Võ Thanh Nga", delegatePhone: phoneOf.meBinh, relation: "Phụ huynh cùng trường (đón có phí)",
      isAdhoc: true, status: "HOAN_TAT", windowStart: new Date(Date.now() - 41 * 86_400_000), windowEnd: new Date(Date.now() - 41 * 86_400_000 + 3_600_000),
      fee: 50_000, paidAmount: 4_000_000, commission: 400_000, paidAt: new Date(Date.now() - 40 * 86_400_000),
    } }).catch((e) => { throw new Error(`Thiếu trường bắt buộc khi tạo yêu cầu mẫu: ${e.message.slice(-300)}`); });
    expect((await E.owedOf(nga)).overdue).toBe(true);
    await M.buyMembership(nga, "VANG", 1);
    expect(await E.owedOf(nga)).toMatchObject({ overdue: false, limit: 800_000, days: 60 });
  });
});

function addMonthsLater(n: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}
