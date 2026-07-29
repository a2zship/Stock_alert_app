---
name: universal-app-packager
description: Đóng gói bất kỳ dự án phần mềm nào (Python/FastAPI/Flask, Node.js/Next.js, hoặc Docker) thành một bộ cài đặt offline 1-click gồm install.bat (Windows) và install.sh (Linux/macOS), theo quy trình 5 bước cố định — Pre-check QA, Build Assets, Export Offline Bundle, Generate Installers, Create Documentation. Dùng skill này bất cứ khi nào người dùng muốn "đóng gói ứng dụng", "tạo bộ cài đặt", "xuất bản offline installer", "build bản phân phối/distributable", "giao app cho khách hàng/đối tác không có internet", hoặc nhắc tới universal_packager.py / universal-app-packager — ngay cả khi họ chỉ nói tên dự án (ví dụ "đóng gói LIMS_Quan_ly_phong_thu_nghiem cho tôi") mà không nêu rõ framework hay không dùng đúng từ "package".
---

# Universal App Packager

Đóng gói một thư mục mã nguồn thành bộ cài đặt độc lập, có thể chuyển cho khách hàng
cài trên máy không có sẵn môi trường dev — không cần giải thích Docker/Node/Python là gì,
người nhận chỉ cần double-click `install.bat` (Windows) hoặc chạy `install.sh` (Linux/macOS).

## Quy trình 5 bước (cố định, không đổi thứ tự)

1. **Pre-check QA** — chạy `pytest` (nếu có `pytest.ini`/`tests/`) và/hoặc `npm test`
   (nếu có script `test` trong `package.json`), để tránh đóng gói một bản build hỏng.
   Bỏ qua bằng `--skip-tests` khi cần đóng gói nhanh (ví dụ bản demo nội bộ).
2. **Build Assets** — build production: `docker-compose build` nếu có Docker,
   `npm run build` nếu có script `build` trong `package.json`. Dự án Python thuần không
   cần bước build riêng.
3. **Export Offline Bundle** — gói mọi thứ cần để cài đặt **không cần internet**:
   Docker image xuất ra `.tar` bằng `docker save`; dự án Python tải sẵn wheel qua
   `pip download` vào `python_packages/`; dự án Node đóng gói `node_modules` sẵn có (nếu có).
4. **Generate 1-Click Installers** — sinh `install.bat` và `install.sh` tương ứng với
   loại dự án đã phát hiện (docker load + up, hoặc tạo venv + pip install, hoặc npm install + start).
5. **Create Documentation** — sinh `HUONG_DAN_CAI_DAT.md` mô tả yêu cầu hệ thống, cách
   cài đặt trên từng OS, và cách gỡ cài đặt.

Lý do giữ đúng 5 bước và đúng thứ tự này: mỗi bước phụ thuộc kết quả bước trước
(không thể export bundle trước khi build xong; không thể sinh installer trước khi
biết bundle chứa gì) — nên đừng nhảy cóc hoặc gộp bước khi chạy thủ công thay vì
dùng script.

## Cách chạy

```bash
python .claude/skills/universal-app-packager/scripts/universal_packager.py \
  --app-name <ten-ung-dung> --version <phien-ban> [--source-dir <duong-dan-du-an>] [--skip-tests]
```

- `--app-name` (bắt buộc): tên định danh, chỉ gồm chữ/số/`-`/`_`/`.` (script tự validate,
  từ chối ký tự lạ để tránh path traversal hay command injection).
- `--version` (mặc định `1.0.0`): cùng quy tắc ký tự như trên.
- `--source-dir` (mặc định thư mục hiện tại): trỏ tới gốc dự án cần đóng gói nếu không
  chạy script ngay trong thư mục đó.
- `--skip-tests`: bỏ qua bước 1.

Kết quả nằm tại `dist/<app-name>_v<version>/` (thư mục con của nơi bạn chạy lệnh,
không phải bên trong `--source-dir`), gồm: `app/` (mã nguồn + assets đã đóng gói),
`install.bat`, `install.sh`, `HUONG_DAN_CAI_DAT.md`, và tùy loại dự án còn có
`app_images.tar` (Docker) hoặc `python_packages/` (Python).

## Cách script tự nhận diện loại dự án

Script tự quét thư mục nguồn — người dùng không cần khai báo framework:

| Phát hiện thấy | Xếp vào loại |
|---|---|
| `docker-compose.yml` hoặc `docker-compose.prod.yml` | Docker (ưu tiên cao nhất — đóng gói cả stack) |
| `package.json` có dependency `next` | Node.js / Next.js |
| `package.json` (không có `next`) | Node.js thuần |
| `requirements.txt` hoặc `pyproject.toml` | Python |
| Không khớp gì | Generic — chỉ copy toàn bộ source code, sinh installer rỗng kèm hướng dẫn cài thủ công trong `HUONG_DAN_CAI_DAT.md` |

Nếu một dự án khớp nhiều loại (ví dụ vừa có Docker vừa có Node), Docker luôn được ưu
tiên vì nó đóng gói trọn vẹn cả stack (backend + frontend + DB) mà không cần cài từng
runtime lẻ trên máy đích.

## Những gì script luôn tự bảo vệ

- **Không bao giờ đóng gói secret**: mọi file khớp `.env`, `.env.*`, `credentials.json`,
  `*.pem`, `*.key` bị loại khỏi bundle, kể cả trong bundle "generic".
- **Không tự sao chép đè lên chính nó**: vì thư mục output tên `dist/` trùng với tên
  thư mục build mặc định của rất nhiều công cụ JS (Vite, webpack, tsc), script đóng gói
  vào một thư mục tạm trước rồi mới chuyển vào `dist/<app>_v<version>/` ở bước cuối —
  nếu viết lại script này, đừng bỏ qua chi tiết đó, nó từng gây lỗi đệ quy sao chép
  vô hạn khi thư mục output nằm ngay trong thư mục nguồn.
- **Không chạy lệnh shell với chuỗi chưa kiểm tra**: `--app-name`/`--version` được lọc
  qua regex trước khi dùng để đặt tên thư mục hay chèn vào nội dung installer.

## Khi kết quả không như mong đợi

- Nếu đóng gói xong mà cài đặt bị thiếu asset đã build (ví dụ trang web trắng), kiểm tra
  xem bước 2 (Build Assets) có thực sự chạy không — dự án Node cần có script `"build"`
  trong `package.json` thì script mới gọi `npm run build`.
- Nếu bước build Next.js/Node báo lỗi `JavaScript heap out of memory` (thường kèm
  `Scavenge ... allocation failure` hoặc `young object promotion failed`), đây hầu như
  luôn là do máy đang đóng gói thiếu RAM trống thực sự tại thời điểm đó (đã xác nhận qua
  thực nghiệm: máy 8GB RAM nhưng chỉ còn ~400MB trống do nhiều tiến trình khác — vd. nhiều
  cửa sổ Claude Code/IDE cùng lúc — build Next.js chết ngay ở heap vài chục MB), không
  phải lỗi của `universal_packager.py`. Đóng bớt ứng dụng khác (đặc biệt các phiên
  Claude Code/IDE khác) rồi chạy lại, thay vì thử sửa script.
- Nếu máy đích thực sự không có internet nhưng cài đặt Python vẫn cố tải từ PyPI, kiểm
  tra `python_packages/` có được tạo thành công không (bước 3 dùng `pip download`, cần
  chính máy đóng gói có internet tại thời điểm đóng gói).
- Dự án hỗn hợp/lạ không rơi vào 4 loại trên sẽ dùng nhánh generic — nếu cần một installer
  thật sự tự động cho loại đó, mở rộng `detect_stack()` trong
  `scripts/universal_packager.py` thay vì viết installer tay mỗi lần.
