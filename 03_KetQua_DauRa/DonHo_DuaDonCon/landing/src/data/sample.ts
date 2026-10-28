/**
 * DỮ LIỆU MẪU — chỉ dùng khi chưa cấu hình VITE_SHEET_CSV_URL.
 * Tên trường dưới đây là GIẢ (ghi rõ "mẫu"), không phải trường thật; trang luôn hiện nhãn "Dữ liệu mẫu" khi dùng file này.
 */
import type { Item } from './items'
import { locale } from '../i18n'

const today = new Date().toLocaleDateString(locale)

const make = (n: number, name: string, category: string, segment: string, address: string, spec: number, status: Item['status'] = 'available'): Item => ({
  code: `MAU-${String(n).padStart(2, '0')}`,
  name,
  category,
  segment,
  address,
  spec,
  status,
  note: 'Trường mẫu để xem thử giao diện.',
  updated: today,
})

export const sampleItems: Item[] = [
  make(1, 'Trường Mầm non Mẫu Hoa Sen', 'mam-non', 'Tỉnh mẫu A', 'Phường mẫu 1', 6),
  make(2, 'Trường Mầm non Mẫu Sơn Ca', 'mam-non', 'Tỉnh mẫu A', 'Phường mẫu 2', 2, 'reserved'),
  make(3, 'Trường Tiểu học Mẫu Bình Minh', 'tieu-hoc', 'Tỉnh mẫu A', 'Phường mẫu 1', 9),
  make(4, 'Trường Tiểu học Mẫu Ánh Dương', 'tieu-hoc', 'Tỉnh mẫu B', 'Xã mẫu 3', 3, 'reserved'),
  make(5, 'Trường THCS Mẫu Phù Đổng', 'thcs', 'Tỉnh mẫu B', 'Phường mẫu 4', 4),
  make(6, 'Trường Mầm non Mẫu Họa Mi', 'mam-non', 'Tỉnh mẫu B', 'Xã mẫu 5', 1, 'gone'),
]
