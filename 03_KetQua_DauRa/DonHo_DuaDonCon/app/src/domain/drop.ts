// Điểm trả bé — phụ huynh khai theo từng lần nhờ đón. Hàm thuần, không phụ thuộc DB.
import { validLatLng } from "./geo";

export type DropInput = { label?: string; address?: string; ward?: string; lat?: string | number | null; lng?: string | number | null };
export type Drop = { label: string; address: string; ward: string; lat: number | null; lng: number | null };

/** Trong bán kính này coi như người đón đã tới điểm trả. */
export const NEAR_DROP_M = 100;

const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

/** Kiểm tra điểm trả. Bỏ trống hết = chưa khai (null). Có khai thì phải đủ địa chỉ + phường/xã; ghim bản đồ không bắt buộc. */
export function parseDrop(i: DropInput | undefined): Drop | null | { error: string } {
  const label = (i?.label ?? "").trim().replace(/\s+/g, " ");
  const address = (i?.address ?? "").trim().replace(/\s+/g, " ");
  const ward = (i?.ward ?? "").trim().replace(/\s+/g, " ");
  const lat = num(i?.lat);
  const lng = num(i?.lng);
  if (!label && !address && !ward && lat == null && lng == null) return null;
  if (address.length < 5) return { error: "Nhập số nhà, tên đường (hoặc ấp, khu phố) của điểm trả bé." };
  if (ward.length < 2) return { error: "Nhập phường/xã của điểm trả bé." };
  if (address.length > 200 || ward.length > 60 || label.length > 30) return { error: "Điểm trả quá dài, ghi gọn lại." };
  if ((lat == null) !== (lng == null) || (lat != null && !validLatLng(lat, lng))) return { error: "Vị trí ghim trên bản đồ không hợp lệ. Ghim lại hoặc bỏ ghim." };
  return { label: label || "Điểm trả", address, ward, lat, lng };
}

export const showDrop = (d: Pick<Drop, "address" | "ward">) => `${d.address}, ${d.ward}`;

/** Ai thấy địa chỉ chi tiết: phụ huynh của bé, GV lớp luôn thấy; người đón chỉ thấy sau khi cô giáo duyệt. Người khác chỉ thấy phường/xã. */
export function canSeeDropAddress(status: string, who: { guardian: boolean; teacher: boolean; delegate: boolean }): boolean {
  if (who.guardian || who.teacher) return true;
  return who.delegate && (status === "DA_DUYET" || status === "DA_GIAO");
}

/** Xoá điểm trả khi yêu cầu đóng (giữ phường/xã cho thống kê, bỏ địa chỉ + toạ độ). */
export const CLEAR_DROP = { dropLabel: null, dropAddress: null, dropLat: null, dropLng: null } as const;
