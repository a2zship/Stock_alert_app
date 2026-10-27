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
  const days = sessionDays();
  (await cookies()).set(SESSION_COOKIE, await signSession(appSecret(), userId, Date.now() + days * 86_400_000), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !!process.env.PUBLIC_URL?.startsWith("https"), path: "/", maxAge: days * 86_400,
  });
  const next = s(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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

export async function closePostAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (uid) => {
    await C.closePost(uid, s(fd, "postId"));
    revalidatePath("/nhom");
    return { ok: "Đã đóng lời nhờ." };
  });
}
