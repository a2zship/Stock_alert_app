# Kế hoạch kinh doanh — Đón Hộ

*Bản 27/10/2026 · tên miền đề xuất: donho.vn (+ beve.vn) · bản mẫu: `app/` (51/51 test)*

> **Nhãn dùng trong tài liệu:** **[ĐÃ KIỂM]** = có nguồn hoặc đã chạy thử trong dự án · **[GIẢ ĐỊNH]** = con số đặt ra để tính, phải kiểm bằng thí điểm · **[CẦN XÁC MINH]** = cần chuyên gia hoặc đối tác xác nhận trước khi hành động.

---

## 0. Kết luận trước

1. **Bán cho trường, không bán cho phụ huynh.** Ứng dụng chỉ chạy được khi cô giáo duyệt và kiểm người đón tại cổng, nên nhà trường bắt buộc phải tham gia. Vì vậy người trả tiền nên là trường. Phụ huynh dùng miễn phí.
2. **Bắt đầu từ trường mầm non tư thục ở Cần Thơ, sau đó mở sang TP.HCM.** Lý do:
   - Trường tư tự quyết nhanh, có ngân sách.
   - "Đón trẻ an toàn" là lợi thế để họ tuyển sinh.
   - Trường công phải qua mua sắm công và phải được Sở đồng ý, nên để giai đoạn sau.
3. **Giá dự kiến 15.000đ/trẻ/tháng**, thu 10 tháng mỗi năm học. Đây là **[GIẢ ĐỊNH]**, kế hoạch đứng hay sụp chủ yếu nằm ở con số này:
   - Với chi phí cố định ở năm thứ 3, nếu trường chỉ chịu trả dưới khoảng 9.000đ thì mô hình không có lãi, kể cả khi có 300 trường.
   - Việc **đầu tiên** cần làm là hỏi giá thật ở 10–15 trường.
4. **Tài chính theo kịch bản cơ sở:**
   - Lỗ khoảng 0,5 tỷ ở năm thứ 1, gần hoà vốn ở năm thứ 2, lãi khoảng 2,8 tỷ ở năm thứ 3 với khoảng 500 trường.
   - Cần chuẩn bị khoảng **0,6 tỷ** để chạy hết 2 năm đầu.
   - Mọi con số đều là giả định (xem mục 8).
5. **Phải rà pháp lý trước khi thu tiền.** Ứng dụng xử lý dữ liệu trẻ em, chịu Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP, cả hai có hiệu lực từ 01/01/2026 **[ĐÃ KIỂM]**. Cần luật sư rà trước khi thí điểm có thu phí.

---

## 1. Bài toán và giá trị cho từng bên

**Bài toán:** bố mẹ bận đột xuất thì nhờ ông bà, hàng xóm hay phụ huynh cùng lớp đón con. Hiện việc này thường làm qua điện thoại hoặc tin nhắn Zalo cho cô giáo. Cô phải tự nhận mặt người đón, không có bằng chứng giao trẻ, và không ai theo dõi được bé đã về tới nhà chưa.

| Bên | Đau ở đâu | Đón Hộ giải quyết thế nào |
|---|---|---|
| **Phụ huynh** | Lo bé bị giao nhầm người; phải gọi điện nhiều bên | Nhờ đón trong 1 phút; có bản đồ theo dõi; nhận tin khi bé đã được giao và khi bé về tới nơi; có nhóm lớp để nhờ nhau đón |
| **Cô giáo** | Chịu trách nhiệm nếu giao nhầm; tin nhắn nằm rải rác | Duyệt trên một màn hình; tại cổng kiểm 4 lớp (mã QR/PIN, ảnh, 4 số cuối CCCD, ảnh bàn giao); có nhật ký làm bằng chứng |
| **Nhà trường** | Rủi ro uy tín và pháp lý khi xảy ra sự cố giao trẻ | Có quy trình chuẩn, nhật ký không sửa được; "đón trẻ an toàn" thành điểm cộng khi tuyển sinh |
| **Người đón hộ** | Ngại vì không rõ thủ tục ở cổng | Nhận mã đón trên điện thoại; được cộng điểm tương trợ và nhận lời cảm ơn |

**Điểm khác biệt chính:** ba bên cùng xác nhận, kiểm người đón tại cổng, và chỉ thu dữ liệu tối thiểu: không lưu địa chỉ nhà trong hồ sơ trẻ, điểm trả khai theo từng lần và tự xoá khi xong. Những tính năng này đã có trong bản mẫu **[ĐÃ KIỂM]**.

---

## 2. Thị trường

| Chỉ số | Số liệu | Nguồn |
|---|---|---|
| Trẻ mầm non đi học | ~5,12 triệu (năm học 2023–2024) | giaoduc.net.vn **[ĐÃ KIỂM — số cũ 1 năm]** |
| Cơ sở mầm non | 15.256, trong đó **3.184 ngoài công lập** | giaoduc.net.vn |
| Trẻ mầm non học ngoài công lập | **~1,28 triệu (24,9%)** | giaoduc.net.vn |
| Học sinh tiểu học | ~8,9 triệu, 11.559 trường (năm học 2025–2026) | lsvn.vn, theo Vụ GDPT – Bộ GD&ĐT |

**Quy mô tiền:**
- **Trần lý thuyết của phân khúc đầu tiên** (toàn bộ trẻ mầm non ngoài công lập × 15.000đ × 10 tháng): khoảng **191 tỷ/năm**.
- **Thực tế đạt được trong 3 năm:** khoảng 1–6% phân khúc này, tương ứng 2–11 tỷ/năm.
- **Kịch bản cơ sở năm thứ 3:** khoảng 75.000 trẻ, bằng khoảng 6% phân khúc.

**Vì sao chọn mầm non trước tiểu học:**
- Trẻ mầm non luôn phải có người lớn đón tận tay, nên cần ứng dụng nhất.
- Trường tư nhiều nhưng nhỏ, quyết định nhanh.
- Tiểu học là bước mở rộng tự nhiên. Học sinh lớp 1–2 vẫn phải có người đón.

---

## 3. Khách hàng mục tiêu và thứ tự triển khai

| Giai đoạn | Khách hàng | Ai ra quyết định | Ai trả tiền | Lý do chọn |
|---|---|---|---|---|
| **1. Thí điểm (tháng 0–6)** | 3–5 trường mầm non tư ở Cần Thơ | Chủ trường / hiệu trưởng | Miễn phí 3 tháng, sau đó trả phí | Gần đội ngũ, hỗ trợ tận nơi được, thu dữ liệu thật |
| **2. Bán (tháng 6–18)** | Mầm non tư và tiểu học tư ở Cần Thơ và TP.HCM | Chủ trường | Trường (có thể thu lại qua học phí) | Có ngân sách, cạnh tranh tuyển sinh |
| **3. Mở rộng (tháng 18–36)** | Chuỗi trường tư; trường quốc tế; đối tác phần mềm quản lý trường | Ban điều hành chuỗi / đối tác | Trường hoặc chia doanh thu với đối tác | Một hợp đồng nhiều trường; tận dụng kênh phân phối có sẵn |
| **4. Khu vực công (sau 36 tháng)** | Trường công qua Phòng/Sở GD | Phòng/Sở GD&ĐT | Ngân sách chuyển đổi số **[CẦN XÁC MINH]** | Quy mô lớn nhưng chu kỳ bán dài, cần hồ sơ năng lực |

**Chân dung khách đầu tiên:**
- Trường mầm non tư 80–250 trẻ, giờ đón 16h30–17h30.
- Cô giáo đã quen dùng Zalo với phụ huynh.
- Từng có ít nhất một lần lộn xộn khi người lạ tới đón trẻ.

---

## 4. Mô hình doanh thu và giá

**Thu chính: phí theo số trẻ, nhà trường trả.**

| Gói | Giá **[GIẢ ĐỊNH]** | Gồm |
|---|---|---|
| Cơ bản | 10.000đ/trẻ/tháng | Nhờ đón, duyệt, kiểm tại cổng (QR/PIN, ảnh, CCCD), nhật ký, thông báo |
| **Tiêu chuẩn** *(gói chính)* | **15.000đ/trẻ/tháng** | Gói Cơ bản + bản đồ theo dõi, điểm trả theo từng lần, nhóm lớp, điểm tương trợ, báo cáo cho ban giám hiệu |
| Chuỗi trường | Thương lượng | Gói Tiêu chuẩn + màn quản trị nhiều cơ sở, xuất dữ liệu, hỗ trợ ưu tiên |

**Thu thêm từ "Đón hộ có phí" (bổ sung 27/10, chưa tính vào mô hình tài chính):** phụ huynh cùng trường đã được cô duyệt nhận đón có thù lao; người nhờ đặt mức tối thiểu và tự chuyển khoản VietQR thẳng cho người đón kèm lời cảm ơn. Nền tảng trích **10% số thực nhận [GIẢ ĐỊNH]**, người đón tự nộp định kỳ. Ước lượng thô: 5% số trẻ có 2 lượt có phí/tháng × 50.000đ × 10% ≈ **500đ/trẻ/tháng** — nhỏ so với phí trường (15.000đ); giá trị chính là giữ chân phụ huynh và làm nhóm lớp sôi động hơn, không phải nguồn thu chính **[GIẢ ĐỊNH, cần số thí điểm]**.

**Thu từ thành viên ưu đãi (bổ sung 27/10, chưa tính vào mô hình tài chính):** người không đóng phí vẫn dùng đủ dịch vụ; Bạc 39.000đ / Vàng 69.000đ / Kim cương 129.000đ mỗi tháng **[GIẢ ĐỊNH]**, 12 tháng giá 10 tháng. Ưu đãi chỉ về tiền và tiện lợi (giảm phí nền tảng còn 7/5/3%, lưu nhiều điểm trả, nới hạn mức nợ, lời nhờ nổi bật trên bảng việc trường), không đụng bước an toàn.
- Với người nhận đón, mỗi hạng có lời khi thu nhập từ đón có phí mỗi tháng vượt: Bạc khoảng 1,3 triệu (39.000đ ÷ 3% phí tiết kiệm), Vàng khoảng 1,38 triệu (69.000đ ÷ 5%), Kim cương khoảng 1,84 triệu (129.000đ ÷ 7%). Bạc chỉ có lợi hơn Vàng khi thu nhập dưới 1,5 triệu (30.000đ chênh ÷ 2% phí), nên đa số người mua sẽ chọn thẳng Vàng. Gói trả phí hợp với người đón thường xuyên, không ép người đón thỉnh thoảng phải mua.
- Ước lượng thô: 3% phụ huynh mua, giá bình quân 60.000đ → khoảng 1.800đ/trẻ/tháng, cộng thêm vào 15.000đ phí trường **[GIẢ ĐỊNH, cần số thí điểm]**. Mua gói làm giảm khoản trích 10% từ đón có phí, nên hai nguồn thu một phần ăn vào nhau.
- Rủi ro: phụ huynh coi việc trả phí là "trường thu thêm tiền" → nói rõ phần miễn phí đủ dùng; cần chính sách hoàn tiền + hoá đơn **[CẦN XÁC MINH]**.

**Các khoản thu phụ (chưa tính vào mô hình tài chính):**
- Phí cài đặt và tập huấn: 1–3 triệu/trường.
- Đối tác tài trợ quyền lợi trong khung điểm tương trợ, ví dụ bảo hiểm hay hiệu sách. Khoản này chỉ làm khi trường đồng ý và đúng quy định quảng cáo trong trường học **[CẦN XÁC MINH]**.

**Không làm:**
- Không thu phí phụ huynh **người nhờ** theo lượt nhờ đón. Thu phí sẽ khiến phụ huynh quay lại gọi điện, làm mất đúng giá trị an toàn của ứng dụng. (Phí 10% của đón có phí trích từ thu nhập **người đón**, người nhờ chỉ trả thù lao họ tự đặt.)
- Không giữ hộ tiền, không thu hộ — tiền đi thẳng từ người nhờ sang người đón.
- Không bán dữ liệu.
- Không cho điểm tương trợ đổi ra tiền.

---

## 5. Đối thủ và giải pháp thay thế

| Giải pháp | Điểm mạnh | Thiếu gì so với Đón Hộ |
|---|---|---|
| **Gọi điện / nhắn Zalo cho cô** (cách phổ biến nhất) | Miễn phí, ai cũng biết dùng | Không xác minh người đón, không có bằng chứng, cô bị quá tải |
| **Phần mềm quản lý mầm non** (ví dụ KidsOnline, khoảng 1.200 trường) | Đã có mặt ở trường; thu phí theo đầu trẻ | Chưa thấy công bố tính năng xác nhận người đón 3 bên và kiểm tại cổng **[CẦN XÁC MINH khi làm việc trực tiếp]** |
| **Ứng dụng xe đưa đón** (Babi2School, School Bus) | Quản lý tuyến xe, tài xế | Phục vụ xe của trường, không phục vụ người thân đón hộ |
| **Giấy uỷ quyền đón trẻ** | Đơn giản | Làm thủ công, không dùng được khi có việc đột xuất |

**Nhận định:**
- Đối thủ thật là **thói quen gọi điện miễn phí**.
- Rủi ro lớn nhất về cạnh tranh là các phần mềm quản lý trường có sẵn sao chép tính năng.
- Hướng xử lý: **chủ động làm đối tác với họ**, cung cấp Đón Hộ như một phần gắn thêm, thay vì đối đầu.

---

## 6. Bán hàng và tiếp thị

### 90 ngày đầu
1. **Tuần 1–2:**
   - Rà pháp lý (mục 9).
   - Đăng ký tên miền donho.vn và beve.vn.
   - Viết điều khoản sử dụng và mẫu đồng ý của phụ huynh.
2. **Tuần 2–4:** phỏng vấn **10–15 chủ trường mầm non tư** ở Cần Thơ, mỗi buổi 30 phút, gồm 4 câu:
   - Tháng vừa rồi có bao nhiêu lần người lạ tới đón trẻ?
   - Hiện trường đang xử lý những lần đó thế nào?
   - Nếu có công cụ này, trường trả bao nhiêu tiền cho mỗi trẻ mỗi tháng?
   - Ai trong trường là người quyết định mua?
3. **Tháng 2–3:**
   - Thí điểm miễn phí ở 3–5 trường.
   - Ở mỗi trường: tập huấn cô giáo 1 buổi, gửi phụ huynh tờ hướng dẫn kèm mã QR.
   - Đội ngũ có mặt ở cổng trong tuần đầu.
4. **Cuối tháng 3:** chuyển sang thu phí, hoặc dừng lại (xem điều kiện ở mục 10).

### Từ tháng 4 đến tháng 18
- **Bán trực tiếp:** 1 người bán, dùng câu chuyện thật của các trường thí điểm (có số liệu: số lần đón hộ, không lần nào giao nhầm).
- **Lan truyền qua phụ huynh:** phụ huynh trường đã dùng nói với trường của con em mình. Nhóm lớp và điểm tương trợ tự kéo người dùng mới.
- **Nội dung:** đưa lên kênh "Tôi là AI" và Fanpage.
  - Chủ đề gợi ý: video hướng dẫn "đón con an toàn khi bận đột xuất".
  - Nội dung viết cho phụ huynh, không viết quảng cáo.
- **Hội chủ trường mầm non tư:** tài trợ một buổi chia sẻ về an toàn đón trẻ.

### Từ tháng 18 trở đi
- Làm đối tác với phần mềm quản lý trường và chuỗi trường.
- Làm hồ sơ năng lực để chuẩn bị bước vào khu vực công.

---

## 7. Vận hành và đội ngũ

| Vai trò | Năm 1 | Năm 2 | Năm 3 |
|---|---|---|---|
| Phát triển sản phẩm | 1 | 2 | 3 |
| Bán hàng + chăm sóc trường | 1 | 2 | 4 |
| Hỗ trợ (tổng đài, tập huấn) | Kiêm nhiệm | 1 | 2 |
| Pháp lý / kế toán | Thuê ngoài | Thuê ngoài | Thuê ngoài |

**Hạ tầng:**
- Máy chủ đặt trong nước.
- Tin nhắn gửi qua Zalo ZNS hoặc SMS brandname; giá từng tin **[CẦN XÁC MINH với nhà cung cấp]**.
- Bản mẫu đã có Hộp tin thử nghiệm. Phải nối kênh tin nhắn thật và tắt `DEV_INBOX` trước khi chạy thật.

**Việc kỹ thuật còn thiếu trước khi bán:**
- Nối SMS/ZNS thật.
- Màn quản trị trường: nhập danh sách lớp, trẻ, cô giáo.
- Danh sách xã/phường đầy đủ.
- Thông báo đẩy trên điện thoại.
- Sao lưu dữ liệu và giám sát hệ thống.
- Kiểm thử bảo mật.

---

## 8. Tài chính 3 năm (kịch bản cơ sở)

**Giả định đầu vào [GIẢ ĐỊNH]:**
- 150 trẻ/trường; giá 15.000đ/trẻ/tháng; thu 10 tháng/năm.
- Chi phí tin nhắn khoảng 1.500đ/trẻ/tháng (khoảng 2 lần nhờ đón × 2 tin, cộng tin đăng nhập); máy chủ khoảng 300đ/trẻ/tháng.
- **Mỗi trường đóng góp khoảng 1,98 triệu/tháng** sau khi trừ chi phí biến đổi.

| | Năm 1 | Năm 2 | Năm 3 |
|---|---|---|---|
| Trường cuối năm (trẻ) | 30 (4.500) | 150 (22.500) | 500 (75.000) |
| Trường trả phí bình quân trong năm | 12 | 80 | 300 |
| **Doanh thu** | 270 tr | 1.800 tr | 6.750 tr |
| Chi phí biến đổi (tin nhắn, máy chủ) | 32 tr | 216 tr | 810 tr |
| Chi phí cố định (người, tiếp thị, pháp lý) | 740 tr *(55 tr/tháng + 80 tr một lần)* | 1.610 tr *(130 tr/tháng + 50 tr)* | 3.170 tr *(260 tr/tháng + 50 tr)* |
| **Lãi/lỗ** | **−502 tr** | **−26 tr** | **+2.770 tr** |
| Luỹ kế | −502 tr | −528 tr | +2.242 tr |

**Số trường trả phí cần có để hoà vốn:** khoảng 33 trường khi chi phí cố định 55 tr/tháng; khoảng 79 trường khi 130 tr/tháng; khoảng 158 trường khi 260 tr/tháng.

**Độ nhạy theo giá** (lãi/lỗ năm 3, 300 trường bình quân):

| Giá/trẻ/tháng | 8.000đ | 10.000đ | 15.000đ | 20.000đ |
|---|---|---|---|---|
| Lãi/lỗ năm 3 | −380 tr | +520 tr | +2.770 tr | +5.020 tr |

**Kiểm bằng cách khác:**
- Nếu mỗi trường chỉ có 100 trẻ thay vì 150, lãi năm 3 còn khoảng **0,8 tỷ**.
- Như vậy **giá và quy mô trường** là hai biến quan trọng nhất. Cả hai đều phải đo trong đợt thí điểm.

**Vốn cần:** khoảng 0,6 tỷ để đi hết đáy lỗ luỹ kế của 2 năm đầu, cộng thêm khoảng 20% dự phòng cho chậm trễ khi bán.

---

## 9. Pháp lý và rủi ro

| Rủi ro | Khả năng | Thiệt hại | Cách xử lý |
|---|---|---|---|
| **Sai quy định dữ liệu trẻ em** (Luật 91/2025/QH15, Nghị định 356/2025) | Trung bình | **Rất cao**: bị phạt, mất uy tín | Luật sư rà **trước khi thí điểm**: sự đồng ý của cha mẹ, hồ sơ đánh giá tác động, nơi đặt máy chủ, quy trình khi xảy ra sự cố **[CẦN XÁC MINH]** |
| **Bé bị giao nhầm dù đã dùng app** | Thấp | Rất cao | Điều khoản ghi rõ: app là công cụ, trách nhiệm giao trẻ vẫn thuộc nhà trường; nhật ký và ảnh bàn giao làm bằng chứng; cân nhắc mua bảo hiểm trách nhiệm **[CẦN XÁC MINH]** |
| **Trường không chịu trả tiền** (chỉ dùng bản miễn phí) | **Trung bình–cao** | Cao | Hỏi giá trước khi xây thêm; có gói Cơ bản giá thấp; cho trường gộp phí vào học phí |
| **Phụ huynh không cài, quay lại gọi điện** | Trung bình | Cao | Không bắt cài app (PWA mở bằng đường dẫn); cô giáo chỉ nhận lời nhờ đón qua app sau thời gian chuyển tiếp |
| **Phần mềm quản lý trường sao chép tính năng** | Trung bình | Trung bình | Làm đối tác sớm; giữ khác biệt ở kiểm tra tại cổng và cộng đồng nhóm lớp |
| **Chi phí tin nhắn cao hơn dự kiến** | Trung bình | Thấp–trung bình | Ưu tiên thông báo đẩy miễn phí và ZNS; chỉ dùng SMS cho người đón chưa có Zalo |
| **Vị trí (bản đồ) bị coi là dữ liệu nhạy cảm** | Trung bình | Trung bình | Đã thiết kế: người đón tự bật, chỉ giữ điểm mới nhất, xoá khi yêu cầu đóng **[ĐÃ KIỂM trong bản mẫu]**; luật sư xác nhận |
| **Đón có phí bị coi là dịch vụ đưa đón trẻ cần đăng ký / trung gian thanh toán** | Trung bình | Cao | App không giữ tiền; chỉ phụ huynh cùng trường, cô duyệt; luật sư xác nhận trước khi bật **[CẦN XÁC MINH]**. Có thể tắt riêng tính năng theo trường |
| **Tiền tạo động cơ lạ (người đón vì tiền, tranh việc)** | Thấp–trung bình | Cao | Mức tối thiểu 20–300 nghìn, giữ đủ bước cô gọi xác minh + kiểm tại cổng, cô tạm dừng được tài khoản, không lộ tên bé trên bảng việc |
| **Nền bản đồ miễn phí không dùng được để kinh doanh** | Cao | Thấp | Ký hợp đồng với nhà cung cấp bản đồ có khoá riêng trước khi bán **[CẦN XÁC MINH điều khoản]** |

---

## 10. Cột mốc, chỉ số và điều kiện dừng

| Mốc | Thời điểm | Đạt khi |
|---|---|---|
| Rà pháp lý xong, có điều khoản và mẫu đồng ý | Tháng 1 | Luật sư ký xác nhận |
| 10 buổi phỏng vấn chủ trường | Tháng 1 | Có khoảng giá thật và số trẻ thật mỗi trường |
| 3 trường thí điểm chạy | Tháng 2 | Cô giáo dùng hằng ngày |
| Trường đầu tiên trả phí | Tháng 4 | Có hợp đồng |
| Hoà vốn theo tháng | Tháng 18–24 | Khoảng 80 trường trả phí |

**Chỉ số theo dõi hằng tuần:**
- Tỷ lệ lượt đón hộ đi qua app so với tổng số lượt đón hộ ở trường thí điểm (cô giáo đếm tay ở tuần đầu).
- Số giây giao trẻ tại cổng.
- Số lần giao nhầm (mục tiêu: 0).
- Tỷ lệ phụ huynh đăng nhập ít nhất một lần.
- Mức độ hài lòng của cô giáo (NPS).
- Tỷ lệ trường giữ lại sau 3 tháng.

**Điều kiện dừng hoặc chuyển hướng (xét cuối tháng 3):**
- Nếu **dưới 30%** lượt đón hộ đi qua app, **hoặc** dưới một nửa số trường thí điểm đồng ý trả từ 10.000đ/trẻ/tháng, thì không tuyển thêm người bán.
- Khi đó chuyển hướng: bán Đón Hộ như phần gắn thêm cho các phần mềm quản lý trường (chia doanh thu), hoặc chuyển sang trường quốc tế, nơi sẵn sàng trả cao hơn.

---

## 11. Đã biết, giả định và cần kiểm

**Đã biết:**
- Bản mẫu chạy đủ luồng 3 bên, có bản đồ, điểm trả, nhóm lớp và điểm tương trợ (51/51 test).
- Số trường và số trẻ mầm non, tiểu học (theo nguồn ở mục 2).
- Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP có hiệu lực từ 01/01/2026.
- donho.com và donbe.com đã có người dùng.

**Đang giả định (nếu sai thì kết luận đổi theo):**
- **Giá 15.000đ/trẻ/tháng.** Dưới khoảng 9.000đ là mô hình không có lãi.
- **150 trẻ/trường.** Nếu chỉ 100 trẻ, lãi năm 3 giảm còn khoảng 0,8 tỷ.
- **Tốc độ bán:** 30, 150 rồi 500 trường. Bán chậm một năm thì cần gấp đôi vốn.
- **Chi phí tin nhắn khoảng 1.500đ/trẻ/tháng.**
- **Trường chịu tự trả phí** thay vì đẩy sang phụ huynh.

**Cần kiểm thêm:**
- Quy định riêng về dữ liệu trẻ em trong Luật 91/2025 và Nghị định 356/2025.
- Giá Zalo ZNS và SMS brandname.
- Điều khoản thương mại của nhà cung cấp bản đồ.
- Bảng giá của các phần mềm quản lý mầm non hiện có.
- Ngân sách chuyển đổi số của Phòng/Sở GD cho trường công.

**Nếu chỉ kiểm được một việc: hỏi giá ở 10 trường mầm non tư.** Mọi con số tài chính phía trên phụ thuộc vào câu trả lời đó.

---

## Nguồn

- [Hệ thống giáo dục mầm non 2010–2024 qua những con số — giaoduc.net.vn](https://giaoduc.net.vn/he-thong-giao-duc-mam-non-nuoc-ta-tu-nam-2010-den-2024-qua-nhung-con-so-post249290.gd)
- [Bộ GD&ĐT thông tin về sắp xếp cơ sở mầm non, phổ thông — lsvn.vn](https://lsvn.vn/bo-gd-dt-thong-tin-ve-tinh-hinh-sap-xep-to-chuc-cac-co-so-mam-non-pho-thong-a167366.html)
- [Nghị định hướng dẫn Luật Bảo vệ dữ liệu cá nhân 2025 — luatvietnam.vn](https://luatvietnam.vn/dan-su/nghi-dinh-huong-dan-luat-bao-ve-du-lieu-ca-nhan-2025-la-nghi-dinh-nao-568-103658-article.html)
- [Điểm mới của Nghị định 356/2025 so với Nghị định 13/2023 — luatvietan.vn](https://luatvietan.vn/diem-moi-cua-nghi-dinh-356-2025-so-voi-nghi-dinh-13-2023-ve-huong-dan-bao-ve-du-lieu-ca-nhan.html)
- [Top phần mềm quản lý giáo dục mầm non 2026 — MISA AMIS](https://amis.misa.vn/117230/phan-mem-quan-ly-giao-duc-mam-non/)
- [KidsOnline — vnbusiness.vn](https://vnbusiness.vn/cong-ty-khoi-nghiep-viet-nam-xoa-tan-su-lo-lang-cua-phu-huynh.html)
- [Xe đưa đón học sinh — Báo Văn Hoá](https://baovanhoa.vn/doi-song/xe-dua-don-hoc-sinh-nhung-dieu-phu-huynh-can-kiem-tra-truoc-khi-dang-ky-262756.html)
