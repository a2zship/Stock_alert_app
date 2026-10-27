// Bản đồ theo dõi giao nhận bé. Người đón tự bật chia sẻ vị trí; chỉ lưu ĐIỂM MỚI NHẤT, không lưu lộ trình.
// Được chia sẻ: từ 60 phút trước giờ đón (DA_DUYET) và trong lúc đưa bé về (DA_GIAO). Yêu cầu đóng là xoá.
import { canSeeDropAddress, NEAR_DROP_M, showDrop } from "@/domain/drop";
import { distanceM, etaMinutes, NEAR_GATE_M, SHARE_EARLY_MS, STALE_LOC_MS, validLatLng } from "@/domain/geo";
import type { Status } from "@/domain/state";
import { isGuardian, isTeacherOfStudent } from "./access";
import { AppError, db } from "./db";
import { guardiansOf, notify, teachersOf } from "./notify";

const SHARE_STATUSES: Status[] = ["DA_DUYET", "DA_GIAO"];

async function ownRequest(userId: string, requestId: string) {
  const r = await db.pickupRequest.findUnique({ where: { id: requestId }, include: { student: true } });
  if (!r || r.delegateId !== userId) throw new AppError("Yêu cầu này không gửi cho bạn.");
  return r;
}

export async function shareLocation(userId: string, requestId: string, lat: number, lng: number, now = new Date()) {
  if (!validLatLng(lat, lng)) throw new AppError("Vị trí không hợp lệ.");
  const r = await ownRequest(userId, requestId);
  if (!SHARE_STATUSES.includes(r.status as Status)) throw new AppError("Chỉ chia sẻ vị trí khi đã được duyệt và đang đón bé.");
  if (r.status === "DA_DUYET" && now.getTime() < r.windowStart.getTime() - SHARE_EARLY_MS) {
    throw new AppError("Chỉ bật chia sẻ vị trí từ 60 phút trước giờ đón.");
  }
  await db.$transaction(async (tx) => {
    // Điều kiện trạng thái trong câu cập nhật: yêu cầu vừa đóng thì không ghi đè vị trí đã xoá
    const res = await tx.pickupRequest.updateMany({
      where: { id: r.id, status: { in: SHARE_STATUSES } },
      data: { delegateLat: lat, delegateLng: lng, delegateLocAt: now },
    });
    if (res.count !== 1) throw new AppError("Yêu cầu đã đóng, ngừng chia sẻ vị trí.");
    if (!r.delegateLocAt) {
      await tx.requestEvent.create({ data: { requestId: r.id, actorId: userId, actorRole: "NGUOI_DON", action: "CHIA_SE_VI_TRI" } });
      await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", `${r.delegateName} đã bật chia sẻ vị trí. Mở yêu cầu để xem trên bản đồ.`, `/yeu-cau/${r.id}`);
    }
  });
}

export async function stopSharing(userId: string, requestId: string) {
  const r = await ownRequest(userId, requestId);
  await db.pickupRequest.update({ where: { id: r.id }, data: { delegateLat: null, delegateLng: null, delegateLocAt: null } });
}

/** Người đón báo đã tới cổng — giáo viên chuẩn bị đưa bé ra. */
export async function arriveGate(userId: string, requestId: string, now = new Date()) {
  const r = await ownRequest(userId, requestId);
  if (r.status !== "DA_DUYET") throw new AppError("Yêu cầu chưa được duyệt hoặc đã xong.");
  if (now.getTime() < r.windowStart.getTime() - SHARE_EARLY_MS) throw new AppError("Chưa tới giờ đón.");
  await db.$transaction(async (tx) => {
    const res = await tx.pickupRequest.updateMany({ where: { id: r.id, status: "DA_DUYET", arrivedAt: null }, data: { arrivedAt: now } });
    if (res.count !== 1) return; // đã báo rồi — bấm lại không gửi tin trùng
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: userId, actorRole: "NGUOI_DON", action: "TOI_CONG" } });
    const msg = `${r.delegateName} đã tới cổng trường đón bé ${r.student.name}.`;
    await notify(tx, await teachersOf(tx, r.studentId), "PUSH", `${msg} Cô/thầy chuẩn bị đưa bé ra và kiểm mã.`, `/yeu-cau/${r.id}`);
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH", msg, `/yeu-cau/${r.id}`);
  });
}

/** Người đón báo đã đưa bé tới điểm trả — phụ huynh ra đón và bấm "Con đã về an toàn". */
export async function arriveDrop(userId: string, requestId: string, now = new Date()) {
  const r = await ownRequest(userId, requestId);
  if (r.status !== "DA_GIAO") throw new AppError("Chỉ báo tới nơi sau khi cô giáo đã giao bé cho bạn.");
  await db.$transaction(async (tx) => {
    const res = await tx.pickupRequest.updateMany({ where: { id: r.id, status: "DA_GIAO", droppedAt: null }, data: { droppedAt: now } });
    if (res.count !== 1) return; // đã báo rồi
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: userId, actorRole: "NGUOI_DON", action: "TOI_NOI_TRA" } });
    const where = r.dropAddress && r.dropWard ? `${r.dropLabel ?? "điểm trả"} (${showDrop({ address: r.dropAddress, ward: r.dropWard })})` : "nơi hẹn";
    await notify(tx, await guardiansOf(tx, r.studentId), "PUSH",
      `${r.delegateName} báo đã đưa bé ${r.student.name} tới ${where}. Khi đã gặp bé, mở yêu cầu và bấm "Con đã về an toàn".`, `/yeu-cau/${r.id}`);
  });
}

export type TrackingData = {
  status: Status;
  school: { name: string; lat: number; lng: number } | null;
  delegate: { name: string; lat: number; lng: number; at: string; stale: boolean } | null;
  distance: number | null;
  eta: number | null;
  nearGate: boolean;
  arrivedAt: string | null;
  handedOverAt: string | null;
  canShare: boolean;
  /** Điểm trả bé — null nếu chưa khai hoặc người xem chưa được thấy địa chỉ. */
  drop: { label: string; address: string; lat: number | null; lng: number | null } | null;
  dropDistance: number | null;
  dropEta: number | null;
  nearDrop: boolean;
  droppedAt: string | null;
};

/** Dữ liệu bản đồ cho phụ huynh, giáo viên lớp và người đón. null = không có quyền. */
export async function trackingView(userId: string, requestId: string, now = new Date()): Promise<TrackingData | null> {
  const r = await db.pickupRequest.findUnique({ where: { id: requestId }, include: { student: { include: { class: { include: { school: true } } } } } });
  if (!r) return null;
  const who = { delegate: r.delegateId === userId, guardian: await isGuardian(userId, r.studentId), teacher: await isTeacherOfStudent(userId, r.studentId) };
  if (!who.delegate && !who.guardian && !who.teacher) return null;

  const sc = r.student.class.school;
  const school = sc.lat != null && sc.lng != null ? { name: sc.name, lat: sc.lat, lng: sc.lng } : null;
  const live = SHARE_STATUSES.includes(r.status as Status);
  const delegate = live && r.delegateLat != null && r.delegateLng != null && r.delegateLocAt
    ? { name: r.delegateName, lat: r.delegateLat, lng: r.delegateLng, at: r.delegateLocAt.toISOString(), stale: now.getTime() - r.delegateLocAt.getTime() > STALE_LOC_MS }
    : null;
  const distance = school && delegate && r.status === "DA_DUYET" ? distanceM(school, delegate) : null;
  const drop = r.dropAddress && r.dropWard && canSeeDropAddress(r.status, who)
    ? { label: r.dropLabel ?? "Điểm trả", address: showDrop({ address: r.dropAddress, ward: r.dropWard }), lat: r.dropLat, lng: r.dropLng }
    : null;
  const dropDistance = drop?.lat != null && drop.lng != null && delegate && r.status === "DA_GIAO" ? distanceM({ lat: drop.lat, lng: drop.lng }, delegate) : null;
  return {
    status: r.status as Status,
    school,
    delegate,
    distance,
    eta: distance != null ? etaMinutes(distance) : null,
    nearGate: distance != null && distance <= NEAR_GATE_M,
    arrivedAt: r.arrivedAt?.toISOString() ?? null,
    handedOverAt: r.handedOverAt?.toISOString() ?? null,
    drop,
    dropDistance,
    dropEta: dropDistance != null ? etaMinutes(dropDistance) : null,
    nearDrop: dropDistance != null && dropDistance <= NEAR_DROP_M,
    droppedAt: r.droppedAt?.toISOString() ?? null,
    canShare: who.delegate && live && (r.status === "DA_GIAO" || now.getTime() >= r.windowStart.getTime() - SHARE_EARLY_MS),
  };
}
