// Đăng nhập bằng SĐT + mã OTP 6 số. Chỉ số đã có trong hệ thống (nhà trường thêm, hoặc được phụ huynh nhờ đón) mới nhận mã.
import { hashCode, newOtp, sameHash } from "@/domain/codes";
import { normalizePhone } from "@/domain/phone";
import { AppError, appSecret, db } from "./db";

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PER_10_MIN = 3;

/** Luôn trả cùng một câu, dù số có trong hệ thống hay không — không để lộ ai đang dùng app. */
export async function requestOtp(rawPhone: string, now = new Date()): Promise<{ phone: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new AppError("Số điện thoại chưa đúng. Nhập 10 số, ví dụ 0901 234 567.");
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: new Date(now.getTime() - 10 * 60_000) } } });
  if (recent >= OTP_PER_10_MIN) throw new AppError("Bạn đã xin mã quá nhiều lần. Đợi 10 phút rồi thử lại.");

  const user = await db.user.findUnique({ where: { phone } });
  const code = newOtp();
  await db.$transaction(async (tx) => {
    await tx.otpCode.create({ data: { phone, codeHash: hashCode(appSecret(), "otp", code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) } });
    if (user) {
      await tx.message.create({ data: { toPhone: phone, toUserId: user.id, channel: "SMS", body: `Ma dang nhap Don Ho: ${code}. Het han sau 5 phut. Khong dua ma nay cho bat ky ai.` } });
    }
  });
  return { phone };
}

export async function verifyOtp(rawPhone: string, code: string, now = new Date()): Promise<string> {
  const phone = normalizePhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) throw new AppError("Mã gồm 6 chữ số.");
  const otp = await db.otpCode.findFirst({ where: { phone, usedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } });
  if (!otp) throw new AppError("Mã đã hết hạn hoặc chưa được gửi. Bấm \"Gửi lại mã\".");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new AppError("Nhập sai quá nhiều lần. Bấm \"Gửi lại mã\" để lấy mã mới.");

  if (!sameHash(otp.codeHash, hashCode(appSecret(), "otp", code))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AppError(`Mã chưa đúng. Còn ${OTP_MAX_ATTEMPTS - otp.attempts - 1} lần thử.`);
  }
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw new AppError("Số này chưa có trong hệ thống. Nhờ nhà trường thêm số của bạn.");
  await db.otpCode.update({ where: { id: otp.id }, data: { usedAt: now } });
  await db.auditLog.create({ data: { actorId: user.id, action: "DANG_NHAP", target: phone } });
  return user.id;
}
