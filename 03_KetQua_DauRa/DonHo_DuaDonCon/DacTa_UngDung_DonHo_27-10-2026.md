# Đặc tả ứng dụng "Đón Hộ" — nhờ người đón con, có xác nhận 3 bên

Ngày soạn: 27/10/2026 · Phiên bản 0.1 (bản đầu, dùng để dựng bản mẫu và đem đi hỏi ý kiến trường)

Các mục ghi **[CẦN XÁC MINH]** là chỗ em chưa chắc hoặc cần luật sư, Sở GD&ĐT hay nhà trường xác nhận trước khi chạy thật.

---

## 1. Bài toán

Cha mẹ có việc đột xuất (họp kéo dài, kẹt xe, đi công tác, ốm) không kịp đón con. Hiện nay thường xử lý bằng cách gọi điện cho cô giáo, nhắn Zalo, rồi nhờ ông bà, hàng xóm hoặc đồng nghiệp đến đón. Cách này có ba lỗ hổng:

1. **Cô giáo không chắc người đến đón đúng là người được nhờ.** Chỉ có một cuộc gọi hoặc một tin nhắn, dễ bị giả mạo.
2. **Không có dấu vết.** Khi có tranh chấp (bố mẹ ly thân, người lạ đón nhầm), không ai chứng minh được ai đã đồng ý điều gì, lúc mấy giờ.
3. **Cha mẹ không biết lúc nào con đã được giao.** Phải gọi hỏi lại.

"Đón Hộ" giải quyết bằng một quy trình có **ba chữ ký số**: người nhờ đồng ý, người đón hộ nhận lời, giáo viên phụ trách lớp duyệt. Sau đó lúc giao trẻ tại cổng có thêm bước đối chiếu mã một lần, ảnh, CCCD, và cha mẹ nhận thông báo ngay khi con được giao.

## 2. Người dùng và vai trò

| Vai trò | Là ai | Làm được gì |
|---|---|---|
| **Phụ huynh** (người nhờ) | Cha, mẹ, người giám hộ hợp pháp của trẻ, do trường xác nhận | Khai danh sách người tin cậy, khai người **không được** đón, tạo / huỷ yêu cầu đón hộ, nhận thông báo đã giao, xác nhận con đã về |
| **Người đón hộ** | Ông bà, cô chú, hàng xóm, đồng nghiệp… | Nhận lời / từ chối, xem mã đón (QR + PIN) sau khi được duyệt, đưa mã và CCCD cho giáo viên |
| **Giáo viên phụ trách lớp** | GV chủ nhiệm, GV trực cổng được phân công | Duyệt / từ chối yêu cầu của lớp mình, giao trẻ tại cổng (quét mã, đối chiếu, chụp ảnh bàn giao) |
| **Quản trị trường** | Ban giám hiệu, văn thư | Tạo lớp, gán giáo viên, nhập học sinh và phụ huynh, xem nhật ký cả trường, xử lý sự cố |
| **Quản lý cấp xã / tỉnh** | Phòng / Sở GD&ĐT | Chỉ xem **số liệu tổng hợp** (số yêu cầu, tỉ lệ từ chối, sự cố), **không** xem được tên, ảnh trẻ |
| **Quản trị hệ thống** | Đơn vị vận hành nền tảng | Cấu hình, hỗ trợ kỹ thuật; truy cập dữ liệu cá nhân phải có lý do và được ghi nhật ký |

Một người có thể giữ nhiều vai trò (ví dụ giáo viên cũng là phụ huynh của lớp khác). Quyền luôn tính theo **trường + lớp + trẻ**, không có quyền "xem tất cả".

## 3. Luồng chính: một lần đón hộ

```
Phụ huynh tạo yêu cầu ──► Người đón hộ nhận lời ──► Giáo viên duyệt ──► Sinh mã một lần
        │                        │ từ chối                │ từ chối
        │                        ▼                        ▼
        │                  (báo phụ huynh)          (báo phụ huynh + lý do)
        ▼
  Phụ huynh có thể HUỶ bất kỳ lúc nào trước khi giao → mã mất hiệu lực ngay

Tại cổng: GV quét QR / nhập PIN ─► màn đối chiếu (ảnh, tên, 4 số cuối CCCD, cảnh báo)
         ─► GV tích 3 ô kiểm ─► (chụp ảnh bàn giao) ─► "Đã giao"
         ─► Phụ huynh nhận thông báo + ảnh ─► Phụ huynh bấm "Con đã về an toàn" → HOÀN TẤT
```

### 3.1. Trạng thái của một yêu cầu

| Trạng thái | Ý nghĩa | Đi tiếp sang |
|---|---|---|
| `CHO_NGUOI_DON` | Phụ huynh đã gửi, chờ người đón hộ nhận lời | `CHO_GIAO_VIEN`, `NGUOI_DON_TU_CHOI`, `DA_HUY`, `HET_HAN` |
| `CHO_GIAO_VIEN` | Người đón đã nhận lời, chờ GV duyệt | `DA_DUYET`, `GV_TU_CHOI`, `DA_HUY`, `HET_HAN` |
| `DA_DUYET` | Đủ 3 bên. Mã QR + PIN có hiệu lực trong khung giờ đón | `DA_GIAO`, `DA_HUY`, `BI_KHOA`, `HET_HAN` |
| `BI_KHOA` | Nhập sai PIN quá 5 lần → khoá, báo GV + phụ huynh | `DA_HUY` (phụ huynh tạo yêu cầu mới) |
| `DA_GIAO` | GV đã giao trẻ | `HOAN_TAT` |
| `HOAN_TAT` | Phụ huynh xác nhận con đã về (hoặc tự đóng sau 24 giờ, ghi rõ "tự đóng") | — |
| `NGUOI_DON_TU_CHOI`, `GV_TU_CHOI`, `DA_HUY`, `HET_HAN` | Kết thúc, không giao được | — |

Chỉ máy chủ được đổi trạng thái, và chỉ theo đúng bảng trên. Mọi lần đổi đều ghi nhật ký (ai, lúc nào, từ trạng thái nào, lý do).

### 3.2. Hai loại người đón hộ

**a) Người tin cậy đăng ký trước** (ưu tiên). Phụ huynh khai từ trước: họ tên, quan hệ, SĐT, ảnh chân dung, 4 số cuối CCCD. Giáo viên duyệt người này **một lần** khi phụ huynh thêm vào danh sách (GV có thể đã gặp họ ở buổi họp). Khi bận, phụ huynh chỉ cần chọn người và bấm gửi, mất khoảng 15 giây.

**b) Người nhờ đột xuất** (ngoài danh sách). Phụ huynh nhập SĐT + họ tên + quan hệ. Người đó nhận tin nhắn có link, đăng nhập bằng OTP, **tự chụp ảnh chân dung** và khai 4 số cuối CCCD khi nhận lời. Vì rủi ro cao hơn nên có thêm luật:
- Giao diện GV gắn nhãn **"Người ngoài danh sách"** nổi bật.
- GV **bắt buộc** tích "Đã gọi điện xác minh với phụ huynh" trước khi được bấm Duyệt.
- Nhà trường có thể tắt hẳn loại (b) cho trường mình (ví dụ trường mầm non muốn chặt hơn).

### 3.3. Xác minh tại cổng (4 lớp, theo lựa chọn của Sếp)

1. **Mã một lần**: QR + PIN 6 số, chỉ có hiệu lực từ 30 phút trước đến hết khung giờ đón, dùng được **một lần**. Sai PIN 5 lần thì khoá yêu cầu.
2. **Ảnh chân dung**: màn GV hiện ảnh to của người đón để so mặt.
3. **CCCD**: màn GV hiện 4 số cuối CCCD đã khai; GV xem CCCD thật của người đón và tích "Khớp". App **không lưu** số CCCD đầy đủ.
4. **Phụ huynh xác nhận cuối**: khi GV bấm "Đã giao", phụ huynh nhận thông báo (kèm ảnh bàn giao nếu GV chụp) và bấm "Con đã về an toàn".

Mã QR chỉ chứa một chuỗi ngẫu nhiên, **không chứa** tên trẻ hay thông tin gì khác. Người nhặt được ảnh chụp mã cũng không biết đó là ai, và vẫn phải qua bước đối chiếu ảnh + CCCD.

### 3.4. Các luật an toàn khác

- **Danh sách người không được đón**: phụ huynh (hoặc nhà trường, theo quyết định của toà) khai tên + SĐT + ảnh. Nếu SĐT người đón trùng danh sách này, app **chặn** ngay khi tạo yêu cầu và báo GV.
- **Cả hai phụ huynh cùng biết**: nếu trẻ có hai người giám hộ trên hệ thống, cả hai đều nhận thông báo khi có yêu cầu đón hộ và khi trẻ đã được giao. **[CẦN XÁC MINH]** cách xử lý khi hai người giám hộ mâu thuẫn (một người tạo, người kia phản đối) — đề xuất: người kia bấm "Phản đối" thì yêu cầu chuyển về chờ GV gọi điện xử lý.
- **Giờ chót**: yêu cầu phải được GV duyệt trước khi hết khung giờ đón. Quá giờ thì tự `HET_HAN`.
- **Không ai được sửa yêu cầu đã duyệt.** Muốn đổi người đón thì huỷ và tạo cái mới, để chuỗi xác nhận luôn sạch.
- **Trẻ không chịu đi**: màn giao trẻ có nút "Không giao được" kèm lý do (trẻ không nhận ra, người đón có dấu hiệu say xỉn…), báo ngay cho phụ huynh.

### 3.5. Bản đồ theo dõi giao nhận bé (bổ sung 28/10)

- Người đón **tự bật** chia sẻ vị trí; không bật thì app vẫn chạy bình thường. Được bật từ 60 phút trước giờ đón (đã duyệt) và trong lúc đưa bé về (đã giao).
- Phụ huynh của bé và giáo viên lớp xem: khoảng cách tới trường, thời gian dự kiến (ước tính xe máy), lần cập nhật cuối; quá 3 phút không có vị trí mới thì báo "mất tín hiệu".
- Nút **"Tôi đã tới cổng"**: báo giáo viên chuẩn bị đưa bé ra; ghi nhật ký một lần.
- **Tối thiểu hoá dữ liệu:** chỉ lưu điểm mới nhất (không lưu lộ trình), xoá ngay khi yêu cầu hoàn tất / huỷ / hết hạn / không giao được.
- Vị trí **không** thay cho kiểm tra tại cổng: vẫn bắt buộc mã QR/PIN + ảnh + CCCD.

### 3.5b. Điểm trả bé — khai theo từng lần (bổ sung 28/10)

- Hồ sơ trẻ **không** có địa chỉ nhà. Mỗi lần nhờ đón, phụ huynh khai **điểm trả** cho lần đó: tên gọi (Nhà, Nhà bà ngoại…), số nhà/đường, phường/xã, ghim trên bản đồ (không bắt buộc; có nút "Tôi đang ở đây").
- Ai thấy gì: phụ huynh của bé + giáo viên lớp thấy đủ; **người đón chỉ thấy phường/xã cho tới khi giáo viên duyệt**, sau đó mới thấy số nhà (tin nhắn báo đã duyệt kèm địa chỉ); trong nhóm lớp mọi người **chỉ thấy phường/xã** để biết có tiện đường không.
- Khi đưa bé về: bản đồ hiện ghim điểm trả, khoảng cách và thời gian dự kiến; người đón bấm **"Đã đưa bé tới nơi"** → phụ huynh nhận tin để ra đón và bấm "Con đã về an toàn".
- **Tự xoá** số nhà + toạ độ khi yêu cầu đóng (hoàn tất, huỷ, từ chối, hết hạn, không giao được); chỉ giữ phường/xã. Lời nhờ trong nhóm: địa chỉ chuyển sang yêu cầu khi chọn người rồi xoá khỏi bài đăng.
- **Điểm hay dùng** (tối đa 5) lưu trong tài khoản phụ huynh để chọn nhanh — không gắn vào hồ sơ trẻ, đầy thì bỏ điểm cũ nhất.

### 3.6. Nhóm lớp — nhờ đón trong cộng đồng lớp (bổ sung 28/10)

- Mỗi lớp một nhóm: phụ huynh có con trong lớp + giáo viên lớp. Nhắn tin thường và đăng **"Nhờ đón hộ"** (chọn bé + ngày).
- Phụ huynh khác bấm **"Tôi đón giúp được"** (kèm lời nhắn); người nhờ (hoặc phụ huynh còn lại của bé) **chọn một người** → hệ thống tạo yêu cầu đón hộ như mục 3: người được chọn vẫn phải nhận lời (người ngoài danh sách tin cậy thì tự chụp ảnh + khai 4 số CCCD), giáo viên vẫn phải gọi xác minh và duyệt.
- Giáo viên không nhận đón trong nhóm (giáo viên là người kiểm tại cổng). Người trong danh sách **không được đón** của bé bấm nhận sẽ bị chặn, giáo viên được cảnh báo.
- Không hiện số điện thoại trong nhóm. Người có hạng tương trợ cao được đẩy lời nhờ lên đầu mục "Đang cần người đón giúp".

### 3.7. Khung lợi ích cho phụ huynh đi đón hộ (bổ sung 28/10)

| Hành động | Điểm |
|---|---|
| Đón trọn vẹn (phụ huynh bấm "Con đã về an toàn") | +10 |
| Nhận lời trong 10 phút | +5 |
| Được gửi lời cảm ơn | +2 |

| Hạng | Từ | Quyền lợi mở thêm |
|---|---|---|
| Bạn đồng hành | 0 | Lời cảm ơn lưu trong hồ sơ; huy hiệu bên tên trong nhóm lớp |
| Hàng xóm tin cậy | 30 | Lời nhờ của mình được ưu tiên lên đầu nhóm lớp; thư cảm ơn của nhà trường cuối học kỳ *(chờ trường đồng ý)* |
| Đại sứ an toàn | 100 | Vinh danh tại họp phụ huynh; ưu đãi đối tác của trường *(chờ trường/đối tác)* |

Huy hiệu: Lần đầu giúp · Phản hồi nhanh (3 lần) · Bạn của cả lớp (5 lần) · Được cảm ơn (3 lần).

**Nguyên tắc an toàn của khung lợi ích:** điểm **không đổi ra tiền**, không chuyển nhượng, **không ảnh hưởng** việc giáo viên duyệt hay kiểm tra tại cổng; chỉ lần đón trọn vẹn mới được tính (từ chối / không giao được / hết hạn không có điểm). Mục đích là ghi nhận và cảm ơn, không tạo động cơ để người lạ đi đón trẻ. Các quyền lợi có tài trợ/đối tác **[CẦN XÁC MINH]** với nhà trường và quy định về quảng cáo trong trường học trước khi bật.

> Điểm tương trợ vẫn **không đổi ra tiền**. Việc kiếm tiền tách riêng thành "Đón hộ có phí" (mục 3.8); lượt có phí **không** được cộng điểm tương trợ để hai cơ chế không lẫn vào nhau.

### 3.8. Đón hộ có phí — phụ huynh cùng trường kiếm thêm (bổ sung 27/10)

Sếp chọn: người nhận tiền là **phụ huynh cùng trường**; thanh toán **chuyển khoản VietQR thẳng cho người đón** (app không giữ tiền); nền tảng **trích % thu nhập người đón**; mức thù lao là **mức tối thiểu** để người nhờ chủ động chuyển kèm lời cảm ơn (có thể thoả thuận thêm).

**Ai được nhận việc có phí:** phụ huynh có con học cùng trường, khai 4 số cuối CCCD, ảnh chân dung, tài khoản ngân hàng **đứng tên chính mình** (tên chủ TK phải khớp tên trong app), đồng ý quy định → **cô giáo lớp của con người đó duyệt một lần** (`/giao-vien/nguoi-don-co-phi`). Cô có thể từ chối hoặc tạm dừng, bắt buộc ghi lý do. Đã duyệt thì mỗi lượt không phải khai lại CCCD/ảnh.

**Luồng một lượt có phí:**
1. Người nhờ đăng lời nhờ trong nhóm lớp, điền **thù lao tối thiểu** (20.000–300.000đ, tròn nghìn) — để trống là nhờ tương trợ như cũ.
2. Người đón có phí đã duyệt trong **cả trường** được báo; bảng việc (`/kiem-tien`) chỉ hiện lớp, giờ, phường/xã, mức tối thiểu, số tiền thực nhận dự kiến — **không hiện tên bé**.
3. Người nhờ chọn một người → tạo yêu cầu "ngoài danh sách" như cũ: người đón nhận lời → **cô gọi xác minh với phụ huynh** rồi duyệt → kiểm mã/ảnh/CCCD tại cổng → phụ huynh xác nhận bé về an toàn. **Không bỏ bước an toàn nào.**
4. Bé về an toàn → trang yêu cầu hiện thẻ "Gửi lời cảm ơn": phụ huynh để nguyên mức tối thiểu hoặc **tự tăng số tiền** (không thấp hơn mức đã hứa, tối đa 1.000.000đ để tránh gõ thừa số 0), bấm Tạo mã → mã VietQR theo số đó, nội dung "DONHO xxxxxx CAM ON", kèm lời cảm ơn tuỳ chọn → "Tôi đã chuyển khoản".
5. Người đón bấm "Đã nhận tiền" (nếu phụ huynh quên báo thì bấm này cũng tính là đã trả); chưa nhận được có thể "Nhắc phụ huynh" tối đa 1 lần/24 giờ.

**Phí nền tảng:** 10% **[GIẢ ĐỊNH]** (biến `PLATFORM_FEE_RATE`) tính trên **số thực chuyển**, làm tròn nghìn. Người đón tự nộp định kỳ bằng VietQR tới tài khoản nền tảng (`PLATFORM_BANK_*`) rồi bấm "Tôi đã nộp phí". Nợ từ 300.000đ **và** có khoản quá 30 ngày → tạm không nhận việc có phí mới tới khi nộp. Việc đối soát sao kê nền tảng **chưa có màn quản trị** (để sau).

**Không làm:** app không giữ tiền, không thu hộ, không trả trước; không đòi thêm ngoài mức đã hứa; người đón có phí không thấy tên bé trước khi được chọn.

**[CẦN XÁC MINH] pháp lý:** (a) không giữ tiền nên nhiều khả năng không phải trung gian thanh toán, cần luật sư xác nhận; (b) thu nhập của người đón và phí nền tảng — nghĩa vụ thuế TNCN/hoá đơn; (c) đưa đón trẻ có thu tiền có cần đăng ký kinh doanh/điều kiện gì không; (d) mã ngân hàng (BIN NAPAS) trong `src/domain/vietqr.ts` và việc app ngân hàng thật quét được mã — **chưa thử bằng app ngân hàng thật**.

## 4. Quy mô 34 tỉnh thành

### 4.1. Mô hình đơn vị hành chính

Từ 01/07/2025 cả nước có **34 đơn vị hành chính cấp tỉnh** (28 tỉnh + 6 thành phố trực thuộc trung ương) và chính quyền **hai cấp**: tỉnh → xã / phường / đặc khu (khoảng 3.300 đơn vị). App dùng cây:

```
Tỉnh/Thành (34) → Xã/Phường/Đặc khu → Trường → Năm học → Lớp → Học sinh
```

Danh sách 34 tỉnh đã nạp sẵn trong bản mẫu. Danh sách xã/phường nhập từ file dữ liệu chính thức của Cục Thống kê / Bộ Nội vụ. **[CẦN XÁC MINH]** đối chiếu lại tên và mã đơn vị với Nghị quyết của Quốc hội và Ủy ban Thường vụ Quốc hội về sắp xếp đơn vị hành chính năm 2025 trước khi chạy thật.

### 4.2. Cách mở rộng

Không làm 34 bản cài riêng. Làm **một nền tảng chung, nhiều trường** (multi-tenant):
- Mỗi bản ghi đều gắn `schoolId`; mọi truy vấn lọc theo trường của người đang đăng nhập (kiểm ở máy chủ, không tin giao diện).
- Dữ liệu chia theo tỉnh để sau này tách máy chủ theo vùng (Bắc / Trung / Nam) nếu cần.
- Tải nặng nhất rơi vào **16:00–18:00 các ngày trong tuần**, khi các trường cùng tan học. Phải thử tải ở khung giờ này trước khi mở rộng.
- Lộ trình gợi ý: 1–2 trường thử nghiệm → 1 xã/phường → 1 tỉnh (làm việc với Sở) → nhân rộng.

### 4.3. Mã định danh

Không dùng mã định danh cá nhân của trẻ trên CSDL ngành làm khoá chính. **[CẦN XÁC MINH]** nếu sau này muốn đồng bộ với CSDL ngành giáo dục hoặc đăng nhập qua VNeID thì phải làm việc với Bộ GD&ĐT / Bộ Công an về giao thức kết nối; giai đoạn đầu đăng nhập bằng SĐT + mã OTP.

## 5. Bảo vệ dữ liệu cá nhân trẻ em

Đây là phần dễ bị đánh giá nhất khi đem đi trình trường và Sở.

- Dữ liệu trẻ em được pháp luật bảo vệ đặc biệt. **[CẦN XÁC MINH bởi luật sư]** các yêu cầu cụ thể theo Luật Bảo vệ dữ liệu cá nhân (có hiệu lực từ 01/01/2026) và Nghị định 13/2023/NĐ-CP, đặc biệt: sự đồng ý của cha mẹ, đồng ý của trẻ từ 7 tuổi, đánh giá tác động xử lý dữ liệu, thông báo khi có sự cố.
- **Chỉ thu cái cần dùng**: tên trẻ, lớp, ảnh trẻ (tuỳ chọn, để GV nhận diện ở cổng nếu là GV trực thay). Không thu ngày sinh đầy đủ, địa chỉ nhà, số định danh của trẻ. Điểm trả bé chỉ khai theo từng lần nhờ đón và tự xoá khi xong (mục 3.5b).
- **CCCD người đón**: chỉ lưu 4 số cuối.
- **Ảnh bàn giao**: tự xoá sau 30 ngày (nhà trường cấu hình được); ảnh người tin cậy giữ đến khi phụ huynh xoá người đó.
- **Nhật ký không sửa được**: chỉ thêm, không xoá, giữ tối thiểu hết năm học.
- **Đặt máy chủ trong nước. [CẦN XÁC MINH]** yêu cầu lưu trữ dữ liệu tại Việt Nam theo Luật An ninh mạng và Nghị định 53/2022/NĐ-CP.
- Cấp xã/tỉnh chỉ thấy số tổng hợp.

## 6. Thông báo

| Sự kiện | Ai nhận | Kênh |
|---|---|---|
| Có yêu cầu đón hộ mới | Người đón hộ | SMS / Zalo ZNS (người ngoài danh sách chưa có app) + Web Push |
| Người đón nhận lời / từ chối | Phụ huynh, GV | Web Push |
| GV duyệt / từ chối | Phụ huynh, người đón | Web Push (+ SMS cho người đón) |
| Đã giao trẻ | Cả hai phụ huynh | Web Push + SMS |
| Sai PIN nhiều lần, chặn người trong danh sách cấm | Phụ huynh, GV, quản trị trường | Web Push + SMS |

Bản mẫu chưa gửi SMS thật: có "Hộp tin thử nghiệm" hiện các tin lẽ ra được gửi, kể cả mã OTP. Khi chạy thật nối với nhà mạng hoặc Zalo ZNS (cần hợp đồng, có phí theo tin).

## 7. Nền tảng kỹ thuật

- **Web app cài như app (PWA)**: một mã nguồn cho điện thoại và máy tính, cài được lên màn hình chính, có thông báo đẩy. Sau này đóng gói lên App Store / CH Play nếu cần.
- Next.js 15 + Prisma 6 + PostgreSQL. Bản mẫu chạy ở cổng web **3271**, CSDL Docker **3273** (block 3270–3279).
- Quét QR bằng camera điện thoại của GV (dùng tính năng có sẵn của trình duyệt), luôn có ô nhập PIN để dự phòng.
- Phiên đăng nhập bằng cookie ký HMAC, chỉ đặt từ máy chủ.

## 8. Phạm vi bản mẫu (MVP) và việc để sau

**Có trong bản mẫu**
- Đăng nhập SĐT + OTP (OTP hiện trong Hộp tin thử nghiệm).
- Phụ huynh: xem con, quản lý người tin cậy (ảnh + 4 số CCCD), người không được đón, tạo / huỷ yêu cầu, theo dõi tiến trình, xác nhận con đã về.
- Người đón hộ: nhận lời / từ chối, tự chụp ảnh khi là người ngoài danh sách, xem mã QR + PIN.
- Giáo viên: duyệt người tin cậy, danh sách yêu cầu trong ngày của lớp, duyệt / từ chối, màn giao trẻ (quét QR hoặc nhập PIN, đối chiếu, chụp ảnh bàn giao, "Không giao được").
- Nhật ký đầy đủ, dữ liệu mẫu 34 tỉnh + 1 trường thử nghiệm.

**Để giai đoạn sau** (cần Sếp quyết và có đối tác thật)
- Gửi SMS / Zalo ZNS thật, thông báo đẩy thật trên iPhone.
- Màn quản trị trường đầy đủ (nhập học sinh từ Excel, phân công GV trực cổng).
- Báo cáo tổng hợp cho Phòng / Sở GD&ĐT.
- Danh sách xã/phường đầy đủ của 34 tỉnh.
- Đăng nhập VNeID, kết nối CSDL ngành.
- Thử tải, đánh giá bảo mật độc lập, hồ sơ đánh giá tác động dữ liệu cá nhân.

## 9. Câu hỏi cần hỏi nhà trường khi đem bản mẫu đi thử

1. Ai là người giao trẻ tại cổng: GV chủ nhiệm hay GV trực? Có cần màn "toàn trường" cho bảo vệ?
2. Trường có cho phép người ngoài danh sách tin cậy đón không?
3. Khung giờ đón của từng khối, và giờ chót nhận yêu cầu?
4. Trường đang dùng phần mềm quản lý học sinh nào (để nhập dữ liệu sang)?
5. Phụ huynh nào không dùng điện thoại thông minh — có cần kênh SMS thuần không?
