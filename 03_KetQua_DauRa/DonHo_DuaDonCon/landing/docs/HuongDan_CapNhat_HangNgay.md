# Cập nhật danh sách "Trường đang có Đón Hộ"

Danh sách trường ở nửa dưới trang giới thiệu đọc từ một Google Trang tính. Sửa bảng là trang tự đổi sau khoảng 5 phút. Không cần lập trình viên, không cần đăng lại web.

## A. Cài đặt lần đầu (làm một lần)
1. Lấy file mẫu `docs/Mau_Bang_DuLieu_28-10-2026.xlsx`. Muốn tạo lại thì chạy `python scripts/make_sheet_template.py`.
2. Tải file lên Google Drive, mở bằng Google Trang tính, chọn *Tệp → Lưu dưới dạng Google Trang tính*. Xoá dòng mẫu `T001`.
3. Vào *Tệp → Chia sẻ → Công bố lên web*:
   - chọn trang tính **DanhSachTruong**;
   - định dạng **Giá trị được phân tách bằng dấu phẩy (.csv)**;
   - bấm **Công bố**, rồi chép link có dạng `…/pub?gid=…&single=true&output=csv`.
4. Dán link vào file `.env` ở dòng `VITE_SHEET_CSV_URL=`. Chạy `npm run build` rồi đăng lại trang.

## B. Việc thường ngày

| Việc | Sửa cột |
|---|---|
| Trường mới **đã được gọi xác minh** | Thêm dòng: Mã, Tên trường, Cấp học, Tỉnh/thành, Phường/xã. Tình trạng = **Đang tìm người đón** |
| Trường có lượt đón đầu tiên | Tình trạng = **Đang đón** |
| Số lớp tăng | Số lớp (lấy ở cột "Lớp" trang *Quản trị: phễu trường* trong app) |
| Trường dừng dùng | Tình trạng = **Tạm ngừng** (web ẩn, không xoá dòng) |
| Mỗi lần sửa | Ngày cập nhật |

Cách nhanh để biết trường ở bước nào: mở app → *Quản trị: phễu trường*.
- Trường ở bước "Có lượt đón" hoặc "Có doanh thu" thì ghi **Đang đón**.
- Các bước trước đó (đã xác minh) thì ghi **Đang tìm người đón**.

**Trường chưa xác minh thì không đưa lên bảng.** Phụ huynh nhìn thấy tên trường trên trang sẽ hiểu là trường đã dùng Đón Hộ thật.

## C. Không ghi vào bảng
Không ghi số điện thoại, tên cô giáo, tên phụ huynh, tên bé, lớp của bé, số tài khoản. Bảng đã công bố thì ai có link cũng đọc được.

## D. Khi có sự cố
- **Trang báo "Đang hiện bản cập nhật gần nhất":** web chưa đọc được bảng. Kiểm tra bảng còn được công bố không: mở link CSV trong cửa sổ ẩn danh.
- **Một trường không hiện:**
  - xem Cấp học có đúng 1 trong 3 giá trị Mầm non / Tiểu học / THCS không;
  - xem Tên trường có bị trống không;
  - trình duyệt của người làm web có ghi dòng bị bỏ qua trong Console (F12).
- **Tên trường bị lặp:** mỗi trường chỉ một dòng.

## E. Về sau
Hiện bảng nhập tay theo trang phễu trường. Khi số trường nhiều lên, nên cho app tự xuất danh sách trường đã xác minh ra một địa chỉ công khai, khỏi nhập tay. Việc này chưa làm.
