// Khoảng cách + thời gian ước tính cho bản đồ theo dõi. Hàm thuần, không phụ thuộc DB.

export type LatLng = { lat: number; lng: number };

/** Toạ độ hợp lệ (độ thập phân). */
export function validLatLng(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Khoảng cách đường chim bay (mét), công thức haversine. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Phút ước tính đi xe máy trong phố: đường thật dài hơn chim bay ~1,4 lần, tốc độ ~20 km/h. */
export function etaMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.4) / (20_000 / 60)));
}

export function showDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Trong bán kính này coi như đã tới cổng trường. */
export const NEAR_GATE_M = 150;
/** Người đón được bật chia sẻ vị trí từ 60 phút trước giờ đón. */
export const SHARE_EARLY_MS = 60 * 60_000;
/** Vị trí cũ hơn mốc này hiện cảnh báo "mất tín hiệu". */
export const STALE_LOC_MS = 3 * 60_000;
