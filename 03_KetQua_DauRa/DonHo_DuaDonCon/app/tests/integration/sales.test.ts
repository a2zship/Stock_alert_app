// Hệ thống tự bán: trường tự mở, ban giám hiệu thêm lớp/cô, bộ khởi động lớp, phễu cho quản trị, nhắc việc tự động, chốt xác minh.
import { beforeEach, describe, expect, it } from "vitest";
import { payableFrom, vnMonth } from "@/domain/share";
import { db } from "@/server/db";
import * as E from "@/server/earn";
import * as M from "@/server/membership";
import * as SL from "@/server/sales";
import * as S from "@/server/share";
import { phoneOf, resetDb, uid } from "./helpers";
import { helperForm } from "./paid";

beforeEach(resetDb);

const ADMIN = "0908000000";
const HIEU_TRUONG = "0901000030";
const DAY = 86_400_000;
const later = (days: number) => new Date(Date.now() + days * DAY);
const payDay = () => new Date(`${payableFrom(vnMonth(new Date()))}T12:00:00+07:00`);
const lastOtp = async (phone: string) =>
  /(\d{6})/.exec((await db.message.findFirstOrThrow({ where: { toPhone: phone, body: { startsWith: "Ma dang nhap" } }, orderBy: { createdAt: "desc" } })).body)![1];

async function area(wardName = "Phường Tân An") {
  const cto = await db.province.findUniqueOrThrow({ where: { code: "CTO" } });
  const ward = await db.ward.findFirstOrThrow({ where: { provinceId: cto.id, name: wardName } });
  return { cto, ward, input: { provinceId: String(cto.id), wardId: String(ward.id) } };
}

/** Chủ trường mở "Trường Mầm non Hướng Dương" ở Phường Tân An qua hai bước có mã. */
async function openHuongDuong(phone = "0912000111", now = new Date()) {
  const { input } = await area();
  const form = { ...input, name: "Trần Thị Thu", phone, schoolName: "Trường Mầm non Hướng Dương", address: "12 Trần Hưng Đạo" };
  await SL.startOpenSchool(form, now);
  return SL.finishOpenSchool({ ...form, code: await lastOtp(phone) }, now);
}

describe("nhà trường tự mở trường", () => {
  it("mở bằng mã xác minh: trường chưa xác minh, người mở là ban giám hiệu, phụ huynh đã đề xuất được gắn trường, quản trị được báo", async () => {
    const { cto, ward } = await area();
    const waiting = await Promise.all(["0912000201", "0912000202"].map((phone, i) =>
      db.user.create({ data: { phone, name: `Phụ huynh ${i}`, provinceId: cto.id, wardId: ward.id, pendingSchool: i ? "MN Hướng Dương" : "trường mầm non hướng dương" } })));
    const other = await db.user.create({ data: { phone: "0912000203", name: "Phụ huynh khác", provinceId: cto.id, wardId: ward.id, pendingSchool: "Trường Tiểu học Lê Lợi" } });

    const { userId, schoolId } = await openHuongDuong();
    const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect(school).toMatchObject({ verified: false, wardId: ward.id, createdById: userId, address: "12 Trần Hưng Đạo" });
    expect(await db.schoolAdmin.count({ where: { userId, schoolId } })).toBe(1);
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ schoolId, wardId: ward.id });
    for (const u of waiting) {
      expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ schoolId, pendingSchool: null });
      expect(await db.message.count({ where: { toUserId: u.id, link: "/khu-vuc" } })).toBe(1);
    }
    expect(await db.user.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ schoolId: null, pendingSchool: "Trường Tiểu học Lê Lợi" });
    expect(await db.message.count({ where: { toUserId: await uid(ADMIN), link: "/quan-tri/truong" } })).toBe(1);
  });

  it("không mở trùng trường trong cùng phường/xã (so tên đã bỏ dấu, MN = mầm non); thiếu tên trường thì báo", async () => {
    await openHuongDuong();
    const { input } = await area();
    await expect(SL.startOpenSchool({ ...input, name: "Lê Văn Hải", phone: "0912000112", schoolName: "MN HUONG DUONG" })).rejects.toThrow(/đã có trên Đón Hộ/);
    const nk = await area("Phường Ninh Kiều");
    await expect(SL.startOpenSchool({ ...nk.input, name: "Lê Văn Hải", phone: "0912000112", schoolName: "MN Hoa Sen (thử nghiệm)" })).rejects.toThrow(/Hoa Sen.*đã có/);
    await expect(SL.startOpenSchool({ ...input, name: "Lê Văn Hải", phone: "0912000112", schoolName: "" })).rejects.toThrow(/Ghi tên trường/);
    // cùng tên ở phường khác thì được
    await expect(SL.startOpenSchool({ ...nk.input, name: "Lê Văn Hải", phone: "0912000112", schoolName: "Trường Mầm non Hướng Dương" })).resolves.toMatchObject({ phone: "0912000112" });
  });

  it("ban giám hiệu thêm lớp và cô; cô mới đăng nhập được bằng số đó; người ngoài không làm được", async () => {
    const { userId, schoolId } = await openHuongDuong();
    await expect(SL.addClass(userId, schoolId, { name: "Lá 1", pickupStart: "17:30", pickupEnd: "16:30" })).rejects.toThrow(/sau giờ bắt đầu/);
    const classId = await SL.addClass(userId, schoolId, { name: "Lá 1", pickupStart: "16:30", pickupEnd: "17:30" });
    await expect(SL.addClass(userId, schoolId, { name: "lá 1", pickupStart: "16:30", pickupEnd: "17:30" })).rejects.toThrow(/đã có lớp/);
    await expect(SL.addClass(await uid(phoneOf.coLan), schoolId, { name: "Chồi 1", pickupStart: "16:30", pickupEnd: "17:30" })).rejects.toThrow(/ban giám hiệu/);

    await SL.addTeacher(userId, classId, { name: "Phạm Thị Hồng", phone: "0912 000 300" });
    const hong = await db.user.findUniqueOrThrow({ where: { phone: "0912000300" } });
    expect(hong).toMatchObject({ name: "Phạm Thị Hồng", schoolId });
    expect(await db.teacherAssignment.count({ where: { userId: hong.id, classId } })).toBe(1);
    expect((await db.message.findFirstOrThrow({ where: { toUserId: hong.id } })).body).toMatch(/moi ban phu trach lop La 1.*\/dang-nhap/);
    await expect(SL.addTeacher(userId, classId, { name: "Phạm Thị Hồng", phone: "0912000300" })).rejects.toThrow(/đã phụ trách/);
    // cô giáo có sẵn tài khoản (cô Lan) thì dùng lại, không đổi tên
    await SL.addTeacher(userId, classId, { name: "Tên Khác Hẳn", phone: phoneOf.coLan });
    expect((await db.user.findUniqueOrThrow({ where: { phone: phoneOf.coLan } })).name).not.toBe("Tên Khác Hẳn");

    // bộ khởi động: cô và ban giám hiệu xem được, phụ huynh khác thì không
    const kit = await SL.classKit(hong.id, classId);
    expect(kit.url).toMatch(new RegExp(`/dang-ky\\?lop=${classId}$`));
    expect(kit.msgParents).toContain(kit.url);
    expect(kit.stage).toBe("CO_CO_GIAO");
    await expect(SL.classKit(await uid(phoneOf.bo), classId)).rejects.toThrow(/Chỉ cô phụ trách/);
    expect(await SL.classDefaults(classId)).toMatchObject({ schoolId, classId });

    await SL.removeTeacher(userId, classId, hong.id);
    expect(await db.teacherAssignment.count({ where: { userId: hong.id } })).toBe(0);
  });
});

describe("phễu và nhắc việc tự động", () => {
  it("quản trị thấy bước của từng trường và nhu cầu đề xuất; người khác không xem được", async () => {
    const { schoolId } = await openHuongDuong();
    await expect(SL.funnel(await uid(phoneOf.bo))).rejects.toThrow(/quản trị/);
    const f = await SL.funnel(await uid(ADMIN));
    expect(f.rows.find((r) => r.id === schoolId)).toMatchObject({ stage: "MOI_DANG_KY", verified: false });
    const hoaSen = f.rows.find((r) => r.name.includes("Hoa Sen"))!;
    expect(hoaSen.counts.teachers).toBe(2);
    expect(hoaSen.counts.parents).toBeGreaterThan(0);
  });

  it("trường mở ≥ 2 ngày chưa có cô → nhắc ban giám hiệu; không nhắc trùng trong 7 ngày; tối đa 3 lần", async () => {
    const { userId, schoolId } = await openHuongDuong();
    const nudges = () => db.message.count({ where: { toUserId: userId, link: "/truong" } });
    await SL.runNudges(later(1));
    expect(await nudges()).toBe(0); // chưa đủ 2 ngày
    await SL.runNudges(later(3));
    await SL.runNudges(later(4));
    expect(await nudges()).toBe(1);
    await SL.runNudges(later(11));
    await SL.runNudges(later(19));
    await SL.runNudges(later(40));
    expect(await nudges()).toBe(3);

    // có lớp + cô → chuyển sang nhắc cô mời phụ huynh, kèm đường dẫn bộ khởi động của lớp
    const classId = await SL.addClass(userId, schoolId, { name: "Lá 1", pickupStart: "16:30", pickupEnd: "17:30" });
    await SL.addTeacher(userId, classId, { name: "Phạm Thị Hồng", phone: "0912000300" });
    await SL.runNudges(later(41));
    expect(await db.message.count({ where: { toUserId: await uid("0912000300"), link: `/truong/lop/${classId}` } })).toBe(1);
  });

  it("đủ 3 phụ huynh cùng đề xuất một trường chưa có → nhắc từng người gửi đường dẫn mời trường; mở trường xong thì hết", async () => {
    const { cto, ward } = await area();
    const users = await Promise.all([0, 1, 2].map((i) =>
      db.user.create({ data: { phone: `091200040${i}`, name: `Phụ huynh ${i}`, provinceId: cto.id, wardId: ward.id, pendingSchool: ["Trường Tiểu học Lê Lợi", "TH Lê Lợi", "tiểu học lê lợi"][i] } })));
    const mine = await SL.myDemand(users[0].id);
    expect(mine).toMatchObject({ count: 3 });
    expect(mine!.url).toContain(`/mo-truong?phuong=${ward.id}&ten=`);
    expect(mine!.msg).toContain("3 phụ huynh");

    await SL.runNudges();
    await SL.runNudges();
    for (const u of users) {
      const m = await db.message.findMany({ where: { toUserId: u.id, link: "/khu-vuc" } });
      expect(m).toHaveLength(1);
      expect(m[0].body).toMatch(/3 phụ huynh.*\/mo-truong\?phuong=/);
    }
    // hai người chưa đủ ngưỡng thì không nhắc
    await db.user.create({ data: { phone: "0912000410", name: "Phụ huynh lẻ", provinceId: cto.id, wardId: ward.id, pendingSchool: "Trường Mầm non Sao Mai" } });
    await SL.runNudges(later(8));
    expect(await db.message.count({ where: { toPhone: "0912000410" } })).toBe(0);
  });
});

describe("trường chưa xác minh", () => {
  it("chưa mở đón có phí và chưa chuyển chia sẻ; quản trị gọi xác minh xong thì mở", async () => {
    const school = await db.school.findFirstOrThrow({ where: { name: { contains: "Hoa Sen" } } });
    await M.buyMembership(await uid(phoneOf.bao), "BAC", 1); // phát sinh phần chia của trường trước
    await db.school.update({ where: { id: school.id }, data: { verified: false } });
    const nga = await uid(phoneOf.meBinh);
    await expect(E.registerHelper(nga, helperForm)).rejects.toThrow(/chưa được Đón Hộ xác minh/);

    const admin = await uid(ADMIN);
    await S.saveSchoolPay(await uid(HIEU_TRUONG), school.id, { bankBin: "970436", bankAccount: "9999888877", accountName: "Truong Mam non Hoa Sen" });
    const g = (await S.payoutQueue(admin, payDay())).find((x) => x.kind === "TRUONG")!;
    await expect(S.markPayout(admin, g.key, payDay())).rejects.toThrow(/chưa được xác minh/);

    await expect(SL.verifySchool(nga, school.id)).rejects.toThrow(/quản trị/);
    await SL.verifySchool(admin, school.id);
    await expect(SL.verifySchool(admin, school.id)).rejects.toThrow(/đã được xác minh/);
    expect(await db.message.count({ where: { toUserId: await uid(HIEU_TRUONG), link: "/truong" } })).toBe(1);
    await S.markPayout(admin, g.key, payDay());
    await E.registerHelper(nga, helperForm);
  });
});
