// Điểm trả hay dùng của phụ huynh — chỉ để điền nhanh form nhờ đón. Gắn với tài khoản phụ huynh, không gắn hồ sơ trẻ.
import { parseDrop, type DropInput } from "@/domain/drop";
import { AppError, db } from "./db";
import { tierOf } from "./membership";

export function placesOf(userId: string) {
  return db.savedPlace.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/** Lưu (hoặc cập nhật theo tên gọi) một điểm trả. */
export async function savePlace(userId: string, input: DropInput) {
  const d = parseDrop(input);
  if (!d) return;
  if ("error" in d) throw new AppError(d.error);
  const data = { address: d.address, ward: d.ward, lat: d.lat, lng: d.lng };
  const exists = await db.savedPlace.findUnique({ where: { userId_label: { userId, label: d.label } } });
  if (!exists) {
    // Số điểm lưu được theo hạng thành viên (Thường 5): đầy thì bỏ điểm cũ nhất
    const MAX_PLACES = (await tierOf(userId)).places;
    const all = await placesOf(userId);
    if (all.length >= MAX_PLACES) await db.savedPlace.deleteMany({ where: { id: { in: all.slice(0, all.length - MAX_PLACES + 1).map((x) => x.id) } } });
  }
  await db.savedPlace.upsert({ where: { userId_label: { userId, label: d.label } }, create: { userId, label: d.label, ...data }, update: data });
}

