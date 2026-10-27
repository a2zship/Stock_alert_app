"use server";
// Server action cho mọi form. Mỗi action: lấy người đăng nhập → gọi nghiệp vụ (đã tự kiểm quyền) → trả lỗi dễ hiểu hoặc chuyển trang.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOtp, verifyOtp } from "@/server/auth";
import { AppError, appSecret } from "@/server/db";
import { currentUser } from "@/server/queries";
import * as R from "@/server/requests";
import * as T from "@/server/trusted";
import * as C from "@/server/chat";
import * as G from "@/server/tracking";
import * as P from "@/server/places";
import * as E from "@/server/earn";
import * as M from "@/server/membership";
import * as TH from "@/server/monthly";
import * as A from "@/server/area";
import * as K from "@/server/asks";
import * as S from "@/server/share";
import { SESSION_COOKIE, sessionDays, signSession } from "@/lib/session";
import { TransitionError } from "@/domain/state";

export type FormState = { error?: string; ok?: string; step?: string; phone?: string } | null;

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
/** Các ô điểm trả bé (DropPicker). */
const dropOf = (fd: FormData) => ({ label: s(fd, "dropLabel"), address: s(fd, "dropAddress"), ward: s(fd, "dropWard"), lat: s(fd, "dropLat"), lng: s(fd, "dropLng") });

/** Lựa chọn của nút bấm phải khớp đúng một trong hai giá trị — thiếu hoặc lạ thì báo lỗi, không tự đoán là "từ chối". */
function decision(fd: FormData, yes: string, no: string): boolean {
  const d = s(fd, "decision");
  if (d === yes) return true;
  if (d === no) return false;
  throw new AppError("Không rõ bạn chọn nút nào. Tải lại trang rồi bấm lại.");
}

/** Bọc nghiệp vụ: lỗi nghiệp vụ → hiện cho người dùng; lỗi khác → câu chung (chi tiết chỉ ghi log máy chủ). */
async function run(fn: (userId: string) => Promise<FormState | void>): Promise<FormState> {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  try {
    return (await fn(me.id)) ?? null;
  } catch (e) {
    if (e instanceof AppError || e instanceof TransitionError) return { error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect() của Next
    console.error(e);
    return { error: "Có lỗi xảy ra. Thử lại sau ít phút." };
  }
}

// ── Đăng nhập ──

export async function sendOtpAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const { phone } = await requestOtp(s(fd, "phone"));
    return { step: "code", phone, ok: "Nếu số này có trong hệ thống, mã 6 số đã được gửi qua tin nhắn." };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, phone: s(fd, "phone") };
    console.error(e);
    return { error: "Không gửi được mã. Thử lại sau." };
  }
}

export async function verifyOtpAction(_: FormState, fd: FormData): Promise<FormState> {
  let userId: string;
  try {
    userId = await verifyOtp(s(fd, "phone"), s(fd, "code").replace(/\s/g, ""));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, step: "code", phone: s(fd, "phone") };
    console.error(e);
    return { error: "Không đăng nhập được. Thử lại sau.", step: "code", phone: s(fd, "phone") };
  }
  await startSession(userId);
  const next = s(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

async function startSession(userId: string) {
  const days = sessionDays();
  (await cookies()).set(SESSION_COOKIE, await signSession(appSecret(), userId, Date.now() + days * 86_400_000), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !!process.env.PUBLIC_URL?.startsWith("https"), path: "/", maxAge: days * 86_400,
  });
}

// ── Đăng ký: khu vực thực tế + xin xác nhận con ──

const AREA_KEYS = ["name", "phone", "provinceId", "wardId", "wardName", "schoolId", "schoolName", "classId", "studentName", "relation", "refCode"] as const;
const signupInput = (fd: FormData) => Object.fromEntries(AREA_KEYS.map((k) => [k, s(fd, k)])) as A.SignupInput;

export async function startSignupAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const { phone } = await A.startSignup(signupInput(fd));
    return { step: "code", phone, ok: `Đã gửi mã 6 số tới ${phone}.` };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, phone: s(fd, "phone") };
    console.error(e);
    return { error: "Không gửi được mã. Thử lại sau." };
  }
}

export async function finishSignupAction(_: FormState, fd: FormData): Promise<FormState> {
  let userId: string;
  try {
    userId = await A.finishSignup({ ...signupInput(fd), code: s(fd, "code") });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, step: "code", phone: s(fd, "phone") };
    console.error(e);
    return { error: "Không đăng ký được. Thử lại sau.", step: "code", phone: s(fd, "phone") };
  }
  await startSession(userId);
  redirect("/");
}

export async function updateAreaAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await A.updateArea(uid, signupInput(fd));
    revalidatePath("/", "layout");
    return { ok: "Đã lưu khu vực." };
  });
}

export async function addClaimAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    if (!(await A.addClaim(uid, signupInput(fd)))) return { error: "Chọn lớp và ghi họ tên bé." };
    revalidatePath("/khu-vuc");
    return { ok: "Đã gửi cô lớp xác nhận. Cô sẽ gọi điện cho bạn trước khi xác nhận." };
  });
}

export async function reviewClaimAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const approve = decision(fd, "approve", "reject");
    await A.reviewClaim(uid, s(fd, "id"), { approve, studentId: s(fd, "studentId"), calledParent: fd.get("calledParent") === "on", note: s(fd, "note") });
    revalidatePath("/giao-vien/phu-huynh-moi");
    return { ok: approve ? "Đã xác nhận phụ huynh." : "Đã từ chối và báo phụ huynh." };
  });
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/dang-nhap");
}

// ── Phụ huynh ──

export async function createRequestAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async (uid) => {
    id = await R.createRequest(uid, {
      studentId: s(fd, "studentId"), date: s(fd, "date"), mode: s(fd, "mode") === "adhoc" ? "adhoc" : "trusted",
      trustedPersonId: s(fd, "trustedPersonId"), name: s(fd, "name"), phone: s(fd, "phone"), relation: s(fd, "relation"), reason: s(fd, "reason"), drop: dropOf(fd),
    });
    if (s(fd, "savePlace")) await P.savePlace(uid, dropOf(fd));
  });
  if (res?.error) return res;
  redirect(`/yeu-cau/${id}?moi=1`);
}

export async function cancelRequestAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await R.cancelRequest(uid, s(fd, "id"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã huỷ. Người đón và giáo viên đã được báo, mã đón hết hiệu lực." };
  });
}

export async function confirmHomeAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await R.confirmHome(uid, s(fd, "id"), new Date(), s(fd, "thanks"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Cảm ơn bạn. Yêu cầu đã hoàn tất." };
  });
}

export async function addTrustedAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await T.addTrusted(uid, { studentId: s(fd, "studentId"), name: s(fd, "name"), phone: s(fd, "phone"), relation: s(fd, "relation"), cccdLast4: s(fd, "cccdLast4"), photo: s(fd, "photo") });
    revalidatePath("/nguoi-tin-cay");
    return { ok: "Đã gửi. Giáo viên sẽ duyệt người này trước khi được nhờ đón." };
  });
}

export async function removeTrustedAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await T.removeTrusted(uid, s(fd, "id"));
    revalidatePath("/nguoi-tin-cay");
    return { ok: "Đã xoá khỏi danh sách." };
  });
}

export async function addBlockedAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await T.addBlocked(uid, { studentId: s(fd, "studentId"), name: s(fd, "name"), phone: s(fd, "phone"), note: s(fd, "note") });
    revalidatePath("/nguoi-tin-cay");
    return { ok: "Đã thêm. Giáo viên đã được báo." };
  });
}

// ── Người đón ──

export async function delegateRespondAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const accept = decision(fd, "accept", "decline");
    await R.delegateRespond(uid, s(fd, "id"), accept, { cccdLast4: s(fd, "cccdLast4"), photo: s(fd, "photo") || undefined, note: s(fd, "note") });
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: accept ? "Đã nhận lời. Chờ giáo viên duyệt, bạn sẽ nhận tin nhắn khi có mã đón." : "Đã báo phụ huynh là bạn không đón được." };
  });
}

// ── Giáo viên ──

export async function teacherDecideAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const approve = decision(fd, "approve", "reject");
    await R.teacherDecide(uid, s(fd, "id"), approve, { calledParent: fd.get("calledParent") === "on", note: s(fd, "note") });
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: approve ? "Đã duyệt. Người đón đã nhận mã đón." : "Đã từ chối và báo phụ huynh." };
  });
}

export async function reviewTrustedAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const approve = decision(fd, "approve", "reject");
    await T.reviewTrusted(uid, s(fd, "id"), approve, s(fd, "note"));
    revalidatePath("/giao-vien/nguoi-tin-cay");
    return { ok: approve ? "Đã duyệt vào danh sách tin cậy." : "Đã từ chối." };
  });
}

export async function gateTokenAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async (uid) => { id = await R.gateByToken(uid, s(fd, "token")); });
  if (res?.error) return res;
  redirect(`/yeu-cau/${id}`);
}

export async function gatePinAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const res = await R.gateByPin(uid, s(fd, "id"), s(fd, "pin").replace(/\s/g, ""));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return res.ok ? { ok: "Mã đúng. Đối chiếu người đón bên dưới." } : { error: res.error };
  });
}

export async function handoverAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await R.handover(uid, s(fd, "id"), { face: fd.get("face") === "on", cccd: fd.get("cccd") === "on", child: fd.get("child") === "on" }, s(fd, "photo") || undefined);
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã giao trẻ. Phụ huynh đã nhận thông báo." };
  });
}

export async function failHandoverAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await R.failHandover(uid, s(fd, "id"), s(fd, "reason"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã ghi nhận không giao. Phụ huynh đã được báo." };
  });
}

// ── Theo dõi trên bản đồ ──

export async function arriveGateAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await G.arriveGate(uid, s(fd, "id"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã báo cô giáo là bạn tới cổng. Chuẩn bị mã đón và CCCD." };
  });
}

export async function arriveDropAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await G.arriveDrop(uid, s(fd, "id"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã báo phụ huynh là bé tới nơi. Chờ phụ huynh ra đón và xác nhận." };
  });
}

// ── Đón hộ có phí ──

export async function registerHelperAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await E.registerHelper(uid, {
      cccdLast4: s(fd, "cccdLast4"), photo: s(fd, "photo"), bankBin: s(fd, "bankBin"), bankAccount: s(fd, "bankAccount"),
      accountName: s(fd, "accountName"), agree: s(fd, "agree") === "1",
    });
    revalidatePath("/kiem-tien");
    return { ok: "Đã gửi đăng ký. Cô giáo lớp của con bạn sẽ duyệt." };
  });
}

export async function reviewHelperAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const d = s(fd, "decision");
    if (d !== "approve" && d !== "reject" && d !== "suspend") throw new AppError("Không rõ bạn chọn nút nào. Tải lại trang rồi bấm lại.");
    await E.reviewHelper(uid, s(fd, "id"), d, s(fd, "note"));
    revalidatePath("/giao-vien/nguoi-don-co-phi");
    return { ok: d === "approve" ? "Đã duyệt." : d === "reject" ? "Đã từ chối." : "Đã tạm dừng." };
  });
}

export async function markPaidAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await E.markPaid(uid, s(fd, "id"), { amount: s(fd, "amount"), thanks: s(fd, "thanks") });
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã báo người đón. Cảm ơn bạn!" };
  });
}

export async function markReceivedAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await E.markReceived(uid, s(fd, "id"));
    revalidatePath(`/yeu-cau/${s(fd, "id")}`);
    return { ok: "Đã ghi nhận." };
  });
}

export async function remindPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await E.remindPayment(uid, s(fd, "id"));
    return { ok: "Đã nhắc phụ huynh." };
  });
}

export async function settleCommissionAction(_: FormState): Promise<FormState> {
  return run(async (uid) => {
    await E.settleCommission(uid);
    revalidatePath("/kiem-tien");
    return { ok: "Đã ghi nhận bạn nộp phí nền tảng. Cảm ơn bạn!" };
  });
}

export async function buyMembershipAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await M.buyMembership(uid, s(fd, "tier"), s(fd, "months"));
    revalidatePath("/thanh-vien");
    return { ok: "Đã ghi nhận gói thành viên. Ưu đãi áp dụng ngay, nền tảng sẽ đối soát sao kê." };
  });
}

// ── Nhóm lớp ──

export async function postMessageAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.postMessage(uid, s(fd, "classId"), s(fd, "body"));
    revalidatePath("/nhom");
    return { ok: "Đã gửi." };
  });
}

export async function postAskAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.postPickupAsk(uid, { studentId: s(fd, "studentId"), date: s(fd, "date"), note: s(fd, "note"), drop: dropOf(fd), fee: s(fd, "fee") });
    if (s(fd, "savePlace")) await P.savePlace(uid, dropOf(fd));
    revalidatePath("/nhom");
    return { ok: "Đã đăng lời nhờ vào nhóm lớp. Bạn sẽ nhận tin khi có người nhận đón giúp." };
  });
}

export async function offerHelpAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.offerHelp(uid, s(fd, "postId"), s(fd, "note"));
    revalidatePath("/nhom");
    return { ok: "Đã báo phụ huynh. Nếu được chọn, bạn sẽ nhận tin để xác nhận." };
  });
}

export async function withdrawOfferAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.withdrawOffer(uid, s(fd, "postId"));
    revalidatePath("/nhom");
    return { ok: "Đã rút." };
  });
}

export async function chooseOfferAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async (uid) => { id = await C.chooseOffer(uid, s(fd, "offerId")); });
  if (res?.error) return res;
  redirect(`/yeu-cau/${id}?moi=1`);
}

// ── Giới thiệu bạn bè & chia sẻ doanh thu ──

export async function claimReferralAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await S.claimReferral(uid, s(fd, "refCode"));
    revalidatePath("/gioi-thieu");
    return { ok: "Đã ghi nhận người giới thiệu." };
  });
}

const payInput = (fd: FormData) => ({ bankBin: s(fd, "bankBin"), bankAccount: s(fd, "bankAccount"), accountName: s(fd, "accountName") });

export async function savePayAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await S.savePayAccount(uid, payInput(fd));
    revalidatePath("/chia-se");
    return { ok: "Đã lưu tài khoản nhận." };
  });
}

export async function saveSchoolPayAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await S.saveSchoolPay(uid, s(fd, "schoolId"), payInput(fd));
    revalidatePath("/chia-se");
    return { ok: "Đã lưu tài khoản nhận của trường." };
  });
}

export async function setTeacherShareAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const on = decision(fd, "on", "off");
    await S.setTeacherShare(uid, s(fd, "schoolId"), on);
    revalidatePath("/chia-se");
    return { ok: on ? "Đã bật phần chia cho giáo viên." : "Đã gộp phần của giáo viên về trường." };
  });
}

export async function markPayoutAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await S.markPayout(uid, s(fd, "key"));
    revalidatePath("/quan-tri/chia-se");
    return { ok: "Đã ghi nhận chuyển khoản và báo người nhận." };
  });
}

export async function widenAskAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const to = await K.widenAsk(uid, s(fd, "postId"));
    revalidatePath("/nhom");
    return { ok: to === "TRUONG" ? "Đã gửi lời nhờ tới phụ huynh cả trường." : "Đã gửi lời nhờ tới phụ huynh sống cùng phường/xã." };
  });
}

export async function closePostAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.closePost(uid, s(fd, "postId"));
    revalidatePath("/nhom");
    return { ok: "Đã đóng lời nhờ." };
  });
}

// ── Đón theo tháng ──

export async function createMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async (uid) => {
    const place = s(fd, "placeId") ? (await P.placesOf(uid)).find((p) => p.id === s(fd, "placeId")) : null;
    id = await TH.createMonthly(uid, {
      studentId: s(fd, "studentId"), month: s(fd, "month"), weekdays: fd.getAll("weekdays"), fee: s(fd, "fee"),
      helperPhone: s(fd, "mode") === "chi-dinh" ? s(fd, "helperPhone") : "", note: s(fd, "note"),
      drop: place ? { label: place.label, address: place.address, ward: place.ward, lat: place.lat, lng: place.lng } : undefined,
    });
  });
  if (res?.error) return res;
  redirect(`/thang/${id}`);
}

/** Các nút trên trang hợp đồng: cùng một mẫu "gọi nghiệp vụ → tải lại trang → báo kết quả". */
function onContract(fd: FormData, fn: (uid: string, id: string) => Promise<unknown>, ok: string): Promise<FormState> {
  return run(async (uid) => {
    await fn(uid, s(fd, "id"));
    revalidatePath(`/thang/${s(fd, "id")}`);
    revalidatePath("/kiem-tien");
    return { ok };
  });
}

export async function cancelMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.cancelMonthly(u, id), "Đã huỷ hợp đồng.");
}
export async function offerMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.offerMonthly(u, id), "Đã báo phụ huynh. Nếu được chọn, cô sẽ duyệt rồi bạn nhận lịch đón.");
}
export async function withdrawMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.withdrawMonthlyOffer(u, id), "Đã rút.");
}
export async function chooseMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.chooseMonthlyOffer(u, id, s(fd, "helperId")), "Đã chọn người đón. Đang chờ cô duyệt.");
}
export async function markMonthlyPaidAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.markMonthlyPaid(u, id), "Đã báo người đón. Lịch đón bắt đầu theo các buổi đã chọn.");
}
export async function markMonthlyReceivedAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.markMonthlyReceived(u, id), "Đã ghi nhận.");
}
export async function skipMonthlyDayAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.skipMonthlyDay(u, id, s(fd, "date")), "Đã huỷ buổi này và báo người đón.");
}
export async function missMonthlyDayAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.missMonthlyDay(u, id, s(fd, "date"), s(fd, "note")), "Đã báo nghỉ. Phụ huynh và cô đã được báo.");
}
export async function endMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.endMonthly(u, id, s(fd, "reason")), "Đã dừng hợp đồng. Bên kia và cô đã được báo.");
}
export async function markRefundedAction(_: FormState, fd: FormData): Promise<FormState> {
  return onContract(fd, (u, id) => TH.markRefunded(u, id), "Đã ghi nhận hoàn tiền.");
}

export async function helperRespondMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const accept = decision(fd, "accept", "decline");
    await TH.helperRespondMonthly(uid, s(fd, "id"), accept, s(fd, "note"));
    revalidatePath(`/thang/${s(fd, "id")}`);
    return { ok: accept ? "Đã nhận lời. Chờ cô duyệt." : "Đã báo phụ huynh." };
  });
}

export async function teacherDecideMonthlyAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    const approve = decision(fd, "approve", "reject");
    await TH.teacherDecideMonthly(uid, s(fd, "id"), approve, { calledParent: fd.get("calledParent") === "on", note: s(fd, "note") });
    revalidatePath(`/thang/${s(fd, "id")}`);
    return { ok: approve ? "Đã duyệt. Mỗi buổi app tự tạo mã đón; tại cổng vẫn kiểm như thường." : "Đã từ chối và báo phụ huynh." };
  });
}
