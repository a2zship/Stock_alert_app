// Điểm trả bé khai theo từng lần: phân quyền xem địa chỉ, bản đồ đưa bé về, báo tới nơi, tự xoá khi đóng.
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { appSecret, db } from "@/server/db";
import * as C from "@/server/chat";
import { placesOf, savePlace } from "@/server/places";
import { requestView } from "@/server/queries";
import * as R from "@/server/requests";
import { unseal } from "@/server/seal";
import * as G from "@/server/tracking";
import { beAn, phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

const date = addDays(vnToday(), 1);
const start = vnDateTime(date, "16:30");
const atGate = new Date(start.getTime() + 5 * 60_000);
const home = { label: "Nhà bà nội", address: "25 Mậu Thân, hẻm 3", ward: "Phường Ninh Kiều", lat: 10.0402, lng: 105.7731 };

async function newRequest() {
  const bo = await uid(phoneOf.bo);
  const an = await beAn();
  const ba = await db.trustedPerson.findFirstOrThrow({ where: { studentId: an.id, status: "DA_DUYET" } });
  const id = await R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: ba.id, drop: home });
  return { id, bo, an, ba, baNgoai: await uid(phoneOf.baNgoai), lan: await uid(phoneOf.coLan) };
}

beforeEach(resetDb);

describe("điểm trả bé", () => {
  it("khai sai thì báo lỗi; người đón chỉ thấy phường/xã tới khi cô duyệt; GV và phụ huynh luôn thấy", async () => {
    const bo = await uid(phoneOf.bo);
    const an = await beAn();
    const ba = await db.trustedPerson.findFirstOrThrow({ where: { studentId: an.id, status: "DA_DUYET" } });
    await expect(R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: ba.id, drop: { address: "25 Mậu Thân" } }))
      .rejects.toThrow(/phường\/xã/);
    await expect(R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: ba.id, drop: { ...home, lat: 200 } }))
      .rejects.toThrow(/không hợp lệ/);

    const { id, baNgoai, lan } = await newRequest();
    // tin mời nhận lời chỉ nói phường/xã
    const sms = await db.message.findFirstOrThrow({ where: { toPhone: phoneOf.baNgoai, channel: "SMS" }, orderBy: { createdAt: "desc" } });
    expect(sms.body).toContain("Phường Ninh Kiều");
    expect(sms.body).not.toContain("Mậu Thân");

    const before = await requestView(baNgoai, id);
    expect(before?.drop).toMatchObject({ ward: "Phường Ninh Kiều", address: null, pinned: false });
    expect(before?.r.dropAddress).toBeNull();
    expect(before?.r.dropLat).toBeNull();
    expect((await requestView(lan, id))?.drop?.address).toContain("Mậu Thân");
    expect((await requestView(bo, id))?.drop?.address).toContain("Mậu Thân");

    await R.delegateRespond(baNgoai, id, true);
    await R.teacherDecide(lan, id, true);
    const after = await requestView(baNgoai, id);
    expect(after?.drop?.address).toBe("25 Mậu Thân, hẻm 3, Phường Ninh Kiều");
    // tin báo đã duyệt mới kèm địa chỉ
    expect(await db.message.count({ where: { toPhone: phoneOf.baNgoai, body: { contains: "Tra be tai: 25 Mậu Thân" } } })).toBe(1);
  });

  it("đưa bé về: bản đồ tính khoảng cách tới điểm trả, báo tới nơi một lần, xác nhận về thì xoá địa chỉ", async () => {
    const { id, bo, baNgoai, lan } = await newRequest();
    await R.delegateRespond(baNgoai, id, true);
    await R.teacherDecide(lan, id, true);
    await expect(G.arriveDrop(baNgoai, id, atGate)).rejects.toThrow(/sau khi cô giáo đã giao/);

    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
    await R.gateByPin(lan, id, codes.pin, atGate);
    await R.handover(lan, id, { face: true, cccd: true, child: true }, photoDataUrl(), atGate);

    const later = new Date(atGate.getTime() + 5 * 60_000);
    await G.shareLocation(baNgoai, id, 10.0341, 105.7852, later); // vẫn ở gần trường
    const far = await G.trackingView(bo, id, later);
    expect(far?.drop?.label).toBe("Nhà bà nội");
    expect(far?.dropDistance).toBeGreaterThan(1000);
    expect(far?.nearDrop).toBe(false);
    await G.shareLocation(baNgoai, id, 10.0403, 105.7732, later);
    expect((await G.trackingView(bo, id, later))?.nearDrop).toBe(true);
    expect(await G.trackingView(await uid(phoneOf.meBinh), id, later)).toBeNull();

    await G.arriveDrop(baNgoai, id, later);
    await G.arriveDrop(baNgoai, id, later);
    expect(await db.requestEvent.count({ where: { requestId: id, action: "TOI_NOI_TRA" } })).toBe(1);
    expect(await db.message.count({ where: { toPhone: phoneOf.bo, body: { contains: "đã đưa bé" } } })).toBe(1);
    expect((await G.trackingView(bo, id, later))?.droppedAt).not.toBeNull();

    await R.confirmHome(bo, id);
    const done = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(done).toMatchObject({ dropAddress: null, dropLat: null, dropLng: null, dropLabel: null, dropWard: "Phường Ninh Kiều" });
  });

  it("người đón từ chối cũng xoá địa chỉ", async () => {
    const { id, baNgoai } = await newRequest();
    await R.delegateRespond(baNgoai, id, false);
    expect((await db.pickupRequest.findUniqueOrThrow({ where: { id } })).dropAddress).toBeNull();
  });

  it("nhóm lớp: cả nhóm chỉ thấy phường/xã; chọn người thì địa chỉ chuyển sang yêu cầu và xoá khỏi bài đăng", async () => {
    const bao = await uid(phoneOf.bao);
    const me = await uid(phoneOf.me);
    const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
    await C.postPickupAsk(bao, { studentId: ngoc.id, date, drop: home });
    const notice = await db.message.findFirstOrThrow({ where: { toPhone: phoneOf.me, body: { contains: "cần người đón" } } });
    expect(notice.body).toContain("Phường Ninh Kiều");
    expect(notice.body).not.toContain("Mậu Thân");

    const ask = (await C.chatFeed(me, ngoc.classId)).posts.find((p) => p.ask)!.ask!;
    expect(ask.ward).toBe("Phường Ninh Kiều");
    expect(ask.dropAddress).toBeNull();
    expect((await C.chatFeed(bao, ngoc.classId)).posts.find((p) => p.ask)!.ask!.dropAddress).toContain("Mậu Thân");

    const post = await db.chatPost.findFirstOrThrow({ where: { studentId: ngoc.id } });
    await C.offerHelp(me, post.id);
    const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id } });
    const id = await C.chooseOffer(bao, offer.id);
    const req = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(req).toMatchObject({ dropAddress: "25 Mậu Thân, hẻm 3", dropWard: "Phường Ninh Kiều", dropLat: home.lat, dropLabel: "Nhà bà nội" });
    expect(await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ dropAddress: null, dropLat: null, dropWard: "Phường Ninh Kiều" });
  });

  it("điểm hay dùng gắn với tài khoản phụ huynh: cập nhật theo tên gọi, giữ tối đa 5 điểm", async () => {
    const bo = await uid(phoneOf.bo);
    await savePlace(bo, home);
    await savePlace(bo, { ...home, address: "27 Mậu Thân" });
    expect((await placesOf(bo)).map((p) => p.address)).toEqual(["27 Mậu Thân"]);
    for (let i = 1; i <= 5; i++) await savePlace(bo, { label: `Điểm ${i}`, address: `${i} Đường số ${i}`, ward: "Xã An Bình" });
    const all = await placesOf(bo);
    expect(all).toHaveLength(5);
    expect(all.some((p) => p.label === "Nhà bà nội")).toBe(false);
    expect(await placesOf(await uid(phoneOf.me))).toHaveLength(0);
  });
});
