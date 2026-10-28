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
2. Người đón có phí đã duyệt **cùng lớp** thấy ngay; người đón có phí lớp khác trong trường chỉ được báo khi lời nhờ lên **vòng trường** (mục 3.12). Bảng việc (`/kiem-tien`) chỉ hiện lớp, giờ, phường/xã, mức tối thiểu, số tiền thực nhận dự kiến — **không hiện tên bé**.
3. Người nhờ chọn một người → tạo yêu cầu "ngoài danh sách" như cũ: người đón nhận lời → **cô gọi xác minh với phụ huynh** rồi duyệt → kiểm mã/ảnh/CCCD tại cổng → phụ huynh xác nhận bé về an toàn. **Không bỏ bước an toàn nào.**
4. Bé về an toàn → trang yêu cầu hiện thẻ "Gửi lời cảm ơn": phụ huynh để nguyên mức tối thiểu hoặc **tự tăng số tiền** (không thấp hơn mức đã hứa, tối đa 1.000.000đ để tránh gõ thừa số 0), bấm Tạo mã → mã VietQR theo số đó, nội dung "DONHO xxxxxx CAM ON", kèm lời cảm ơn tuỳ chọn → "Tôi đã chuyển khoản".
5. Người đón bấm "Đã nhận tiền" (nếu phụ huynh quên báo thì bấm này cũng tính là đã trả); chưa nhận được có thể "Nhắc phụ huynh" tối đa 1 lần/24 giờ.

**Phí nền tảng:** 10% **[GIẢ ĐỊNH]** (biến `PLATFORM_FEE_RATE`) tính trên **số thực chuyển**, làm tròn nghìn. Người đón tự nộp định kỳ bằng VietQR tới tài khoản nền tảng (`PLATFORM_BANK_*`) rồi bấm "Tôi đã nộp phí". Nợ từ 300.000đ **và** có khoản quá 30 ngày → tạm không nhận việc có phí mới tới khi nộp. Việc đối soát sao kê nền tảng **chưa có màn quản trị** (để sau).

**Không làm:** app không giữ tiền, không thu hộ, không trả trước; không đòi thêm ngoài mức đã hứa; người đón có phí không thấy tên bé trước khi được chọn.

**[CẦN XÁC MINH] pháp lý:** (a) không giữ tiền nên nhiều khả năng không phải trung gian thanh toán, cần luật sư xác nhận; (b) thu nhập của người đón và phí nền tảng — nghĩa vụ thuế TNCN/hoá đơn; (c) đưa đón trẻ có thu tiền có cần đăng ký kinh doanh/điều kiện gì không; (d) mã ngân hàng (BIN NAPAS) trong `src/domain/vietqr.ts` và việc app ngân hàng thật quét được mã — **chưa thử bằng app ngân hàng thật**.

### 3.9. Thành viên ưu đãi (bổ sung 27/10)

Sếp chọn: áp cho **cả người nhờ đón và người nhận đón**; **người không đóng phí vẫn dùng đủ dịch vụ thông thường**; người đóng phí nhận gói ưu đãi theo hạng. Một tài khoản phụ huynh có một hạng, dùng cho cả hai vai.

| Hạng | Giá/tháng **[GIẢ ĐỊNH]** | Phí nền tảng khi nhận đón | Người đón giúp mình chịu phí | Điểm trả hay dùng | Hạn mức nợ phí | Lời nhờ nổi bật trên bảng việc trường | Ưu tiên trong nhóm lớp |
|---|---|---|---|---|---|---|---|
| Thường | 0đ | 10% | 10% | 5 | 300.000đ · 30 ngày | — | — |
| Bạc | 39.000đ | 7% | 7% | 10 | 500.000đ · 45 ngày | — | — |
| Vàng | 69.000đ | 5% | 5% | 20 | 800.000đ · 60 ngày | Có | Trước người cùng hạng tương trợ |
| Kim cương | 129.000đ | 3% | 3% | 30 | 1.200.000đ · 60 ngày | Có | Trước người cùng hạng tương trợ |

- Đóng 12 tháng tính giá 10 tháng. Phí một lượt có phí = **mức thấp hơn** giữa hạng người đón và hạng người nhờ (người nhờ là thành viên thì người đón nhận nhiều hơn → lời nhờ dễ có người nhận). Không vượt mức gốc `PLATFORM_FEE_RATE`.
- Mua: chọn hạng + 1/12 tháng → VietQR tới tài khoản nền tảng → "Tôi đã chuyển khoản" → **có hiệu lực ngay**, trạng thái "Chờ đối soát" (`CHO_DOI_SOAT`); đối soát không thấy tiền thì đổi sang `HUY` là mất hiệu lực. **Chưa có màn đối soát** cho nền tảng.
- Gia hạn cùng hạng nối tiếp sau gói đang chạy; nâng hạng có hiệu lực ngay; mua hạng thấp hơn khi đang có hạng cao thì chờ gói cao hết hạn.
- **Luôn miễn phí:** nhờ đón (tin cậy/ngoài danh sách), cô duyệt, QR/PIN, kiểm ảnh + CCCD, ảnh bàn giao, bản đồ, điểm trả, nhóm lớp, điểm tương trợ, đăng ký và nhận đón có phí.
- **Không mua được:** bỏ qua bước an toàn nào; hạng người đón **không hiện** cho phụ huynh nhờ (tiền không phải lý do để tin một người đón); vượt hạng tương trợ trong nhóm lớp.
- **[CẦN XÁC MINH]:** chính sách hoàn tiền, xuất hoá đơn cho phí thành viên, thuế; điều khoản dịch vụ.

### 3.10. Đón theo tháng (bổ sung 27/10)

Một người đón có phí **cố định** cho các buổi trong tháng. Sếp chọn: ưu tiên người đón hạng **Kim cương** khi phụ huynh không chỉ định; tiền **trọn gói đầu tháng**; cô **duyệt hợp đồng một lần**, cổng vẫn kiểm mỗi buổi.

**Luồng:**
1. Phụ huynh tạo hợp đồng: bé, tháng (tháng này từ ngày mai, hoặc tháng sau), các thứ trong tuần (T2–T7), thù lao trọn gói (tối thiểu 20.000đ × số buổi), điểm trả cố định (chọn từ điểm hay dùng), lời nhắn.
2. Chọn người đón, một trong hai cách:
   - **Chỉ định**: nhập số điện thoại một người đón có phí **đã được duyệt cùng trường**. Người đó nhận lời hoặc từ chối.
   - **Mở cho cả trường**: hợp đồng lên bảng việc (mục Kiếm thêm), không lộ tên bé. **24 giờ đầu chỉ người đón hạng Kim cương nhận được**; app báo trước cho người Kim cương. Sau 24 giờ mọi người đón đã duyệt đều nhận được. Phụ huynh chọn một người trong danh sách.
3. Cô lớp của bé **duyệt một lần** cho cả tháng: xem ảnh, CCCD, tình trạng duyệt của người đón; **bắt buộc tích "đã gọi điện xác minh phụ huynh"**.
4. Phụ huynh chuyển **trọn gói** bằng VietQR **thẳng cho người đón**, bấm "Tôi đã chuyển khoản" (hoặc người đón bấm "Đã nhận tiền"). Chưa trả thì app chưa tạo mã đón.
5. **Mỗi buổi** app tự tạo một yêu cầu đón hộ ở trạng thái **Đã duyệt**, có **mã QR/PIN mới**; người đón nhận tin nhắn. Tại cổng cô vẫn quét mã, đối chiếu khuôn mặt, CCCD bản gốc, bé nhận ra người đón; phụ huynh vẫn bấm "Con đã về an toàn". Buổi không tạo nếu phụ huynh đã tự nhờ người khác cho ca đó, hoặc người đón bị tạm dừng.
6. Hết tháng hợp đồng tự kết thúc.

**Huỷ, nghỉ, dừng sớm, hoàn tiền:**

| Tình huống | Ai làm | Hoàn tiền cho phụ huynh |
|---|---|---|
| Phụ huynh huỷ một buổi (bé nghỉ học…) | Phụ huynh | Không — người đón đã giữ lịch **[GIẢ ĐỊNH]** |
| Người đón báo nghỉ một buổi | Người đón | Có — buổi đó; phụ huynh + cô được báo ngay để nhờ người khác, mã buổi đó (nếu đã tạo) bị huỷ |
| Người đón dừng hợp đồng | Người đón | Mọi buổi còn lại, kể cả hôm nay (mã hôm nay bị huỷ) |
| Phụ huynh dừng hợp đồng | Phụ huynh | Các buổi còn lại **trừ 2 buổi báo trước [GIẢ ĐỊNH]**; buổi hôm nay vẫn đón |

- Số hoàn = trọn gói × số buổi được hoàn ÷ tổng số buổi, làm tròn nghìn. App **chỉ ghi sổ**: người đón tự chuyển lại, một trong hai bên bấm "Đã hoàn tiền".
- Người đón chưa hoàn tiền **quá 7 ngày** → tạm không nhận việc có phí mới (cả lượt lẻ và hợp đồng tháng).
- Phí nền tảng tính trên trọn gói theo hạng hai bên (mức thấp hơn), chốt lúc trả; dừng sớm thì tính lại trên số thực giữ (trọn gói − hoàn), nếu chưa nộp phí. Đón theo tháng **không cộng điểm tương trợ**.

**Rủi ro — mâu thuẫn với nguyên tắc "không trả trước":** đón có phí từng lượt trả **sau** khi bé về; đón theo tháng trả **trước** theo lựa chọn của Sếp. App không giữ tiền nên **không bảo đảm hoàn tiền**: nếu người đón bỏ ngang và không trả lại, phụ huynh chỉ có biện pháp app chặn người đó nhận việc + báo nhà trường. Cách giảm rủi ro nên cân nhắc khi thí điểm: cho trả theo nửa tháng; giới hạn trọn gói tối đa; chỉ cho người đón có lịch sử tốt nhận hợp đồng tháng. **[CẦN XÁC MINH với luật sư]**: hợp đồng dịch vụ giữa hai phụ huynh, trách nhiệm hoàn tiền, thuế thu nhập người đón.

**Quản lý riêng (bổ sung 27/10):** buổi sinh từ hợp đồng tháng **không lẫn** vào danh sách nhờ đón lẻ của phụ huynh, cô và người đón. Mỗi trang chủ có thẻ riêng "Đón theo tháng hôm nay"; cổng trường có nhóm "Đón theo tháng" riêng nhưng vẫn kiểm mã/PIN, ảnh, CCCD như mọi buổi. Trang `/thang` có bộ lọc: Tất cả · Buổi hôm nay · Đang chạy · Đang chờ · Đã xong. Mỗi buổi gắn nhãn "Theo tháng" thay cho nhãn "Ngoài danh sách". Hai việc an toàn vẫn gộp chung: "Người đón đã tới cổng" (trang cô) và "Bé đã được giao — chờ bạn xác nhận" (trang phụ huynh). Lời nhờ đón lẻ giữ nguyên mọi quy tắc cũ; nếu trùng ca đã có buổi theo tháng thì báo rõ cần huỷ buổi đó ở trang hợp đồng trước.

**Chưa làm (đón theo tháng):** đặt lịch chạy tự động hằng ngày (bản mẫu tạo buổi khi có người mở app); gia hạn sang tháng sau một chạm; đổi người đón giữa tháng (hiện phải dừng và tạo hợp đồng mới).

### 3.11. Đăng ký tài khoản theo khu vực và trường (bổ sung 27/10)

Sếp chọn: phụ huynh **tự đăng ký, cô xác nhận con**; địa bàn **chọn từ danh sách, thiếu thì gõ tay**.

1. Trang `/dang-ky`: họ tên, số điện thoại, **Tỉnh/Thành → Phường/Xã/Đặc khu → Trường → Lớp**, họ tên bé, quan hệ (Bố/Mẹ/Ông/Bà/Người giám hộ). Thiếu phường/xã thì gõ tay (phải bắt đầu bằng "Phường/Xã/Đặc khu"), lưu dạng **chưa xác minh** và chỉ hiện cho người gõ; thiếu trường thì ghi tên trường để quản trị thêm sau.
2. Nhận mã 6 số qua tin nhắn → tạo tài khoản + **yêu cầu xác nhận con** (chờ cô). Số đã có tài khoản thì chỉ đăng nhập. Trang đăng nhập không tiết lộ số nào đã đăng ký.
3. Cô lớp đó vào **"Xác nhận phụ huynh mới"** (`/giao-vien/phu-huynh-moi`): gọi điện cho phụ huynh, chọn đúng bé trong lớp (hoặc thêm bé mới), **bắt buộc tích "đã gọi điện xác minh"** rồi duyệt; từ chối phải ghi lý do. Duyệt xong mới thành phụ huynh của bé, vào nhóm lớp, nhờ đón được.
4. Đăng nhập lại thì app hiện đúng khu vực của mình (thanh khu vực trên đầu trang); trang `/khu-vuc` để đổi nơi sống, xin xác nhận thêm bé, xem trường gần mình. Mỗi người tối đa 5 yêu cầu đang chờ.

Nơi sống của phụ huynh dùng cho vòng "khu vực sống" ở mục 3.12. **[CẦN XÁC MINH]:** danh sách phường/xã chính thức đủ 34 tỉnh; màn quản trị duyệt phường/xã và trường gõ tay.

### 3.12. Quy tắc phát lời nhờ đón hộ: lớp → trường → khu vực sống (bổ sung 27/10)

Lời nhờ đón hộ đi **từ gần tới xa**, chỉ mở rộng khi **chưa ai nhận**:

| Vòng | Ai được báo và nhận | Thấy gì |
|---|---|---|
| 1. Nhóm lớp | Nhắn **thẳng tới từng phụ huynh cùng lớp** + cô lớp (ngay khi đăng) | Đủ thông tin như mục 3.6 |
| 2. Cả trường | Phụ huynh có con ở lớp khác cùng trường (+ người đón có phí đã duyệt của trường nếu lời nhờ có thù lao) | Lớp, giờ, phường/xã trả bé, mức thù lao — **không tên bé, không số nhà** |
| 3. Khu vực sống | Phụ huynh (đã được cô xác nhận con, trường khác) **sống cùng phường/xã** với người nhờ | Như vòng 2 + tên trường |

- **Thời gian chờ mỗi vòng [GIẢ ĐỊNH]:** còn ≥6 giờ tới giờ đón → 30 phút; 2–6 giờ → 15 phút; dưới 2 giờ → 5 phút.
- Đã có người bấm "Tôi đón giúp được" thì **dừng mở rộng**; quá giờ đón thì thôi.
- Người nhờ có nút **"Gửi … ngay"** để mở rộng sớm, mỗi lần một vòng, đúng thứ tự.
- **Lời nhờ có thù lao dừng ở vòng trường** (người đón có phí được duyệt theo trường).
- Người nhờ chưa chọn khu vực sống thì lấy phường/xã của trường; lời nhờ đăng trước khi có quy tắc này không có vòng khu vực.
- Người vòng ngoài thấy ở mục **"Lời nhờ quanh bạn"** trong trang Nhóm lớp. Khi được chọn, yêu cầu vẫn là "ngoài danh sách" (quan hệ ghi "Phụ huynh cùng trường" / "cùng khu vực sống"): người đón tự chụp ảnh + khai CCCD, cô gọi xác minh rồi duyệt, cổng vẫn kiểm. **Không bỏ bước an toàn nào.**
- Mỗi lần chuyển vòng ghi nhật ký `MO_RONG_LOI_NHO`, báo người nhờ.

**Giới hạn bản mẫu:** việc mở rộng chạy khi có người mở app (chưa có lịch chạy nền), nên trong giờ vắng có thể chậm hơn thời gian chờ. Trước khi chạy thật cần một tác vụ định kỳ mỗi phút. Phần "lời nhắn" do người nhờ tự gõ vẫn hiện ở vòng ngoài — nên nhắc phụ huynh không ghi tên bé, địa chỉ vào đó.

### 3.13. Giới thiệu bạn bè và chia sẻ doanh thu với nhà trường, giáo viên (bổ sung 28/10)

Sếp chọn: người giới thiệu nhận **tín dụng 20% trong 12 tháng**; phần của giáo viên **chuyển trực tiếp cho cô**; giáo viên **được làm người giới thiệu như mọi người dùng**.

**Nguồn chia — chỉ tiền mặt nền tảng thực thu:** phí thành viên và phí nền tảng người đón nộp (lượt có phí + đón theo tháng). Phần trả bằng tín dụng giới thiệu **không** chia (tránh vòng tín dụng sinh tín dụng). Ghi sổ ngay lúc thu, trong cùng giao dịch.

| Ai | Tỉ lệ **[GIẢ ĐỊNH]** | Tính trên | Nhận dạng gì |
|---|---|---|---|
| Người giới thiệu | 20% | Tiền nền tảng thu từ người được giới thiệu, 12 tháng kể từ ngày đăng ký | Tín dụng trừ phí thành viên / phí nền tảng; không rút tiền mặt, không chuyển nhượng |
| Nhà trường | 10% | Doanh thu phát sinh ở các lớp của trường | Chuyển khoản hằng tháng vào tài khoản trường |
| Giáo viên lớp | 5% (lớp nhiều cô thì chia đều) | Doanh thu phát sinh ở lớp | Chuyển khoản hằng tháng vào tài khoản đứng tên cô |

Nền tảng giữ lại 65–85% tuỳ có người giới thiệu hay không.

**Doanh thu tính cho lớp nào:** phí thành viên → lớp có con của người mua (nhiều con ở nhiều lớp thì chia đều); phí nền tảng của một lượt đón → **lớp của bé được đón** (không phải lớp con người đón).

**Giới thiệu:**
- Mỗi người có mã 6 ký tự + liên kết `/dang-ky?ma=…` (trang `/gioi-thieu`). Nhập mã lúc đăng ký, hoặc bổ sung trong **7 ngày đầu**.
- Một người một người giới thiệu; không tự giới thiệu; không giới thiệu chéo hai chiều.
- Tín dụng dùng được sau **7 ngày** (để đối soát). App tự trừ khi mua gói thành viên và khi nộp phí nền tảng; đủ thì không cần chuyển khoản.
- Gói thành viên bị huỷ khi đối soát → tín dụng sinh ra từ nó mất, tín dụng đã dùng cho nó được trả lại.

**Nhà trường và giáo viên** (trang `/chia-se`):
- Phần chia **không tính theo lượt cô duyệt**: duyệt hay từ chối không làm tăng hay giảm. Cô vẫn bắt buộc gọi xác minh, kiểm tại cổng như mọi lần.
- Ban giám hiệu **tắt được phần của giáo viên** → phần đó gộp về quỹ trường (áp từ lúc đổi, phần đã phát sinh giữ nguyên). Lớp chưa có cô thì phần đó cũng vào trường.
- Cô khai tài khoản **đứng tên chính mình**; trường khai tài khoản của trường.
- Tạm tính trong tháng; **từ ngày 8 tháng sau** quản trị nền tảng (`ADMIN_PHONES`) thấy khoản đến hạn ở `/quan-tri/chia-se` kèm VietQR, chuyển khoản rồi bấm "Đã chuyển" → người nhận được báo.

**Rủi ro — xung đột lợi ích (Sếp chọn trả trực tiếp cho cô):** cô là người duyệt người đón. Dù phần của cô không theo lượt duyệt, lớp càng nhiều lượt đón có phí thì cô càng có thêm thu nhập — động cơ gián tiếp để dễ dãi. Chốt giảm rủi ro đã làm: không tính theo lượt duyệt; bước gọi xác minh vẫn bắt buộc; nhà trường tắt được. Nên cân nhắc thêm khi thí điểm: trần tối đa mỗi cô mỗi tháng; nhà trường xem nhật ký duyệt; tạm giữ phần của cô nếu có sự cố an toàn.

**[CẦN XÁC MINH]:** (a) giáo viên trường **công lập** nhận khoản tiền từ doanh nghiệp gắn với học sinh của lớp mình có vi phạm quy định đạo đức nhà giáo / phòng chống tham nhũng không — hỏi phòng giáo dục và luật sư trước khi bật; (b) khấu trừ thuế TNCN khi trả cho giáo viên, chứng từ chi; (c) hợp đồng/thoả thuận chia sẻ với nhà trường; (d) tín dụng giới thiệu có tính là khuyến mại phải đăng ký không.

**Chưa làm:** màn đối soát sao kê (huỷ gói không thấy tiền — hiện chỉ đổi trạng thái trong DB); trần phần chia mỗi cô; báo cáo chi tiết từng khoản cho trường.

### 3.14. Nhóm góp chi phí ô tô (giai đoạn 2 — CHƯA LÀM, chờ luật sư)

Sếp chọn 28/10: ô tô đón nhiều bé đi theo hình thức **nhóm phụ huynh góp chi phí xe**, người lái **không có lãi**. Không trả công bằng điểm thưởng hay sản phẩm quy đổi được (luật xét bản chất: vẫn là thù lao, và nền tảng sẽ thành bên thu tiền rồi trả công).

**Nhóm xe:**
- Một phụ huynh lái (đã được cô duyệt như người đón có phí, khai thêm biển số, ảnh xe, số ghế) + các bé cùng trường đi chung tuyến.
- Số bé tối đa = số chỗ hợp lệ cho trẻ theo luật giao thông (trẻ nhỏ không ngồi ghế trước, có thiết bị an toàn) **[CẦN XÁC MINH điều khoản]** — xe 5 chỗ thực tế khoảng 3 bé, xe 7 chỗ khoảng 5 bé.
- Mỗi bé vẫn có cô lớp của bé duyệt một lần, cổng vẫn kiểm mã/ảnh/CCCD người lái như mọi buổi.

**Mức góp có trần (không lãi):**
- Trần mỗi tháng = quãng đường tuyến (km/ngày) × đơn giá chi phí xe mỗi km **[GIẢ ĐỊNH — app đặt mức, người lái không tự đặt giá]** × số buổi ÷ số bé, làm tròn nghìn.
- Phụ huynh chuyển thẳng cho người lái bằng VietQR như đón theo tháng; app chỉ ghi sổ.
- Có thu phí dịch vụ của nền tảng hay không: **chờ luật sư** — thu phí có thể làm nhóm góp mất tính không vụ lợi.

**Xác nhận từng bé xuống xe (chống bỏ quên trẻ):**
- Mỗi điểm trả, người lớn nhận bé quét mã hoặc bấm "Đã nhận bé".
- Chuyến **không đóng được** khi chưa đủ số bé đã được nhận; quá giờ dự kiến mà còn bé chưa xác nhận → báo ngay cho cô và phụ huynh của bé đó.
- Tính năng này **miễn phí**, là lằn ranh an toàn.

**[CẦN XÁC MINH trước khi làm]:** góp chi phí có thoát diện kinh doanh vận tải và quy định xe đưa đón học sinh (Luật TTATGT đường bộ 2024) không; trách nhiệm của người lái khi tai nạn; bảo hiểm.

### 3.15. Hệ thống tự bán — trường tự mở, phễu, nhắc việc (bổ sung 28/10)

Mục tiêu: không cần người đi bán từng trường. Nhà trường, cô giáo và phụ huynh tự kéo nhau vào app; quản trị chỉ gọi xác minh và theo dõi phễu.

**Các trang:**
- `/` (chưa đăng nhập): trang giới thiệu cho 3 đối tượng — phụ huynh bận, phụ huynh hay đi đón, nhà trường. Chỉ nói điều app làm được, không số liệu hay lời khen bịa.
- `/mo-truong`: nhà trường tự mở trường (họ tên, SĐT + mã xác minh, tỉnh → phường/xã, tên trường, địa chỉ). Người mở thành ban giám hiệu. Không mở trùng tên (đã bỏ dấu, "MN" = mầm non) trong cùng phường/xã. Đường dẫn `?phuong=&ten=` để phụ huynh gửi trường có điền sẵn.
- `/truong` (ban giám hiệu): bước của trường, việc tiếp theo, thêm lớp (tên + giờ đón), thêm/bỏ cô bằng số điện thoại (số chưa có tài khoản thì tạo sẵn, gửi tin mời đăng nhập).
- `/truong/lop/[id]` (cô lớp + ban giám hiệu): bộ khởi động — đường dẫn đăng ký `/dang-ky?lop=` điền sẵn tỉnh/phường/trường/lớp, áp phích QR in dán cửa lớp, tin mẫu gửi nhóm Zalo phụ huynh, tin mời "người đón tiên phong". Trang cô có nút "Mời phụ huynh".
- `/khu-vuc` (phụ huynh đã đề xuất trường chưa có): tin mời nhà trường để tự gửi.
- `/quan-tri/truong` (quản trị nền tảng): số trường theo bước, danh sách chờ gọi xác minh, bảng tất cả trường, nhu cầu phụ huynh đề xuất (kèm tin mời), nhật ký nhắc việc.

**Bước của trường** (xét lần lượt; lượt đón và doanh thu tính 30 ngày gần nhất): Mới mở → Có cô → Có ≥ 5 phụ huynh → Có ≥ 2 người đón có phí đã duyệt → Có lượt đón → Có doanh thu.

**Phụ huynh đề xuất trường:** khi trường mở, phụ huynh cùng phường/xã đã đề xuất đúng tên được gắn trường và báo chọn lớp.

**Nhắc việc tự động** (`POST /api/nhac-viec` với `Authorization: Bearer CRON_SECRET`, hoặc nút trên trang quản trị). Mỗi loại × đối tượng tối đa 3 lần, cách nhau ≥ 7 ngày:
- trường mở ≥ 2 ngày chưa có cô → nhắc ban giám hiệu;
- trường mở ≥ 3 ngày, lớp có cô nhưng ít phụ huynh / thiếu người đón → nhắc cô kèm bộ khởi động lớp;
- ≥ 3 phụ huynh cùng đề xuất một trường chưa có → nhắc từng người gửi đường dẫn mời trường.

**Chốt an toàn — trường tự mở là "chưa xác minh":** luồng miễn phí dùng ngay; **đón có phí** (đăng ký người đón có phí) và **chuyển chia sẻ doanh thu** chỉ mở khi quản trị gọi xác minh và bấm xác minh. Lý do: chặn trường giả mạo dùng tiền làm mồi.

**Cố ý không làm:** đường dẫn lớp **không** gắn mã giới thiệu của cô (nếu gắn, cô nhận 20% tín dụng từ cả lớp — chồng thêm xung đột lợi ích lên phần 5%). Tin mẫu không hứa "miễn phí nền tảng 3 tháng" vì app chưa có cơ chế đó.

**Chưa làm:** đặt lịch cron thật trên máy chủ; gửi tin qua Zalo ZNS thật (đang Hộp tin thử nghiệm); miễn phí nền tảng cho người đón tiên phong; báo cáo chuyển đổi theo nguồn (áp phích / Zalo / phụ huynh mời).

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
