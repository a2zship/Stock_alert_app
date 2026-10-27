// Dựng sẵn một lượt đón có phí đi trọn vòng (dùng chung cho test đón có phí và chia sẻ doanh thu).
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { appSecret, db } from "@/server/db";
import * as K from "@/server/asks";
import * as C from "@/server/chat";
import * as E from "@/server/earn";
import * as R from "@/server/requests";
import { unseal } from "@/server/seal";
import { phoneOf, photoDataUrl, uid } from "./helpers";

export const date = addDays(vnToday(), 1);
export const atGate = new Date(vnDateTime(date, "16:30").getTime() + 5 * 60_000);
export const helperForm = { cccdLast4: "5566", photo: photoDataUrl(), bankBin: "970436", bankAccount: "0123 456 789", accountName: "Vo Thanh Nga", agree: true };

/** Chị Nga (lớp Chồi 2) đăng ký, cô Mai (GV lớp con chị) duyệt. */
export async function approvedHelper() {
  const nga = await uid(phoneOf.meBinh);
  await E.registerHelper(nga, helperForm);
  const prof = await db.helperProfile.findUniqueOrThrow({ where: { userId: nga } });
  await E.reviewHelper(await uid(phoneOf.coMai), prof.id, "approve");
  return nga;
}

/** Anh Bảo (lớp Lá 1) nhờ đón bé Ngọc có thù lao 50.000đ. */
export async function paidAsk() {
  const bao = await uid(phoneOf.bao);
  const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
  await C.postPickupAsk(bao, { studentId: ngoc.id, date, fee: "50000" });
  const post = await db.chatPost.findFirstOrThrow({ where: { studentId: ngoc.id, status: "MO" } });
  // người đón có phí ở lớp khác chỉ nhận được khi lời nhờ lên vòng TRƯỜNG
  await K.widenAsk(bao, post.id);
  return { bao, ngoc, post };
}

/** Đi trọn một lượt đón có phí tới lúc phụ huynh xác nhận bé về. */
export async function paidJobDone() {
  const nga = await approvedHelper();
  const { bao, post } = await paidAsk();
  await C.offerHelp(nga, post.id);
  const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id } });
  const id = await C.chooseOffer(bao, offer.id);
  const lan = await uid(phoneOf.coLan);
  await R.delegateRespond(nga, id, true); // không phải khai lại CCCD/ảnh
  await R.teacherDecide(lan, id, true, { calledParent: true });
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
  const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
  await R.gateByPin(lan, id, codes.pin, atGate);
  await R.handover(lan, id, { face: true, cccd: true, child: true }, photoDataUrl(), atGate);
  await R.confirmHome(bao, id);
  return { id, nga, bao };
}
