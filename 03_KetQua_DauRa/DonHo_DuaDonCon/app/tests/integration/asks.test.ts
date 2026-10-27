// Quy tắc đăng lời nhờ: nhóm lớp (nhắn thẳng phụ huynh cùng lớp) → cả trường → khu vực sống; chỉ mở rộng khi chưa ai nhận.
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, vnToday } from "@/domain/time";
import * as K from "@/server/asks";
import * as C from "@/server/chat";
import { db } from "@/server/db";
import { phoneOf, resetDb, uid } from "./helpers";

beforeEach(resetDb);

const date = addDays(vnToday(), 1); // ngày mai: còn xa giờ đón → mỗi vòng 30 phút
const later = (min: number) => new Date(Date.now() + min * 60_000);
const askNgoc = async () => {
  const bao = await uid(phoneOf.bao);
  const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
  await C.postPickupAsk(bao, { studentId: ngoc.id, date, note: "Mình kẹt họp" });
  return { bao, post: await db.chatPost.findFirstOrThrow({ where: { studentId: ngoc.id, status: "MO" } }) };
};

/** Phụ huynh trường khác (Sen Hồng) nhưng SỐNG cùng phường với anh Bảo, đã được cô xác nhận con. */
async function neighbour(phone: string, wardName: string) {
  const ward = await db.ward.findFirstOrThrow({ where: { name: wardName } });
  const cls = await db.class.findFirstOrThrow({ where: { name: "Lớp Mầm 1" } });
  const u = await db.user.create({ data: { phone, name: `Chị Hàng Xóm ${phone.slice(-2)}`, provinceId: ward.provinceId, wardId: ward.id } });
  const kid = await db.student.create({ data: { classId: cls.id, name: `Bé Mầm ${phone.slice(-2)}` } });
  await db.guardian.create({ data: { userId: u.id, studentId: kid.id, relation: "Mẹ" } });
  return u.id;
}

describe("vòng phát lời nhờ đón hộ", () => {
  it("vòng 1 chỉ lớp; 30 phút chưa ai nhận → cả trường (không lộ tên bé); có người nhận thì dừng mở rộng", async () => {
    const { post } = await askNgoc();
    expect(post).toMatchObject({ scope: "LOP" });
    const nga = await uid(phoneOf.meBinh); // lớp Chồi 2, cùng trường
    await expect(C.offerHelp(nga, post.id)).rejects.toThrow(/ưu tiên phụ huynh gần bé/);
    expect(await K.asksAround(nga)).toHaveLength(0);

    await K.escalateAsks(later(10)); // chưa tới 30 phút
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).scope).toBe("LOP");
    await K.escalateAsks(later(31));
    await K.escalateAsks(later(31)); // gọi trùng không báo 2 lần
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).scope).toBe("TRUONG");
    expect(await db.message.count({ where: { toPhone: phoneOf.meBinh, link: "/nhom#quanh-ban" } })).toBe(1);
    expect(await db.message.count({ where: { toPhone: phoneOf.me, link: "/nhom#quanh-ban" } })).toBe(0); // cùng lớp đã được báo ở vòng 1
    expect(await db.message.count({ where: { toPhone: phoneOf.bao, body: { contains: "Chưa ai trong lớp" } } })).toBe(1);

    const around = await K.asksAround(nga);
    expect(around).toHaveLength(1);
    expect(JSON.stringify(around)).not.toContain("Ngọc");
    await C.offerHelp(nga, post.id);
    // đã có người nhận → không lên khu vực dù hết giờ
    await K.escalateAsks(later(120));
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).scope).toBe("TRUONG");
  });

  it("chưa ai trong trường nhận → phụ huynh sống cùng phường/xã (trường khác) được báo và nhận; ngoài phường thì không", async () => {
    const near = await neighbour("0907000001", "Phường Ninh Kiều");
    const far = await neighbour("0907000002", "Phường Cái Khế");
    const { bao, post } = await askNgoc();
    await expect(C.offerHelp(near, post.id)).rejects.toThrow(/ưu tiên/);
    await K.escalateAsks(later(31));
    await expect(C.offerHelp(near, post.id)).rejects.toThrow(/ưu tiên/); // đang ở vòng trường
    await K.escalateAsks(later(62));
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).scope).toBe("KHU_VUC");
    expect(await db.message.count({ where: { toPhone: "0907000001", link: "/nhom#quanh-ban" } })).toBe(1);
    expect(await db.message.count({ where: { toPhone: "0907000002" } })).toBe(0);
    expect(await K.asksAround(far)).toHaveLength(0);
    await expect(C.offerHelp(far, post.id)).rejects.toThrow(/không gửi tới bạn/);

    expect((await K.asksAround(near))[0]).toMatchObject({ scope: "KHU_VUC", className: "Lớp Lá 1", sameSchool: false });
    await C.offerHelp(near, post.id, "Nhà mình gần trường");
    const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id } });
    const reqId = await C.chooseOffer(bao, offer.id);
    // vẫn là yêu cầu ngoài danh sách: cô duyệt + kiểm tại cổng như mọi lần
    expect(await db.pickupRequest.findUniqueOrThrow({ where: { id: reqId } })).toMatchObject({ isAdhoc: true, relation: "Phụ huynh cùng khu vực sống", status: "CHO_NGUOI_DON" });
  });

  it("người nhờ mở rộng sớm theo đúng thứ tự; lời nhờ có thù lao dừng ở trường; người khác không mở rộng được", async () => {
    const { bao, post } = await askNgoc();
    await expect(K.widenAsk(await uid(phoneOf.me), post.id)).rejects.toThrow(/người đăng/);
    expect(await K.widenAsk(bao, post.id)).toBe("TRUONG");
    expect(await K.widenAsk(bao, post.id)).toBe("KHU_VUC");
    await expect(K.widenAsk(bao, post.id)).rejects.toThrow(/rộng nhất/);

    const bo = await uid(phoneOf.bo);
    const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
    await C.postPickupAsk(bo, { studentId: an.id, date, fee: "50000" });
    const paid = await db.chatPost.findFirstOrThrow({ where: { studentId: an.id, status: "MO" } });
    expect(await K.widenAsk(bo, paid.id)).toBe("TRUONG");
    await expect(K.widenAsk(bo, paid.id)).rejects.toThrow(/chỉ gửi trong trường/);
    await K.escalateAsks(later(200));
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: paid.id } })).scope).toBe("TRUONG");
  });
});
