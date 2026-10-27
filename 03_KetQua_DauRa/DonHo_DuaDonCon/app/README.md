# Đón Hộ — bản mẫu

Nhờ người đón con khi bận đột xuất. Một lần đón hộ chỉ có hiệu lực khi đủ **3 bên xác nhận**: phụ huynh gửi, người đón nhận lời, giáo viên phụ trách lớp duyệt. Tại cổng trường còn 4 lớp kiểm: mã QR/PIN một lần, ảnh chân dung, 4 số cuối CCCD, và phụ huynh xác nhận bé đã về.

Đặc tả đầy đủ: [`../DacTa_UngDung_DonHo_27-10-2026.md`](../DacTa_UngDung_DonHo_27-10-2026.md) · Hệ thiết kế: [`DESIGN.md`](DESIGN.md)

## Chạy thử trên máy

Cần Node ≥ 20 và Docker Desktop đang chạy.

```bash
npm install
npm run setup     # tạo .env + APP_SECRET, bật Postgres (Docker, cổng 3273), tạo bảng, nạp dữ liệu mẫu
npm run dev       # mở http://localhost:3271
```

Đăng nhập bằng số điện thoại mẫu, lấy mã OTP ở **Hộp tin thử nghiệm** (`/thu-nghiem`):

| Vai | Số điện thoại |
|---|---|
| Bố bé An | 0901000001 |
| Mẹ bé An | 0901000002 |
| Cô giáo lớp Lá 1 | 0901000010 |
| Bà ngoại bé An (người tin cậy, đã duyệt) | 0901000020 |
| Bố bé Ngọc, lớp Lá 1 (đã đón hộ 3 lần, có điểm tương trợ, đang nhờ đón trong nhóm) | 0901000004 |
| Mẹ bé Bình / cô giáo lớp Chồi 2 (để thử kiểm quyền) | 0901000003 / 0901000011 |

Lớp Lá 1 đón 16:30–17:30. Mã đón chỉ dùng được từ 30 phút trước giờ đón, nên muốn thử trọn luồng giao trẻ ngoài khung giờ đó thì chọn ngày mai.

## Tính năng mới (28/10/2026)

- **Bản đồ theo dõi giao nhận** (trang yêu cầu): người đón tự bật chia sẻ vị trí từ 60 phút trước giờ đón và khi đưa bé về; phụ huynh + cô giáo lớp thấy khoảng cách, thời gian dự kiến, tự cập nhật 10 giây/lần. Nút "Tôi đã tới cổng" báo cô giáo. Chỉ giữ **điểm mới nhất**, xoá khi yêu cầu đóng.
- **Nhóm lớp** (`/nhom`): phụ huynh + giáo viên của lớp nhắn tin; phụ huynh đăng "Nhờ đón hộ", phụ huynh khác bấm "Tôi đón giúp được", người nhờ chọn một người → tạo yêu cầu đón hộ bình thường (vẫn đủ 3 bên + kiểm tại cổng). Không hiện số điện thoại; người trong danh sách không được đón bị chặn và giáo viên được báo.
- **Điểm trả bé khai theo từng lần** (form nhờ đón + lời nhờ trong nhóm): tên gọi, số nhà/đường, phường/xã, ghim bản đồ tuỳ chọn; chọn nhanh "điểm hay dùng" (tối đa 5, gắn tài khoản phụ huynh). Người đón thấy số nhà **sau khi cô duyệt**, nhóm lớp chỉ thấy phường/xã. Lúc đưa bé về: bản đồ hiện ghim nhà + khoảng cách, nút "Đã đưa bé tới nơi" báo phụ huynh. Số nhà + toạ độ tự xoá khi yêu cầu đóng.
- **Đón hộ có phí** (`/kiem-tien`, `/giao-vien/nguoi-don-co-phi`): phụ huynh cùng trường đăng ký (CCCD, ảnh, tài khoản đứng tên mình) và được cô lớp của con duyệt; lời nhờ trong nhóm có **thù lao tối thiểu** thì cả trường thấy (không lộ tên bé); bé về an toàn thì người nhờ tự chọn số tiền (≥ mức tối thiểu) + lời cảm ơn, quét **VietQR** chuyển thẳng cho người đón. Nền tảng trích 10% số thực nhận, người đón tự nộp định kỳ; nợ quá hạn thì tạm không nhận việc. Đặt `PLATFORM_*` trong `.env` (xem `.env.example`). Dữ liệu thử: `npx tsx scripts/demo-co-phi.ts`.
- **Điểm tương trợ** (`/nguoi-don`): +10 mỗi lần đón trọn vẹn, +5 nhận lời trong 10 phút, +2 khi được cảm ơn; 3 hạng, 4 huy hiệu, quyền lợi theo hạng. Điểm không đổi ra tiền, không ảnh hưởng việc duyệt.

**Nền bản đồ:** bản mẫu dùng ảnh nền của OSM France (dữ liệu OpenStreetMap, không cần khoá). Khi chạy thật cho nhiều trường cần chọn nhà cung cấp bản đồ có hợp đồng (ví dụ Mapbox, MapTiler, hoặc tự dựng máy chủ ảnh bản đồ) — sửa hằng `TILES` trong `src/components/mapKit.ts`. **[CẦN XÁC MINH]** điều khoản sử dụng trước khi phát hành.

## Kiểm tra

```bash
npm test          # 28 test đơn vị + 31 test chạy trên DB thật (donho_test)
npm run typecheck && npm run lint
npm run contrast  # đo tương phản mọi cặp token sáng/tối (đọc từ globals.css)
```

Tắt `npm run dev` trước khi `npm run build`.

## Cấu trúc

- `src/domain/state.ts` — máy trạng thái: ai được làm gì ở trạng thái nào (nguồn sự thật duy nhất).
- `src/server/requests.ts` — nghiệp vụ đón hộ: tạo, nhận lời, duyệt, quét mã, giao, huỷ, hết hạn. Mỗi lần đổi trạng thái đều kiểm quyền, cập nhật có điều kiện (chống bấm trùng), ghi nhật ký, gửi thông báo trong cùng một giao dịch.
- `src/server/trusted.ts` — người tin cậy, người không được đón.
- `src/server/access.ts` — kiểm quyền theo trẻ / lớp, kể cả quyền xem ảnh.
- `src/server/tracking.ts` + `src/app/yeu-cau/[id]/vi-tri/route.ts` — vị trí người đón (bản đồ), báo tới cổng / tới nơi.
- `src/domain/drop.ts` + `src/server/places.ts` + `src/components/DropPicker.tsx` — điểm trả bé theo từng lần, điểm hay dùng.
- `src/server/chat.ts` — nhóm lớp: tin nhắn, lời nhờ đón, nhận đón, chọn người.
- `src/domain/reward.ts` + `src/server/rewards.ts` — điểm, hạng, huy hiệu, quyền lợi tương trợ.
- `prisma/provinces.ts` — 34 tỉnh/thành sau sắp xếp 2025 (**cần đối chiếu mã chính thức**).

## Chưa có trong bản mẫu

Gửi SMS/Zalo ZNS thật, thông báo đẩy, màn quản trị trường (nhập học sinh từ Excel), báo cáo cho Phòng/Sở, danh sách đủ ~3.300 xã/phường, đăng nhập VNeID. Trước khi cho người thật dùng: **đặt `DEV_INBOX=0`**, chạy HTTPS, rà pháp lý bảo vệ dữ liệu trẻ em.
