# Hướng dẫn đưa Đón Hộ lên mạng (deploy)

*27/10/2026 · áp dụng cho bản mẫu trong `app/`*

## 0. Kết luận trước

Đón Hộ có **hai mức** đưa lên mạng. Hiện tại **chỉ làm được mức A**.

| | Mức A — Demo công khai | Mức B — Chạy thật cho trường |
|---|---|---|
| Mục đích | Cho trường, nhà đầu tư, phụ huynh **xem thử** | Phụ huynh và giáo viên dùng hằng ngày |
| Dữ liệu | Chỉ dữ liệu mẫu (trường "Hoa Sen thử nghiệm", tài khoản 0901000001…) | Dữ liệu thật của trẻ em |
| Đăng nhập | Mã OTP hiện công khai ở `/thu-nghiem` | OTP gửi bằng SMS / Zalo ZNS |
| Làm được ngay? | **Có**, theo mục 2 | **Chưa**. Còn thiếu ở mục 4 |

**Vì sao chưa chạy thật được:**

1. Bản mẫu **chưa gửi SMS thật**. Tin nhắn chỉ được ghi vào cơ sở dữ liệu, nên còn hai lựa chọn:
   - Bật `DEV_INBOX=1`: mã đăng nhập của **mọi người** hiện công khai, ai cũng vào được tài khoản người khác.
   - Tắt `DEV_INBOX=0`: không ai nhận được mã để đăng nhập.
2. **Chưa có màn quản trị trường** để tạo trường, lớp, phụ huynh và học sinh. Hiện người dùng chỉ đến từ dữ liệu mẫu.

**Không nhập dữ liệu thật của trẻ vào bản demo.**

---

## 1. Cần chuẩn bị

| Thứ cần | Gợi ý | Ghi chú |
|---|---|---|
| Máy chủ (VPS) | Ubuntu 24.04, **2 vCPU, 4 GB RAM, 40 GB SSD** | Nên thuê **trong nước** (Viettel IDC, VNPT, FPT Cloud, BizFly, Vietnix…) để sau này dữ liệu trẻ em nằm tại Việt Nam. Giá khoảng vài trăm nghìn/tháng **[CẦN XÁC MINH báo giá]**. Bản 2 GB RAM cũng chạy được nếu build ảnh trên máy khác |
| Tên miền | Ví dụ `donho.vn`, dùng `demo.donho.vn` cho bản demo | Mua tại nhà đăng ký .vn. Tạo **bản ghi A** trỏ về IP máy chủ trước khi chạy |
| Máy của Sếp | Có Git và quyền SSH vào máy chủ | — |

Chứng chỉ HTTPS **không cần mua**: Caddy tự xin và tự gia hạn miễn phí (Let's Encrypt).

**Bộ file deploy (đã có trong `app/`):**

| File | Vai trò |
|---|---|
| `Dockerfile` | Đóng gói app (Next.js chạy chế độ production) |
| `deploy/docker-compose.prod.yml` | Ghép Postgres + app + Caddy (HTTPS); có bước tự đồng bộ cơ sở dữ liệu mỗi lần deploy |
| `deploy/Caddyfile` | Cấu hình HTTPS cho tên miền |
| `deploy/.env.prod.example` | Mẫu cấu hình; copy thành `deploy/.env` trên máy chủ |

---

## 2. Mức A — Đưa bản demo lên mạng (khoảng 30–60 phút)

### Bước 1. Trỏ tên miền
Ở trang quản lý tên miền, tạo bản ghi **A**: tên `demo`, giá trị là IP máy chủ. Chờ vài phút đến vài giờ để bản ghi có hiệu lực. Kiểm tra:
```bash
nslookup demo.donho.vn
```

### Bước 2. Cài Docker trên máy chủ
SSH vào máy chủ rồi chạy:
```bash
curl -fsSL https://get.docker.com | sh
```
Mở tường lửa cho SSH và web:
```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

### Bước 3. Đưa mã nguồn lên máy chủ
Trên máy Sếp, ở thư mục `D:\Claude_Workspace`, đóng gói thư mục app từ nhánh `feat/don-ho`:
```bash
git archive --format=tar.gz -o donho-app.tar.gz feat/don-ho:03_KetQua_DauRa/DonHo_DuaDonCon/app
```
Gửi gói lên máy chủ (thay `IP_MAY_CHU`):
```bash
scp donho-app.tar.gz root@IP_MAY_CHU:/opt/
```
Trên máy chủ, giải nén:
```bash
mkdir -p /opt/donho && tar -xzf /opt/donho-app.tar.gz -C /opt/donho
```
> Lệnh `git archive` chỉ lấy những gì **đã commit**. Bộ file deploy này phải được commit vào `feat/don-ho` trước.

### Bước 4. Điền cấu hình
```bash
cd /opt/donho/deploy && cp .env.prod.example .env && nano .env
```
Điền:
- `DOMAIN=demo.donho.vn`
- `POSTGRES_PASSWORD=` lấy kết quả của `openssl rand -hex 24`
- `APP_SECRET=` lấy kết quả của `openssl rand -hex 32`
- Giữ `SEED_DEMO=1` và `DEV_INBOX=1` (chế độ demo)
- Tài khoản nhận tiền `PLATFORM_*`: **để trống ở bản demo**, tránh người xem chuyển tiền thật

### Bước 5. Chạy
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Lần đầu mất khoảng 5–10 phút để build. Lệnh này tự làm 4 việc:
1. Dựng Postgres.
2. Đồng bộ bảng dữ liệu.
3. Nạp dữ liệu mẫu (chỉ khi cơ sở dữ liệu còn trống).
4. Chạy app và xin chứng chỉ HTTPS.

### Bước 6. Kiểm tra
- Mở `https://demo.donho.vn`. Trang đăng nhập phải có ổ khoá HTTPS.
- Đăng nhập bằng `0901000001`, lấy mã ở `https://demo.donho.vn/thu-nghiem`.
- Xem log nếu có lỗi:
```bash
docker compose -f docker-compose.prod.yml logs -f web
```

---

## 3. Vận hành bản demo

**Cập nhật phiên bản mới:** làm lại bước 3 (đóng gói và giải nén đè lên `/opt/donho`, **giữ nguyên `deploy/.env`**), rồi chạy:
```bash
cd /opt/donho/deploy && docker compose -f docker-compose.prod.yml up -d --build
```
Bảng dữ liệu được đồng bộ tự động. Lưu ý: hiện dự án dùng `prisma db push`. Nếu một thay đổi phải xoá cột, lệnh sẽ dừng và báo lỗi thay vì xoá dữ liệu. Trước khi chạy thật phải chuyển sang migration có kiểm soát.

**Sao lưu cơ sở dữ liệu (nên đặt lịch hằng ngày):**
```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U donho donho | gzip > /opt/backup-donho-$(date +%F).sql.gz
```

**Làm mới dữ liệu demo** (khi người xem đã bấm lung tung): lệnh này **xoá toàn bộ dữ liệu** của bản demo rồi nạp lại dữ liệu mẫu. Chỉ dùng cho bản demo:
```bash
docker compose -f docker-compose.prod.yml down -v && docker compose -f docker-compose.prod.yml up -d
```

**Rủi ro của bản demo:**
- Ai có đường dẫn cũng đăng nhập được mọi tài khoản mẫu và thay đổi dữ liệu. Đó là chủ đích của bản demo.
- Số điện thoại lạ không đăng nhập được, vì không có tài khoản.
- Nền bản đồ OSM France chỉ dành cho dùng thử. Không dùng cho bản chạy thật.

---

## 4. Mức B — Việc phải làm trước khi cho trường dùng thật

Xếp theo thứ tự. Mục nào chưa xong thì **chưa được** tắt chế độ demo.

1. **Gửi OTP thật** (phải sửa mã): nối nhà cung cấp SMS brandname hoặc Zalo ZNS vào `src/server/auth.ts` và `src/server/notify.ts`. Cần đăng ký brandname/OA và mẫu tin **[CẦN XÁC MINH chi phí, thời gian duyệt]**. Xong mới đặt `DEV_INBOX=0`.
2. **Màn quản trị trường** (phải làm mới): tạo trường, lớp, giáo viên; nhập danh sách học sinh và phụ huynh. Xong mới đặt `SEED_DEMO=0` và dùng cơ sở dữ liệu trống.
3. **Pháp lý dữ liệu trẻ em**:
   - Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025: sự đồng ý của cha mẹ, hồ sơ đánh giá tác động, máy chủ đặt tại Việt Nam, quy trình khi lộ lọt **[CẦN XÁC MINH với luật sư]**.
   - Điều khoản sử dụng và chính sách riêng tư.
4. **Bản đồ**: ký hợp đồng nhà cung cấp nền bản đồ (Mapbox, MapTiler, hoặc tự dựng máy chủ bản đồ), sửa `TILES` trong `src/components/mapKit.ts`.
5. **Tiền**:
   - Quét thử VietQR bằng app ngân hàng thật.
   - Làm màn đối soát phí nền tảng và phí thành viên.
   - Rà pháp lý đón có phí, hoá đơn, thuế.
6. **Vận hành**:
   - Sao lưu tự động hằng ngày ra nơi khác máy chủ, có mã hoá, thử khôi phục ít nhất một lần.
   - Theo dõi máy chủ sống/chết (ví dụ UptimeRobot).
   - Chuyển `prisma db push` sang `prisma migrate`.
   - Đổi mật khẩu SSH sang khoá SSH; tắt đăng nhập root bằng mật khẩu.

---

## 5. Câu hỏi thường gặp

**Dùng Vercel / Netlify miễn phí được không?**
Chạy được, nếu ghép với Postgres trên dịch vụ đám mây như Neon hoặc Supabase. Nhưng **không khuyến nghị**:
- Dữ liệu sẽ nằm ở nước ngoài, bất lợi cho dữ liệu trẻ em.
- Ảnh chân dung đang lưu trong cơ sở dữ liệu, sẽ tốn dung lượng gói miễn phí.

**GitHub Pages (như các landing khác) được không?**
Không. Đón Hộ cần máy chủ và cơ sở dữ liệu, không phải trang tĩnh.

**Chạy trên máy tính văn phòng được không?**
Được, nếu chỉ cho vài người trong mạng nội bộ hoặc qua Tailscale. Không nên dùng cho bản công khai, vì máy tắt là app ngừng.
