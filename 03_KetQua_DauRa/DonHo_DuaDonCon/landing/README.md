# Đón Hộ: trang giới thiệu phim cuộn

Trang tĩnh giới thiệu Đón Hộ cho phụ huynh và nhà trường, chỉ có tiếng Việt. Dựng từ skill `scroll-film-landing` ngày 28/10/2026.

Trang có 3 phần:
- **Phim cuộn.** Cổng trường mở ra, rồi 5 cảnh nối nhau như một buổi chiều đón con:
  1. Nhờ phụ huynh cùng lớp (`pan`)
  2. Xác nhận 3 bên (`zoom`)
  3. Đi đón, kiếm thêm (`wipe`)
  4. Về tới nhà (`dusk`)
  5. Cho nhà trường (`reveal`)

  Sau 5 cảnh là bảng so sánh Đón Hộ với đặt xe công nghệ và nhờ giúp việc.
- **Danh sách "Trường đang có Đón Hộ"**, đọc từ Google Sheet:
  - lọc theo cấp học, tỉnh/thành, tình trạng;
  - tìm theo tên trường, gõ không dấu cũng được;
  - gửi được link đã lọc, ví dụ `?cap=tieu-hoc&tinh=...&q=binh`.
- **Hai lối vào app:** phụ huynh vào `/dang-ky`, nhà trường vào `/mo-truong`. Có thêm link `/dang-nhap`.

**Ít chữ (28/10/2026, theo ý Sếp):**
- Mỗi cảnh có 1 tiêu đề và 1 câu.
- Ý phụ là nhãn ngắn (≤ 5 chữ) có dấu tích.
- So sánh là bảng tích/gạch, không so giá.
- Các bước chỉ có tên bước, phần cuối có 2 nút.
- Thêm chữ thì giữ đúng nhịp này: sửa trong `src/content.ts`.

Trang không có form. Mọi việc đăng ký đều làm trong app, nên không có chỗ nào giả vờ gửi thành công.

Công nghệ: Vite, TypeScript, GSAP (ScrollTrigger, SplitText) và Lenis. Build ra trang tĩnh (`base: './'`), đưa lên GitHub Pages được.

## Chạy
```bash
npm install
npm run dev        # http://localhost:3275
npm run build      # tắt dev server trước khi build
npm run preview    # http://localhost:3276 (xem bản build)
```

## Sửa nội dung
| Muốn đổi | Sửa ở |
|---|---|
| Chữ từng cảnh, so sánh, các bước, phần cuối | `src/content.ts` (khối `vi`) |
| Hiệu ứng, toạ độ chú thích `xy`, điểm zoom `focus` | `src/content.ts` › `SITE.categories` |
| Cấp học trong bộ lọc | `src/content.ts` › `SITE.levels` |
| Địa chỉ app | `.env` › `VITE_APP_URL` |
| Màu, font | `src/styles.css` › `:root`, rồi chạy `python scripts/contrast.py` |
| Cổng trường ở cảnh mở đầu | `src/styles.css` › `.door-leaf`, `.pull` |

## Ảnh minh hoạ
9 ảnh tạo bằng Canva AI ngày 28/10/2026. Mã từng ảnh nằm ở `assets/prompts.md`.
- Bản gốc Canva để trong `assets/raw/canva/`. Bản đã đổi tên để trong `assets/raw/`.
- Bản gốc chỉ rộng 1680px, nên ảnh 2560px bị phóng to và sẽ hơi mềm trên màn hình lớn. `process_images.py` có báo việc này.
- `cat-3-bg@x0.25`: bản điện thoại cắt quanh vị trí xe máy, khoảng 25% chiều ngang tính từ trái.
- Cảnh 4 (`dusk`): lớp hoàng hôn giảm còn 0,5 (sửa trong `film.ts`), vì ảnh gốc vốn đã là cảnh chiều muộn.

Thay ảnh:
1. Bỏ ảnh mới vào một thư mục.
2. Chạy `python scripts/import_canva.py <thư mục>`, hoặc tự đặt tên đúng rồi bỏ vào `assets/raw/`.
3. Chạy `python scripts/process_images.py`.
4. Đo lại `xy`/`focus` trong `content.ts`. Thêm `'below'` làm phần tử thứ 3 của `xy` thì thẻ chú thích nằm dưới điểm neo.

## Danh sách trường
- Tạo bảng từ `docs/Mau_Bang_DuLieu_28-10-2026.xlsx`.
- Hướng dẫn cho người cập nhật: `docs/HuongDan_CapNhat_HangNgay.md`.
- Chưa có link CSV thì trang hiện 5 trường mẫu, gắn nhãn "Dữ liệu mẫu".
- Chỉ đưa lên bảng những trường đã gọi xác minh.

## Placeholder còn chờ điền
| Chỗ | Cần điền |
|---|---|
| `.env` › `VITE_APP_URL` | Tên miền thật của app. Hiện là `http://localhost:3271`: **build bản đưa lên mạng mà quên đổi thì mọi nút đều hỏng** |
| `.env` › `VITE_SHEET_CSV_URL` | Link CSV bảng danh sách trường |
| `content.ts` › `SITE.brand.phone`, `phoneDigits` | Số Zalo hỗ trợ (hiện ghi `[SĐT/ZALO HỖ TRỢ]`) |
| Ảnh minh hoạ | Muốn nét hơn trên màn hình lớn thì cần ảnh ≥2560px |
| Logo, favicon | Chưa có. Đang hiện chữ "Đón Hộ" |

## Kiểm thử (28/10/2026, bản build, đã có ảnh)
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` + `vite build` | Sạch |
| Tương phản bảng màu (`scripts/contrast.py` + 6 cặp riêng) | Đạt hết, thấp nhất 4,84:1 (nhãn "Đang đón") |
| Tràn ngang ở 375px, quét hết chiều dài trang | 0px (có ảnh) |
| Bản ít chữ (1440 + 375px) | Nhãn chú thích nằm gọn, bảng so sánh vừa 375px, không tràn ngang |
| 5 cảnh ở 1440px | Chú thích khớp ảnh, không đè nhau (đã sửa thẻ "Bé" ở cảnh 1); máy đẩy đúng vào điện thoại; cảnh 4 thấy rõ cửa sáng đèn; ảnh trước/sau ở cảnh 5 cùng góc máy |
| Cảnh ở 375px | Chữ nằm trên lớp nền tối; xe máy và bé vẫn nằm trong khung cắt dọc |
| Link lọc `?cap=tieu-hoc&q=binh` | Mở thẳng danh sách, ra đúng 1 trường |
| Hộp chi tiết trường | Mở và đóng (Esc) được; 2 nút dẫn đúng vào `/dang-ky` |
| Phím Tab | Bấm Tab lần đầu tới skip link; Enter thì tới danh sách; ô tìm có viền focus |

**Chưa kiểm:**
- Lighthouse.
- Đo tương phản trên điểm ảnh thật (mới kiểm bằng mắt: chữ đều nằm trên lớp nền chàm đậm).
- Chế độ giảm chuyển động (reduced-motion).
- Điện thoại thật.
- Sheet thật.

Script `scripts/qa/qa-flow.js` của bộ khung kiểm form và chỗ đổi ngôn ngữ, mà trang này đã bỏ cả hai. Muốn dùng phải sửa lại script trước.

## File thừa từ bộ khung
- `src/form.ts`: rỗng, không dùng.
- `scripts/donho_extra.css`: bản nháp CSS, đã chép vào `styles.css`.

Xoá được hai file này khi Sếp đồng ý.
