// Đăng ký theo khu vực thực tế: tỉnh → phường/xã → trường; cô gọi xác minh rồi mới gắn phụ huynh với bé.
import { beforeEach, describe, expect, it } from "vitest";
import * as A from "@/server/area";
import { verifyOtp } from "@/server/auth";
import { db } from "@/server/db";
import { parentHome } from "@/server/queries";
import * as R from "@/server/requests";
import { phoneOf, resetDb, uid } from "./helpers";

beforeEach(resetDb);

const NEW = "0912345678";
const lastCode = async (phone: string) => /(\d{6})/.exec((await db.message.findFirstOrThrow({ where: { toPhone: phone }, orderBy: { createdAt: "desc" } })).body)![1];

async function place() {
  const cto = await db.province.findUniqueOrThrow({ where: { code: "CTO" } });
  const ninhKieu = await db.ward.findFirstOrThrow({ where: { provinceId: cto.id, name: "Phường Ninh Kiều" } });
  const school = await db.school.findFirstOrThrow({ where: { wardId: ninhKieu.id } });
  const la1 = await db.class.findFirstOrThrow({ where: { schoolId: school.id, name: "Lớp Lá 1" } });
  return { cto, ninhKieu, school, la1 };
}

describe("đăng ký theo khu vực", () => {
  it("form sai thì không gửi mã; đúng thì tạo tài khoản với khu vực + yêu cầu cô xác nhận bé", async () => {
    const { cto, ninhKieu, school, la1 } = await place();
    const base = { name: "Nguyễn Thị Mai", phone: NEW, provinceId: String(cto.id), wardId: String(ninhKieu.id), schoolId: school.id };
    await expect(A.startSignup({ ...base, name: "Mai" })).rejects.toThrow(/họ và tên/);
    await expect(A.startSignup({ ...base, provinceId: "" })).rejects.toThrow(/tỉnh/);
    await expect(A.startSignup({ ...base, classId: la1.id, studentName: "Khang" })).rejects.toThrow(/họ và tên của bé/);
    expect(await db.message.count({ where: { toPhone: NEW } })).toBe(0);

    const child = { classId: la1.id, studentName: "Lê Minh An", relation: "Bà" };
    await A.startSignup({ ...base, ...child });
    // số chưa có tài khoản vẫn nhận mã khi đăng ký (xác minh chủ số)
    const code = await lastCode(NEW);
    await expect(A.finishSignup({ ...base, ...child, code: "000000" === code ? "111111" : "000000" })).rejects.toThrow(/Còn 4 lần/);
    const id = await A.finishSignup({ ...base, ...child, code });
    const u = await db.user.findUniqueOrThrow({ where: { id }, include: { claims: true, guardianOf: true } });
    expect(u).toMatchObject({ name: "Nguyễn Thị Mai", provinceId: cto.id, wardId: ninhKieu.id, schoolId: school.id });
    expect(u.guardianOf).toHaveLength(0); // chưa là phụ huynh của bé nào tới khi cô xác nhận
    expect(u.claims[0]).toMatchObject({ classId: la1.id, studentName: "Lê Minh An", relation: "Bà", status: "CHO_DUYET" });
    // cô Lá 1 được báo
    expect(await db.message.count({ where: { toUserId: await uid(phoneOf.coLan), link: "/giao-vien/phu-huynh-moi" } })).toBe(1);
    const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
    await expect(R.createRequest(id, { studentId: an.id, date: "2030-01-02", mode: "adhoc", name: "Lê Văn Tư", phone: "0909111222", relation: "Chú", reason: "Bận" }))
      .rejects.toThrow(/không phải người giám hộ/);
  });

  it("phường/xã gõ tay lưu chưa xác minh, không hiện cho người khác chọn; trường chưa có thì ghi đề xuất", async () => {
    const { cto, school } = await place();
    const input = { name: "Trần Văn Hậu", phone: NEW, provinceId: String(cto.id), wardId: "khac", wardName: "phường Long Tuyền", schoolName: "Trường Mầm non Hoa Mai" };
    await expect(A.startSignup({ ...input, wardName: "Long Tuyền" })).rejects.toThrow(/Phường/);
    await expect(A.startSignup({ ...input, schoolId: school.id, schoolName: "" })).rejects.toThrow(/chưa có trường/);
    await A.startSignup(input);
    const id = await A.finishSignup({ ...input, code: await lastCode(NEW) });
    const u = await db.user.findUniqueOrThrow({ where: { id }, include: { ward: true } });
    expect(u.ward).toMatchObject({ name: "Phường Long Tuyền", verified: false });
    expect(u).toMatchObject({ schoolId: null, pendingSchool: "Trường Mầm non Hoa Mai" });
    expect((await A.wardsOf(cto.id)).some((w) => w.id === u.wardId)).toBe(false);
    // trường không thuộc phường/xã đã chọn
    const other = await db.school.findFirstOrThrow({ where: { NOT: { id: school.id } } });
    await expect(A.updateArea(id, { provinceId: cto.id, wardId: String(school.wardId), schoolId: other.id })).rejects.toThrow(/không thuộc phường/);
    await A.updateArea(id, { provinceId: cto.id, wardId: String(school.wardId), schoolId: school.id });
    expect(await db.user.findUniqueOrThrow({ where: { id } })).toMatchObject({ wardId: school.wardId, schoolId: school.id, pendingSchool: null });
  });

  it("số đã có tài khoản đi đường đăng ký: chỉ đăng nhập, không đổi tên, không lộ là số cũ", async () => {
    const { cto, ninhKieu, school } = await place();
    const bo = await uid(phoneOf.bo);
    const input = { name: "Kẻ Mạo Danh", phone: phoneOf.bo, provinceId: String(cto.id), wardId: String(ninhKieu.id), schoolId: school.id };
    await expect(A.startSignup(input)).resolves.toEqual({ phone: phoneOf.bo });
    expect(await A.finishSignup({ ...input, code: await lastCode(phoneOf.bo) })).toBe(bo);
    expect((await db.user.findUniqueOrThrow({ where: { id: bo } })).name).toBe("Anh Lê Minh Tuấn");
    // đăng nhập thường với số chưa có tài khoản: không nhận mã → không vào được
    await expect(verifyOtp("0933333333", "123456")).rejects.toThrow(/hết hạn/);
  });
});

describe("cô xác nhận phụ huynh mới", () => {
  async function signup(child: { studentName: string; relation: string }) {
    const { cto, ninhKieu, school, la1 } = await place();
    const input = { name: "Nguyễn Thị Mai", phone: NEW, provinceId: String(cto.id), wardId: String(ninhKieu.id), schoolId: school.id, classId: la1.id, ...child };
    await A.startSignup(input);
    const id = await A.finishSignup({ ...input, code: await lastCode(NEW) });
    return { id, claim: await db.guardianClaim.findFirstOrThrow({ where: { userId: id } }), la1 };
  }

  it("phải là cô lớp đó, phải gọi xác minh; xác nhận bé có sẵn → thành phụ huynh, thấy trang của con", async () => {
    const { id, claim } = await signup({ studentName: "le minh an", relation: "Bà" });
    const lan = await uid(phoneOf.coLan);
    const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
    await expect(A.reviewClaim(await uid(phoneOf.coMai), claim.id, { approve: true, studentId: an.id, calledParent: true })).rejects.toThrow(/không phụ trách/);
    await expect(A.reviewClaim(lan, claim.id, { approve: true, studentId: an.id })).rejects.toThrow(/Gọi điện/);
    const binh = await db.student.findFirstOrThrow({ where: { name: "Võ Gia Bình" } });
    await expect(A.reviewClaim(lan, claim.id, { approve: true, studentId: binh.id, calledParent: true })).rejects.toThrow(/không thuộc lớp/);
    await A.reviewClaim(lan, claim.id, { approve: true, studentId: an.id, calledParent: true });
    expect(await db.guardian.findUnique({ where: { userId_studentId: { userId: id, studentId: an.id } } })).toMatchObject({ relation: "Bà" });
    await expect(A.reviewClaim(lan, claim.id, { approve: true, studentId: an.id, calledParent: true })).rejects.toThrow(/đã được xử lý/);
    expect((await parentHome(id)).students.map((s) => s.id)).toEqual([an.id]);
    expect(await db.message.count({ where: { toUserId: id, link: "/phu-huynh" } })).toBe(1);
  });

  it("bé chưa có trong lớp → cô thêm bé mới; từ chối phải có lý do; gửi trùng bị chặn", async () => {
    const { id, claim, la1 } = await signup({ studentName: "Nguyễn Minh Khang", relation: "Mẹ" });
    const lan = await uid(phoneOf.coLan);
    await expect(A.addClaim(id, { classId: la1.id, studentName: "Nguyễn Minh Khang", relation: "Mẹ" })).rejects.toThrow(/rồi/);
    await A.reviewClaim(lan, claim.id, { approve: true, studentId: "moi", calledParent: true });
    const khang = await db.student.findFirstOrThrow({ where: { name: "Nguyễn Minh Khang" } });
    expect(khang.classId).toBe(la1.id);

    const second = await A.addClaim(id, { classId: la1.id, studentName: "Nguyễn Minh Khôi", relation: "Mẹ" });
    await expect(A.reviewClaim(lan, second!, { approve: false, note: "" })).rejects.toThrow(/lý do/);
    await A.reviewClaim(lan, second!, { approve: false, note: "Lớp không có bé này" });
    expect(await db.guardianClaim.findUniqueOrThrow({ where: { id: second! } })).toMatchObject({ status: "TU_CHOI", note: "Lớp không có bé này" });
    expect(await db.guardian.count({ where: { userId: id } })).toBe(1);
  });
});
