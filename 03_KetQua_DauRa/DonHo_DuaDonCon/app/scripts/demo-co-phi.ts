// Tạo dữ liệu thử cho đón có phí trên DB dev: chị Nga được duyệt, 1 lượt đã xong chờ trả tiền, 1 lời nhờ có phí đang mở.
// Chạy: npx tsx scripts/demo-co-phi.ts
import { addDays, vnDateTime, vnToday } from "@/domain/time";
import { appSecret, db } from "@/server/db";
import * as C from "@/server/chat";
import * as E from "@/server/earn";
import * as R from "@/server/requests";
import { unseal } from "@/server/seal";
import { avatarPng } from "../prisma/avatar";

const by = async (phone: string) => (await db.user.findUniqueOrThrow({ where: { phone } })).id;
const photo = () => `data:image/png;base64,${avatarPng([180, 90, 40], 32).toString("base64")}`;

async function main() {
  const [nga, bao, bo, lan, mai] = await Promise.all(["0901000003", "0901000004", "0901000001", "0901000010", "0901000011"].map(by));
  if (!(await db.helperProfile.findUnique({ where: { userId: nga } }))) {
    await E.registerHelper(nga, { cccdLast4: "5566", photo: photo(), bankBin: "970436", bankAccount: "0123456789", accountName: "VO THANH NGA", agree: true });
  }
  const prof = await db.helperProfile.findUniqueOrThrow({ where: { userId: nga } });
  if (prof.status !== "DA_DUYET") await E.reviewHelper(mai, prof.id, "approve");

  const ngoc = await db.student.findFirstOrThrow({ where: { name: "Trần Bảo Ngọc" } });
  // ngày đầu tiên trong tuần tới mà bé Ngọc chưa có yêu cầu đón nào
  let date = "";
  for (let d = 1; d <= 6 && !date; d++) {
    const day = addDays(vnToday(), d);
    const busy = await db.pickupRequest.count({ where: { studentId: ngoc.id, windowStart: { gte: vnDateTime(day, "00:00"), lt: vnDateTime(addDays(day, 1), "00:00") } } });
    if (!busy) date = day;
  }
  const open = () => db.chatPost.findFirst({ where: { studentId: ngoc.id, date, status: "MO", fee: { gt: 0 } } });
  if (!(await open())) await C.postPickupAsk(bao, { studentId: ngoc.id, date, fee: "50000", note: "Nhà gần chợ An Hòa" });
  const post = (await open())!;
  if (!(await db.chatOffer.count({ where: { postId: post.id, userId: nga } }))) await C.offerHelp(nga, post.id, "Tôi đón giúp được");
  const offer = await db.chatOffer.findFirstOrThrow({ where: { postId: post.id, userId: nga } });
  const id = await C.chooseOffer(bao, offer.id);
  await R.delegateRespond(nga, id, true);
  await R.teacherDecide(lan, id, true, { calledParent: true });
  const atGate = new Date(vnDateTime(date, "16:30").getTime() + 5 * 60_000);
  const r = await db.pickupRequest.findUniqueOrThrow({ where: { id } });
  const codes = unseal<{ token: string; pin: string }>(appSecret(), r.codeSealed!)!;
  await R.gateByPin(lan, id, codes.pin, atGate);
  await R.handover(lan, id, { face: true, cccd: true, child: true }, photo(), atGate);
  await R.confirmHome(bao, id, new Date(), "Cảm ơn chị Nga nhiều!");
  console.log("Lượt có phí đã xong:", id);

  const an = await db.student.findFirstOrThrow({ where: { name: "Lê Minh An" } });
  await C.postPickupAsk(bo, { studentId: an.id, date: addDays(vnToday(), 2), fee: "40000",
    drop: { label: "Nhà bà nội", address: "25 Mậu Thân", ward: "Phường Ninh Kiều" } }).catch((e) => console.log("Bỏ qua lời nhờ thứ 2:", e.message));
}
main().finally(() => db.$disconnect());
