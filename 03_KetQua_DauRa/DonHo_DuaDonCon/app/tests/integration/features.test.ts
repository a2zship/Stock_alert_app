// Bản đồ theo dõi, nhóm lớp, điểm tương trợ — chạy trên DB test thật.
import { beforeEach, describe, expect, it } from "vitest";
import { computeReward } from "@/domain/reward";
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { db } from "@/server/db";
import * as C from "@/server/chat";
import * as R from "@/server/requests";
import { rewardOf } from "@/server/rewards";
import * as G from "@/server/tracking";
import { beAn, phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

const date = addDays(vnToday(), 1);
const start = vnDateTime(date, "16:30");
const nearStart = new Date(start.getTime() - 20 * 60_000);
const atGate = new Date(start.getTime() + 5 * 60_000);
const school = { lat: 10.0341, lng: 105.7852 };

async function approvedTrusted() {
  const bo = await uid(phoneOf.bo);
  const an = await beAn();
  const ba = await db.trustedPerson.findFirstOrThrow({ where: { studentId: an.id, status: "DA_DUYET" } });
  const id = await R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: ba.id });
  const baNgoai = await uid(phoneOf.baNgoai);
  await R.delegateRespond(baNgoai, id, true);
  await R.teacherDecide(await uid(phoneOf.coLan), id, true);
  return { id, bo, baNgoai };
}

beforeEach(resetDb);

describe("bản đồ theo dõi", () => {
  it("chỉ người đón gửi được vị trí, đúng khung giờ; phụ huynh và GV lớp xem được, người ngoài thì không", async () => {
    const { id, bo, baNgoai } = await approvedTrusted();
    await expect(G.shareLocation(bo, id, 10.03, 105.78, nearStart)).rejects.toThrow(/không gửi cho bạn/);
    await expect(G.shareLocation(baNgoai, id, 10.03, 105.78, new Date(start.getTime() - 3 * 3600_000))).rejects.toThrow(/60 phút/);
    await expect(G.shareLocation(baNgoai, id, 200, 105.78, nearStart)).rejects.toThrow(/không hợp lệ/);

    await G.shareLocation(baNgoai, id, 10.04, 105.79, nearStart);
    const v = await G.trackingView(bo, id, nearStart);
    expect(v?.delegate?.lat).toBe(10.04);
    expect(v?.distance).toBeGreaterThan(500);
    expect(v?.eta).toBeGreaterThan(0);
    expect(await G.trackingView(await uid(phoneOf.coLan), id, nearStart)).not.toBeNull();
    expect(await G.trackingView(await uid(phoneOf.coMai), id, nearStart)).toBeNull();
    expect(await G.trackingView(await uid(phoneOf.meBinh), id, nearStart)).toBeNull();

    // lần đầu bật chia sẻ: phụ huynh nhận tin, ghi nhật ký một lần
    await G.shareLocation(baNgoai, id, school.lat, school.lng, nearStart);
    expect(await db.requestEvent.count({ where: { requestId: id, action: "CHIA_SE_VI_TRI" } })).toBe(1);
    expect((await G.trackingView(bo, id, nearStart))?.nearGate).toBe(true);
  });

  it("báo tới cổng một lần; xác nhận về an toàn thì xoá vị trí, lưu lời cảm ơn, báo người đón", async () => {
    const { id, bo, baNgoai } = await approvedTrusted();
    await G.arriveGate(baNgoai, id, nearStart);
    await G.arriveGate(baNgoai, id, nearStart);
    expect(await db.requestEvent.count({ where: { requestId: id, action: "TOI_CONG" } })).toBe(1);
    expect(await db.message.count({ where: { toPhone: phoneOf.coLan, body: { contains: "tới cổng" } } })).toBe(1);

    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    const lan = await uid(phoneOf.coLan);
    const { unseal } = await import("@/server/seal");
    const { appSecret } = await import("@/server/db");
    const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
    await R.gateByPin(lan, id, codes.pin, atGate);
    await R.handover(lan, id, { face: true, cccd: true, child: true }, photoDataUrl(), atGate);
    await G.shareLocation(baNgoai, id, 10.05, 105.8, new Date(atGate.getTime() + 60_000)); // đang đưa bé về
    expect((await G.trackingView(bo, id))?.delegate).not.toBeNull();

    await R.confirmHome(bo, id, new Date(), "Cảm ơn bà nhiều!");
    const done = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(done.delegateLat).toBeNull();
    expect(done.thanks).toBe("Cảm ơn bà nhiều!");
    expect(await db.message.count({ where: { toPhone: phoneOf.baNgoai, body: { contains: "điểm tương trợ" } } })).toBe(1);
    await expect(G.shareLocation(baNgoai, id, 10.05, 105.8)).rejects.toThrow();

    const rw = computeReward(await rewardOf(baNgoai));
    expect(rw.pickups).toBe(1);
    expect(rw.thanks).toBe(1);
    expect(rw.points).toBeGreaterThanOrEqual(12);
  });
});

describe("nhóm lớp", () => {
  it("đăng lời nhờ → phụ huynh khác nhận → người nhờ chọn → tạo yêu cầu đón hộ ngoài danh sách", async () => {
    const bao = await uid(phoneOf.bao);
    const me = await uid(phoneOf.me);
    const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
    await C.postPickupAsk(bao, { studentId: ngoc.id, date, note: "Mình đi công tác" });
    await expect(C.postPickupAsk(bao, { studentId: ngoc.id, date })).rejects.toThrow(/Đã có lời nhờ/);
    const post = await db.chatPost.findFirstOrThrow({ where: { kind: "NHO_DON" } });
    // cả lớp Lá 1 (bố, mẹ bé An + cô Lan) nhận tin; lớp khác thì không
    expect(await db.message.count({ where: { toPhone: phoneOf.me, body: { contains: "cần người đón giúp" } } })).toBe(1);
    expect(await db.message.count({ where: { toPhone: phoneOf.meBinh, body: { contains: "cần người đón giúp" } } })).toBe(0);

    // phụ huynh lớp khác cùng trường: phải chờ lời nhờ lên vòng TRƯỜNG
    await expect(C.offerHelp(await uid(phoneOf.meBinh), post.id)).rejects.toThrow(/ưu tiên phụ huynh gần bé/);
    await expect(C.offerHelp(await uid(phoneOf.coLan), post.id)).rejects.toThrow(/Chỉ phụ huynh/);
    await expect(C.offerHelp(bao, post.id)).rejects.toThrow(/phụ huynh của bé/);
    await C.offerHelp(me, post.id, "Mình tiện đường");
    await expect(C.offerHelp(me, post.id)).rejects.toThrow(/đã nhận lời/);

    const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id } });
    await expect(C.chooseOffer(me, offer.id)).rejects.toThrow(/giám hộ/);
    const id = await C.chooseOffer(bao, offer.id);
    await expect(C.chooseOffer(bao, offer.id)).rejects.toThrow(/đã được chọn/);

    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(r.status).toBe("CHO_NGUOI_DON"); // vẫn phải đủ 3 bên xác nhận như mọi yêu cầu
    expect(r.isAdhoc).toBe(true);
    expect(r.delegatePhone).toBe(phoneOf.me);
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post.id } })).requestId).toBe(id);

    const feed = await C.chatFeed(me, ngoc.classId);
    expect(feed.posts.find((p) => p.id === post.id)?.ask?.requestId).toBe(id);
    expect(JSON.stringify(feed)).not.toContain(phoneOf.bao); // không lộ số điện thoại trong nhóm
  });

  it("người trong danh sách không được đón bị chặn khi nhận đón trong nhóm, giáo viên được báo", async () => {
    const an = await beAn();
    const blockedUser = await db.user.create({ data: { phone: "0901000099", name: "Người lạ" } });
    const stranger = await db.student.create({ data: { classId: an.classId, name: "Bé Mẫu" } });
    await db.guardian.create({ data: { userId: blockedUser.id, studentId: stranger.id, relation: "Bố" } });
    await C.postPickupAsk(await uid(phoneOf.me), { studentId: an.id, date });
    const post = await db.chatPost.findFirstOrThrow({ where: { kind: "NHO_DON" } });
    await expect(C.offerHelp(blockedUser.id, post.id)).rejects.toThrow(/không thể nhận/);
    expect(await db.chatOffer.count()).toBe(0);
    expect(await db.message.count({ where: { toPhone: phoneOf.coLan, body: { contains: "KHÔNG ĐƯỢC ĐÓN" } } })).toBe(1);
  });

  it("chọn người tin cậy đã duyệt thì đi luồng tin cậy; tạo yêu cầu lỗi thì mở lại lời nhờ", async () => {
    const an = await beAn();
    const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
    const bao = await uid(phoneOf.bao);
    // anh Bảo được duyệt vào danh sách tin cậy của bé An
    await db.trustedPerson.create({ data: { studentId: an.id, addedById: await uid(phoneOf.me), name: "Anh Trần Quốc Bảo", phone: phoneOf.bao, relation: "Bố bạn Ngọc", cccdLast4: "5512", photoId: "x", status: "DA_DUYET" } });
    const me = await uid(phoneOf.me);
    await C.postPickupAsk(me, { studentId: an.id, date });
    const post = await db.chatPost.findFirstOrThrow({ where: { kind: "NHO_DON" } });
    await C.offerHelp(bao, post.id);
    const offer = await db.chatOffer.findFirstOrThrow();
    const id = await C.chooseOffer(me, offer.id);
    expect((await db.pickupRequest.findUniqueOrThrow({ where: { id } })).isAdhoc).toBe(false);

    // lời nhờ thứ hai cùng ca: createRequest báo trùng → lời nhờ quay lại trạng thái MỞ
    await C.closePost(me, post.id);
    await db.chatPost.update({ where: { id: post.id }, data: { status: "DA_DONG" } });
    const post2 = await db.chatPost.create({ data: { classId: ngoc.classId, authorId: me, kind: "NHO_DON", studentId: an.id, date, body: "" } });
    const offer2 = await db.chatOffer.create({ data: { postId: post2.id, userId: bao } });
    await expect(C.chooseOffer(me, offer2.id)).rejects.toThrow(/đang chạy/);
    expect((await db.chatPost.findUniqueOrThrow({ where: { id: post2.id } })).status).toBe("MO");
  });
});
