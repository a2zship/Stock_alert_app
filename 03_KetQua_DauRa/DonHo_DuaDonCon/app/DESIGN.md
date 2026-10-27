# Hệ thiết kế — Đón Hộ

Token nằm trong [`src/app/globals.css`](src/app/globals.css); component **không** chứa mã hex.
Quy tắc chung: [`02_ThuVien_CauLenh/HuongDan_ThietKe_GiaoDien_UngDung.md`](../../../02_ThuVien_CauLenh/HuongDan_ThietKe_GiaoDien_UngDung.md).

## Định hướng
App an toàn trẻ em, người dùng là phụ huynh và giáo viên đang vội (đứng ở cổng trường, một tay bế con). Ưu tiên: **đọc được trạng thái trong 1 giây**, nút to, ít chữ, màu trạng thái nhất quán.

**Làm mới 28/10/2026 — "chuyên nghiệp mà thân thiện":** chàm dịu (tin cậy) + cam ấm cho mọi thứ về *tương trợ, cảm ơn*. Nút bo tròn dạng viên thuốc, thẻ bo 18px, khối chào đầu trang nền chàm, ảnh đại diện bằng chữ cái. `ui-ux-pro-max` gợi ý đỏ cảnh báo làm màu chính + font serif EB Garamond — em bỏ: đỏ làm màu chính sẽ lẫn với cảnh báo nguy hiểm, serif kém rõ ở cỡ nhỏ trên điện thoại. Xanh lá / hổ phách / đỏ **chỉ** dùng cho trạng thái.

## Màu (đo bằng `npm run contrast` — script đọc thẳng token trong globals.css, thoát lỗi nếu có cặp không đạt)

| Token | Sáng | Tối | Dùng cho | Tương phản sáng / tối |
|---|---|---|---|---|
| `--text` | #111827 | #e5e7eb | chữ chính | 17,7 / 14,2 |
| `--muted` | #5b6474 | #a1a8b8 | chữ phụ | 6,0 / 7,4 |
| `--primary` | #4f46e5 | #a5b4fc | nút chính, link, mục đang chọn | 6,3 / 8,8 (chữ trên nút 6,3 / 8,0) |
| `--accent` | #c2410c | #fdba74 | **tương trợ**: điểm, huy hiệu, lời nhờ trong nhóm, nút "Tôi đón giúp được" | 5,2 / 10,4 (trên nền nhạt 4,5+) |
| `--ok` | #047857 | #34d399 | đã duyệt, đã giao, hoàn tất | 5,5 / 9,1 |
| `--warn` | #92400e | #fbbf24 | đang chờ, người ngoài danh sách, mất tín hiệu | 7,1 / 10,5 |
| `--danger` | #b91c1c | #f87171 | chặn, khoá, từ chối, không giao được | 6,5 / 6,4 |
| `--info` | #1d4ed8 | #93c5fd | ghi chú trung tính | 6,0 / 9,3 |
| `--hero-from → --hero-to` | #4338ca → #6d28d9 | #312e81 → #4c1d95 | khối chào đầu trang, chữ trắng | 7,1+ / 10,9+ |
| `--nav-bg` | #1e1b4b | #11132a | sidebar, thanh trên | chữ 11,6 / 13,2 |
| `--brand` | #fbbf24 | #fbbf24 | **chỉ** logo + vạch mục đang chọn trên nền chàm | 9,6 / 10,9 |
| `--map-school` / `--map-person` | #4f46e5 / #c2410c | #a5b4fc / #fdba74 | ghim trường / người đón trên bản đồ | ≥ 3 |
| `--map-home` | #15803d | #86efac | ghim điểm trả bé, viền chip điểm hay dùng | 5,02 / 12,52 (≥ 3) |
| `--border-strong` | #6b7280 | #6b7280 | viền ô nhập (≥3:1) | 4,8 / 3,6 |

Mỗi trạng thái luôn có **icon + chữ**, không chỉ dựa vào màu.

## Chữ
**Be Vietnam Pro** 400/500/600/700 (700 cho tiêu đề) (thân thiện, đủ dấu tiếng Việt). Thang 12 / 13 / 15 / 18 / 24 / 30. Ô nhập 16px trên điện thoại. PIN hiển thị 32px, `tabular-nums`, cách chữ rộng.

## Khoảng cách, hình khối
Bội 4/8. Bo góc 8 / 12 / 18, nút dạng viên thuốc (999px). Vùng bấm ≥ 44px; nút hành động chính ở màn cổng trường cao 56px.

## Điều hướng
- ≥1024px: sidebar 232px, mục đang mở `aria-current="page"` + vạch vàng.
- <1024px: thanh trên + thanh dưới tối đa 5 mục, chừa `env(safe-area-inset-bottom)`.
- Mục điều hướng đổi theo vai trò: Phụ huynh (Con, Nhờ đón, Nhóm lớp, Giúp đón, Người tin cậy, Hộp tin), Người đón (Giúp đón, Hộp tin), Giáo viên (Hôm nay, Giao trẻ, Duyệt, Nhóm lớp, Hộp tin).
- Quá 5 mục thì bỏ mục `spare` khỏi thanh dưới (vd. Người tin cậy của phụ huynh — vẫn có ở sidebar và lối tắt trên trang chủ).

## Component
- `Icon` — bộ SVG nét 2px kiểu Lucide. Cấm emoji/ký tự.
- `StatusBadge` — map trạng thái yêu cầu → màu + icon + chữ, dùng chung mọi trang.
- `Note` (info/ok/warn/error) — icon + chữ; lỗi `role="alert"`, còn lại `role="status"`.
- `Empty` — icon + câu hướng dẫn.
- `SubmitButton` — `aria-busy` + `disabled` khi đang gửi.
- `Timeline` — chuỗi xác nhận 3 bên, mỗi bước có người, giờ, icon.
- `Hero` — khối chào đầu trang (phụ huynh, giáo viên): nền chàm chuyển sắc, 1–2 nút lớn.
- `Avatar` — chữ cái đầu, 4 tông màu cố định theo tên (không cần ảnh thật).
- `Journey` — hành trình 5 bước: Gửi nhờ → Nhận lời → Cô duyệt → Giao ở cổng → Về an toàn. Bước hiện tại nhấp nháy nhẹ (tắt khi `prefers-reduced-motion`), bước dừng màu đỏ + dấu X, có chữ ẩn cho trình đọc màn hình.
- `DropPicker` — ô "Trả bé ở đâu?": chip điểm hay dùng (44px, aria-pressed), tên gọi + phường/xã + số nhà, nút "Tôi đang ở đây", bản đồ chỉ mở khi cần (chạm để ghim, kéo ghim để sửa), ô "Lưu điểm này".
- `TrackingMap` — bản đồ Leaflet: ghim trường + ghim người đón (SVG cùng bộ icon), đường nét đứt, 3 ô số (cách trường / dự kiến tới / cập nhật), chấm "đang chia sẻ / mất tín hiệu". Tối: lọc màu nền bản đồ.
- `RewardSummary / RewardBadges / RewardPerks / RewardRules` — khung tương trợ, tông cam ấm; quyền lợi chưa mở hiện khoá + "Từ hạng …".
- Nhóm lớp: bong bóng tin (của mình bên phải, nền chàm nhạt), thẻ "Nhờ đón hộ" viền cam, ô soạn tin dính đáy (trên thanh điều hướng dưới).
