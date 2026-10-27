// Dữ liệu mẫu: 34 tỉnh/thành + vài phường mẫu ở Cần Thơ + 1 trường mầm non THỬ NGHIỆM (tên giả, người giả).
//   npx tsx prisma/seed.ts --if-empty   → chỉ nạp khi DB trống
import { PrismaClient } from "@prisma/client";
import { addDays, vnDateTime, vnToday } from "../src/domain/time";
import { avatarPng } from "./avatar";
import { PROVINCES } from "./provinces";

const db = new PrismaClient();

export async function seed(prisma = db) {
  for (const p of PROVINCES) await prisma.province.upsert({ where: { code: p.code }, update: p, create: p });
  const cto = await prisma.province.findUniqueOrThrow({ where: { code: "CTO" } });
  // Phường mẫu — danh sách đầy đủ ~3.300 xã/phường nhập từ dữ liệu chính thức sau
  const wards = ["Phường Ninh Kiều", "Phường Cái Khế", "Phường Tân An", "Phường An Bình", "Phường Bình Thủy", "Phường Cái Răng"];
  for (const name of wards) await prisma.ward.upsert({ where: { provinceId_name: { provinceId: cto.id, name } }, update: {}, create: { provinceId: cto.id, name } });
  const ward = await prisma.ward.findFirstOrThrow({ where: { provinceId: cto.id, name: "Phường Ninh Kiều" } });

  const school = await prisma.school.create({ data: {
    name: "Trường Mầm non Hoa Sen (thử nghiệm)", wardId: ward.id,
    address: "Phường Ninh Kiều, TP Cần Thơ (địa chỉ và toạ độ mẫu)", lat: 10.0341, lng: 105.7852,
  } });
  // trường thứ hai (phường khác) để thử chọn khu vực khi đăng ký
  const caiKhe = await prisma.ward.findFirstOrThrow({ where: { provinceId: cto.id, name: "Phường Cái Khế" } });
  const school2 = await prisma.school.create({ data: { name: "Trường Mầm non Sen Hồng (thử nghiệm)", wardId: caiKhe.id, address: "Phường Cái Khế, TP Cần Thơ (địa chỉ mẫu)" } });
  await prisma.class.create({ data: { schoolId: school2.id, name: "Lớp Mầm 1", pickupStart: "16:30", pickupEnd: "17:30" } });

  const la1 = await prisma.class.create({ data: { schoolId: school.id, name: "Lớp Lá 1", pickupStart: "16:30", pickupEnd: "17:30" } });
  const choi2 = await prisma.class.create({ data: { schoolId: school.id, name: "Lớp Chồi 2", pickupStart: "16:15", pickupEnd: "17:15" } });

  // khu vực thực tế của người dùng mẫu: cùng phường với trường
  const area = { provinceId: cto.id, wardId: ward.id, schoolId: school.id };
  const user = (phone: string, name: string) => prisma.user.create({ data: { phone, name, ...area } });
  const coLan = await user("0901000010", "Cô Nguyễn Thị Lan");
  const coMai = await user("0901000011", "Cô Trần Thị Mai");
  const anhTuan = await user("0901000001", "Anh Lê Minh Tuấn");
  const chiHoa = await user("0901000002", "Chị Phạm Thu Hoa");
  const chiNga = await user("0901000003", "Chị Võ Thanh Nga");
  const anhBao = await user("0901000004", "Anh Trần Quốc Bảo");
  const baNgoai = await user("0901000020", "Bà Phạm Thị Sáu");
  const hieuTruong = await user("0901000030", "Cô Đặng Thu Hà (Hiệu trưởng)");
  // quản trị nền tảng Đón Hộ (số nằm trong ADMIN_PHONES) — chuyển phần chia sẻ cho trường/cô
  await user("0908000000", "Quản trị Đón Hộ");

  await prisma.teacherAssignment.createMany({ data: [{ userId: coLan.id, classId: la1.id }, { userId: coMai.id, classId: choi2.id }] });
  await prisma.schoolAdmin.create({ data: { userId: hieuTruong.id, schoolId: school.id } });

  const beAn = await prisma.student.create({ data: { classId: la1.id, name: "Lê Minh An" } });
  const beBinh = await prisma.student.create({ data: { classId: choi2.id, name: "Võ Gia Bình" } });
  const beNgoc = await prisma.student.create({ data: { classId: la1.id, name: "Trần Bảo Ngọc" } });
  await prisma.guardian.createMany({ data: [
    { userId: anhTuan.id, studentId: beAn.id, relation: "Bố" },
    { userId: chiHoa.id, studentId: beAn.id, relation: "Mẹ" },
    { userId: chiNga.id, studentId: beBinh.id, relation: "Mẹ" },
    { userId: anhBao.id, studentId: beNgoc.id, relation: "Bố" },
  ] });

  const photo = (rgb: [number, number, number], ownerId: string) =>
    prisma.photo.create({ data: { kind: "CHAN_DUNG", mime: "image/png", bytes: new Uint8Array(avatarPng(rgb)), ownerId } });
  await prisma.trustedPerson.create({ data: {
    studentId: beAn.id, addedById: chiHoa.id, name: baNgoai.name, phone: baNgoai.phone, relation: "Bà ngoại", cccdLast4: "4821",
    photoId: (await photo([120, 86, 160], chiHoa.id)).id, status: "DA_DUYET", reviewedById: coLan.id, reviewedAt: new Date(),
  } });
  await prisma.trustedPerson.create({ data: {
    studentId: beAn.id, addedById: anhTuan.id, name: "Anh Lê Văn Hùng", phone: "0901000021", relation: "Chú ruột", cccdLast4: "0937",
    photoId: (await photo([37, 99, 140], anhTuan.id)).id,
  } });
  await prisma.blockedPerson.create({ data: { studentId: beAn.id, addedById: chiHoa.id, name: "Người lạ (mẫu)", phone: "0901000099", note: "Dữ liệu mẫu để thử chức năng chặn" } });
}

/** Dữ liệu minh hoạ cho bản chạy thử (KHÔNG dùng trong test): vài lần đón hộ đã xong + tin nhắn nhóm lớp Lá 1. */
export async function seedDemo(prisma = db, now = new Date()) {
  const by = (phone: string) => prisma.user.findUniqueOrThrow({ where: { phone } });
  const [coLan, chiHoa, anhBao] = await Promise.all([by("0901000010"), by("0901000002"), by("0901000004")]);
  const beAn = await prisma.student.findFirstOrThrow({ where: { name: "Lê Minh An" }, include: { class: true } });
  const beNgoc = await prisma.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
  const today = vnToday(now);
  const baoPhoto = await prisma.photo.create({ data: { kind: "CHAN_DUNG", mime: "image/png", bytes: new Uint8Array(avatarPng([30, 110, 90])), ownerId: anhBao.id } });

  const thanks = ["Cảm ơn anh Bảo nhiều, bé về vui lắm!", "Nhờ anh mà em kịp họp, cảm ơn anh.", "Bé kể chú Bảo chở về an toàn, cảm ơn anh!"];
  for (const [i, ago] of [12, 8, 3].entries()) {
    const day = addDays(today, -ago);
    const start = vnDateTime(day, beAn.class.pickupStart);
    const end = vnDateTime(day, beAn.class.pickupEnd);
    const at = (min: number) => new Date(start.getTime() + min * 60_000);
    const r = await prisma.pickupRequest.create({ data: {
      studentId: beAn.id, requesterId: chiHoa.id, delegateId: anhBao.id, isAdhoc: true, delegateName: anhBao.name, delegatePhone: anhBao.phone,
      relation: "Phụ huynh cùng lớp", cccdLast4: "5512", delegatePhotoId: baoPhoto.id, reason: "Em kẹt họp", windowStart: start, windowEnd: end,
      status: "HOAN_TAT", teacherCalledParent: true, decidedById: coLan.id, decidedAt: at(-200), gateVerifiedById: coLan.id, gateVerifiedAt: at(10),
      handedOverById: coLan.id, handedOverAt: at(12), arrivedAt: at(8), closedAt: at(40), thanks: thanks[i], createdAt: at(-240),
    } });
    const ev = (action: string, actorId: string, actorRole: string, min: number, note = "") =>
      prisma.requestEvent.create({ data: { requestId: r.id, actorId, actorRole, action, at: at(min), note } });
    await ev("TAO", chiHoa.id, "PHU_HUYNH", -240, "Em kẹt họp");
    await ev("NGUOI_DON_NHAN", anhBao.id, "NGUOI_DON", -236);
    await ev("GV_DUYET", coLan.id, "GIAO_VIEN", -200);
    await ev("TOI_CONG", anhBao.id, "NGUOI_DON", 8);
    await ev("GIAO_TRE", coLan.id, "GIAO_VIEN", 12, "Đã đối chiếu: khuôn mặt, CCCD, bé nhận ra người đón");
    await ev("PH_XAC_NHAN_VE", chiHoa.id, "PHU_HUYNH", 40, thanks[i]);
  }

  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  await prisma.chatPost.create({ data: { classId: beAn.classId, authorId: coLan.id, kind: "TIN_NHAN", createdAt: minsAgo(600),
    body: "Chào các phụ huynh lớp Lá 1. Ai bận đột xuất có thể đăng lời nhờ đón ở đây. Người nhận đón vẫn phải được cô duyệt và kiểm mã tại cổng nhé." } });
  await prisma.chatPost.create({ data: { classId: beAn.classId, authorId: chiHoa.id, kind: "TIN_NHAN", createdAt: minsAgo(540),
    body: "Dạ cảm ơn cô. Mấy lần trước nhờ anh Bảo đón bé An rất yên tâm ạ." } });
  await prisma.chatPost.create({ data: { classId: beAn.classId, authorId: anhBao.id, kind: "NHO_DON", studentId: beNgoc.id, date: addDays(today, 1),
    createdAt: minsAgo(30), body: "Mai mình đi công tác Sóc Trăng, về không kịp. Phụ huynh nào tiện đường đón giúp bé Ngọc với ạ.",
    dropLabel: "Nhà", dropAddress: "48 Trần Văn Hoài, hẻm 2", dropWard: "Phường Ninh Kiều", dropLat: 10.0279, dropLng: 105.7725 } });

  // Điểm trả hay dùng (gắn tài khoản phụ huynh, không gắn hồ sơ trẻ) — địa chỉ mẫu, không có thật
  const bo = await by("0901000001");
  await prisma.savedPlace.createMany({ data: [
    { userId: bo.id, label: "Nhà", address: "12 Nguyễn Việt Hồng", ward: "Phường Ninh Kiều", lat: 10.0372, lng: 105.7768 },
    { userId: bo.id, label: "Nhà bà ngoại", address: "25 Mậu Thân, hẻm 3", ward: "Phường Tân An", lat: 10.0402, lng: 105.7731 },
    { userId: anhBao.id, label: "Nhà", address: "48 Trần Văn Hoài, hẻm 2", ward: "Phường Ninh Kiều", lat: 10.0279, lng: 105.7725 },
  ] });
}

async function main() {
  if (process.argv.includes("--if-empty") && (await db.school.count()) > 0) {
    console.log("DB đã có dữ liệu — bỏ qua seed.");
    return;
  }
  await seed();
  await seedDemo();
  console.log("Đã nạp dữ liệu mẫu: 34 tỉnh/thành, 1 trường thử nghiệm, 2 lớp, 8 người dùng, lịch sử đón hộ + nhóm lớp.");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().finally(() => db.$disconnect());
}
