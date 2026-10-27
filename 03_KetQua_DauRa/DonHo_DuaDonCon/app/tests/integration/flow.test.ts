// Luồng thật trên DB test: 3 bên xác nhận, chốt an toàn tại cổng, kiểm quyền, OTP.
import { beforeEach, describe, expect, it } from "vitest";
import { hashCode } from "@/domain/codes";
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { canViewPhoto } from "@/server/access";
import { requestOtp, verifyOtp } from "@/server/auth";
import { appSecret, AppError, db } from "@/server/db";
import * as R from "@/server/requests";
import { unseal } from "@/server/seal";
import * as T from "@/server/trusted";
import { beAn, phoneOf, photoDataUrl, resetDb, uid } from "./helpers";

// Ca đón ngày mai 16:30–17:30 (giờ VN) của lớp Lá 1 — luôn ở tương lai so với giờ chạy test
const date = addDays(vnToday(), 1);
const start = vnDateTime(date, "16:30");
const end = vnDateTime(date, "17:30");
const atGate = new Date(start.getTime() + 5 * 60_000);

async function trustedRequest() {
  const bo = await uid(phoneOf.bo);
  const an = await beAn();
  const ba = await db.trustedPerson.findFirstOrThrow({ where: { studentId: an.id, status: "DA_DUYET" } });
  const id = await R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: ba.id, reason: "Bố mẹ họp đột xuất" });
  return { id, bo, an };
}

async function approved() {
  const ctx = await trustedRequest();
  await R.delegateRespond(await uid(phoneOf.baNgoai), ctx.id, true);
  await R.teacherDecide(await uid(phoneOf.coLan), ctx.id, true);
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: ctx.id } });
  const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
  return { ...ctx, codes };
}

const status = async (id: string) => (await db.pickupRequest.findUniqueOrThrow({ where: { id } })).status;

beforeEach(resetDb);

describe("luồng chính — người tin cậy", () => {
  it("đủ 3 bên xác nhận → giao trẻ → phụ huynh xác nhận về", async () => {
    const { id, bo, codes } = await approved();
    expect(await status(id)).toBe("DA_DUYET");
    expect(codes.pin).toMatch(/^\d{6}$/);

    const lan = await uid(phoneOf.coLan);
    expect((await R.gateByPin(lan, id, "000000" === codes.pin ? "111111" : "000000", atGate)).ok).toBe(false);
    expect((await R.gateByPin(lan, id, codes.pin, atGate)).ok).toBe(true);
    await R.handover(lan, id, { face: true, cccd: true, child: true }, photoDataUrl(), new Date(atGate.getTime() + 60_000));
    expect(await status(id)).toBe("DA_GIAO");

    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(r.tokenHash).toBeNull(); // mã dùng một lần
    expect(r.codeSealed).toBeNull();
    expect(r.handoverPhotoId).not.toBeNull();

    // cả bố và mẹ đều nhận tin đã giao
    const notified = await db.message.findMany({ where: { body: { contains: "đã được giao" } } });
    expect(new Set(notified.map((m) => m.toPhone))).toEqual(new Set([phoneOf.bo, phoneOf.me]));

    await R.confirmHome(bo, id);
    expect(await status(id)).toBe("HOAN_TAT");
    const actions = (await db.requestEvent.findMany({ where: { requestId: id }, orderBy: { at: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["TAO", "NGUOI_DON_NHAN", "GV_DUYET", "NHAP_PIN_SAI", "NHAP_PIN_DUNG", "GIAO_TRE", "PH_XAC_NHAN_VE"]);
  });

  it("quét QR mở được hồ sơ; dùng lại QR sau khi giao thì bị từ chối", async () => {
    const { id, codes } = await approved();
    const lan = await uid(phoneOf.coLan);
    expect(await R.gateByToken(lan, codes.token, atGate)).toBe(id);
    await R.handover(lan, id, { face: true, cccd: true, child: true }, undefined, atGate);
    await expect(R.gateByToken(lan, codes.token, atGate)).rejects.toThrow(/không hợp lệ/);
  });

  it("không giao khi chưa quét mã, hoặc chưa tích đủ 3 ô kiểm", async () => {
    const { id, codes } = await approved();
    const lan = await uid(phoneOf.coLan);
    await expect(R.handover(lan, id, { face: true, cccd: true, child: true }, undefined, atGate)).rejects.toThrow(/quét QR hoặc nhập PIN/);
    await R.gateByPin(lan, id, codes.pin, atGate);
    await expect(R.handover(lan, id, { face: true, cccd: false, child: true }, undefined, atGate)).rejects.toThrow(/3 ô kiểm/);
    expect(await status(id)).toBe("DA_DUYET");
  });

  it("mã chưa tới giờ thì không dùng được", async () => {
    const { id, codes } = await approved();
    await expect(R.gateByPin(await uid(phoneOf.coLan), id, codes.pin, new Date(start.getTime() - 31 * 60_000))).rejects.toThrow(/khung giờ/);
  });
});

describe("chốt an toàn", () => {
  it("sai PIN 5 lần → khoá yêu cầu, xoá mã, báo phụ huynh", async () => {
    const { id, codes } = await approved();
    const lan = await uid(phoneOf.coLan);
    const wrong = codes.pin === "999999" ? "888888" : "999999";
    for (let i = 0; i < 4; i++) expect((await R.gateByPin(lan, id, wrong, atGate)).ok).toBe(false);
    const last = await R.gateByPin(lan, id, wrong, atGate);
    expect(last).toMatchObject({ ok: false });
    expect(await status(id)).toBe("BI_KHOA");
    await expect(R.gateByToken(lan, codes.token, atGate)).rejects.toThrow(AppError);
    expect(await db.message.count({ where: { toPhone: phoneOf.me, body: { contains: "KHOÁ" } } })).toBeGreaterThan(0);
  });

  it("phụ huynh huỷ → mã đã phát hết hiệu lực ngay", async () => {
    const { id, bo, codes } = await approved();
    await R.cancelRequest(bo, id);
    expect(await status(id)).toBe("DA_HUY");
    await expect(R.gateByToken(await uid(phoneOf.coLan), codes.token, atGate)).rejects.toThrow(/không hợp lệ/);
    expect(await db.pickupRequest.count({ where: { tokenHash: hashCode(appSecret(), "token", codes.token) } })).toBe(0);
  });

  it("người trong danh sách cấm bị chặn ngay khi tạo, giáo viên được báo", async () => {
    const bo = await uid(phoneOf.bo);
    const an = await beAn();
    await expect(R.createRequest(bo, { studentId: an.id, date, mode: "adhoc", name: "Người lạ", phone: "0901000099", relation: "Quen" })).rejects.toThrow(/KHÔNG ĐƯỢC ĐÓN/);
    expect(await db.pickupRequest.count()).toBe(0);
    expect(await db.message.count({ where: { toPhone: phoneOf.coLan, body: { contains: "Cảnh báo" } } })).toBe(1);
  });

  it("người ngoài danh sách: phải tự chụp ảnh + khai CCCD; GV phải gọi xác minh mới duyệt được", async () => {
    const me = await uid(phoneOf.me);
    const an = await beAn();
    const id = await R.createRequest(me, { studentId: an.id, date, mode: "adhoc", name: "Chị Lý Thu Trang", phone: "0912 345 678", relation: "Đồng nghiệp của mẹ" });
    const trang = await uid("0912345678");
    await expect(R.delegateRespond(trang, id, true, { cccdLast4: "12" })).rejects.toThrow(/4 số cuối/);
    await expect(R.delegateRespond(trang, id, true, { cccdLast4: "1234" })).rejects.toThrow(/ảnh chân dung/);
    await R.delegateRespond(trang, id, true, { cccdLast4: "1234", photo: photoDataUrl() });
    const lan = await uid(phoneOf.coLan);
    await expect(R.teacherDecide(lan, id, true, {})).rejects.toThrow(/gọi điện xác minh/);
    await R.teacherDecide(lan, id, true, { calledParent: true });
    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    expect(r.status).toBe("DA_DUYET");
    expect(r.teacherCalledParent).toBe(true);
  });

  it("không có hai yêu cầu chạy song song cho cùng một ca", async () => {
    await trustedRequest();
    await expect(trustedRequest()).rejects.toThrow(/đang chạy cho ca này/);
  });

  it("quá giờ đón → hết hạn; giao rồi 24 giờ không xác nhận → tự đóng", async () => {
    const { id } = await trustedRequest();
    await R.sweep(new Date(end.getTime() + 60_000));
    expect(await status(id)).toBe("HET_HAN");

    const b = await approved();
    const lan = await uid(phoneOf.coLan);
    await R.gateByPin(lan, b.id, b.codes.pin, atGate);
    await R.handover(lan, b.id, { face: true, cccd: true, child: true }, undefined, atGate);
    await R.sweep(new Date(atGate.getTime() + 25 * 3600_000));
    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id: b.id } });
    expect(r.status).toBe("HOAN_TAT");
    expect(r.autoClosed).toBe(true);
  });
});

describe("kiểm quyền", () => {
  it("giáo viên lớp khác không duyệt / không giao được", async () => {
    const { id } = await trustedRequest();
    await R.delegateRespond(await uid(phoneOf.baNgoai), id, true);
    const mai = await uid(phoneOf.coMai);
    await expect(R.teacherDecide(mai, id, true)).rejects.toThrow(/không phụ trách/);

    await R.teacherDecide(await uid(phoneOf.coLan), id, true);
    const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
    const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
    await expect(R.gateByToken(mai, codes.token, atGate)).rejects.toThrow(/không phụ trách/);
    await expect(R.gateByPin(mai, id, codes.pin, atGate)).rejects.toThrow(/không phụ trách/);
  });

  it("phụ huynh của bé khác không huỷ được; người lạ không trả lời thay người đón", async () => {
    const { id } = await trustedRequest();
    await expect(R.cancelRequest(await uid(phoneOf.meBinh), id)).rejects.toThrow(/giám hộ/);
    await expect(R.delegateRespond(await uid(phoneOf.coLan), id, true)).rejects.toThrow(/không gửi cho bạn/);
  });

  it("mẹ (người giám hộ thứ hai) huỷ được yêu cầu do bố tạo", async () => {
    const { id } = await trustedRequest();
    await R.cancelRequest(await uid(phoneOf.me), id);
    expect(await status(id)).toBe("DA_HUY");
  });

  it("ảnh người tin cậy: phụ huynh + GV lớp xem được, GV lớp khác và phụ huynh bé khác thì không", async () => {
    const ba = await db.trustedPerson.findFirstOrThrow({ where: { status: "DA_DUYET" } });
    expect(await canViewPhoto(await uid(phoneOf.bo), ba.photoId)).toBe(true);
    expect(await canViewPhoto(await uid(phoneOf.coLan), ba.photoId)).toBe(true);
    expect(await canViewPhoto(await uid(phoneOf.coMai), ba.photoId)).toBe(false);
    expect(await canViewPhoto(await uid(phoneOf.meBinh), ba.photoId)).toBe(false);
  });

  it("người tin cậy chưa được GV duyệt thì chưa nhờ đón được; thêm người cấm thì gỡ khỏi danh sách tin cậy", async () => {
    const bo = await uid(phoneOf.bo);
    const an = await beAn();
    const chu = await db.trustedPerson.findFirstOrThrow({ where: { studentId: an.id, status: "CHO_DUYET" } });
    await expect(R.createRequest(bo, { studentId: an.id, date, mode: "trusted", trustedPersonId: chu.id })).rejects.toThrow(/chưa được giáo viên duyệt/);
    await T.reviewTrusted(await uid(phoneOf.coLan), chu.id, true);
    await T.addBlocked(await uid(phoneOf.me), { studentId: an.id, name: chu.name, phone: chu.phone, note: "thử" });
    expect((await db.trustedPerson.findUniqueOrThrow({ where: { id: chu.id } })).status).toBe("DA_XOA");
  });
});

describe("đăng nhập OTP", () => {
  it("đúng mã thì vào; sai mã bị đếm; xin quá 3 lần/10 phút bị chặn", async () => {
    await requestOtp(phoneOf.bo);
    const sms = await db.message.findFirstOrThrow({ where: { toPhone: phoneOf.bo }, orderBy: { createdAt: "desc" } });
    const code = /(\d{6})/.exec(sms.body)![1];
    await expect(verifyOtp(phoneOf.bo, code === "000000" ? "111111" : "000000")).rejects.toThrow(/Còn 4 lần/);
    expect(await verifyOtp(phoneOf.bo, code)).toBe(await uid(phoneOf.bo));
    await expect(verifyOtp(phoneOf.bo, code)).rejects.toThrow(/hết hạn/); // dùng một lần
    await requestOtp(phoneOf.bo);
    await requestOtp(phoneOf.bo);
    await expect(requestOtp(phoneOf.bo)).rejects.toThrow(/quá nhiều lần/);
  });

  it("số lạ: trả lời như bình thường nhưng không gửi tin, không đăng nhập được", async () => {
    await expect(requestOtp("0987654321")).resolves.toEqual({ phone: "0987654321" });
    expect(await db.message.count({ where: { toPhone: "0987654321" } })).toBe(0);
  });
});
