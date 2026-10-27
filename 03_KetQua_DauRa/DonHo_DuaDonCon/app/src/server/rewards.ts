// Lịch sử đón hộ trọn vẹn (tự nguyện, không thù lao) của một người → dữ liệu cho computeReward (domain/reward.ts).
import { computeReward, type Pickup } from "@/domain/reward";
import { db } from "./db";

export async function rewardOf(userId: string): Promise<Pickup[]> {
  const done = await db.pickupRequest.findMany({
    where: { delegateId: userId, status: "HOAN_TAT", fee: null, contractId: null }, // đón có phí / theo tháng không tính điểm tương trợ
    select: { closedAt: true, createdAt: true, thanks: true, events: { where: { action: { in: ["TAO", "NGUOI_DON_NHAN"] } }, select: { action: true, at: true } } },
  });
  return done.map((r) => {
    const asked = r.events.find((e) => e.action === "TAO")?.at ?? r.createdAt;
    const replied = r.events.find((e) => e.action === "NGUOI_DON_NHAN")?.at;
    return {
      completedAt: r.closedAt ?? r.createdAt,
      replyMinutes: replied ? (replied.getTime() - asked.getTime()) / 60_000 : null,
      thanked: !!r.thanks,
    };
  });
}

/** Trang "Giúp đón": điểm, hạng, huy hiệu + những lời cảm ơn gần đây. */
export async function rewardPage(userId: string) {
  const reward = computeReward(await rewardOf(userId));
  const thanks = await db.pickupRequest.findMany({
    where: { delegateId: userId, status: "HOAN_TAT", thanks: { not: null } },
    include: { requester: { select: { name: true } }, student: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take: 5,
  });
  return { reward, thanks: thanks.map((t) => ({ id: t.id, from: t.requester.name, student: t.student.name, text: t.thanks!, at: t.closedAt })) };
}
