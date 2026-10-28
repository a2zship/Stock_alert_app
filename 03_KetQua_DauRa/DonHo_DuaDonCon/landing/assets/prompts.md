# Câu lệnh tạo ảnh minh hoạ: trang giới thiệu Đón Hộ

Cần 9 ảnh. Tạo xong thì bỏ vào `assets/raw/` theo đúng tên trong từng mục, rồi chạy:

```bash
python scripts/process_images.py
```

## Nguyên tắc riêng cho Đón Hộ

Bộ khung gốc cấm có người trong ảnh. Ở đây cảnh đón con thì phải có người, nên đổi lại như sau:
- **Người chỉ xuất hiện từ phía sau, ở xa, hoặc chỉ thấy bàn tay.** Không có khuôn mặt nhìn rõ, nhất là mặt trẻ em. Ảnh AI có mặt người dễ bị hiểu là khách hàng thật.
- **Không có tên trường, biển hiệu, logo, chữ, số nhà, biển số xe.** Không vẽ đồng phục có phù hiệu của trường thật.
- **Màn hình điện thoại để mờ hoặc chỉ có mảng màu,** không vẽ giao diện giả có chữ.
- Trẻ ngồi xe máy **luôn đội mũ bảo hiểm.** Xe máy chở tối đa 2 bé (đúng như kế hoạch kinh doanh).
- Trang tự gắn nhãn "Ảnh minh hoạ" lên mọi ảnh trong phim.

**Cách tạo:**
- Dùng **một cuộc chat** cho cả bộ để màu sắc và ánh sáng đồng đều.
- Tải ảnh bằng nút tải xuống của công cụ để lấy bản gốc, không dùng "Lưu ảnh" của trình duyệt (bản đó chỉ khoảng 1024px).

## Style bible (dán đầu cuộc chat)

```
You are a documentary-style photographer and 3D visualization artist. I will ask for a series of images about parents picking up young children at a Vietnamese primary school / kindergarten gate in the late afternoon, used as scroll-animation backgrounds on a website. Do not generate anything yet. Reply only "Ready".

STYLE BIBLE (every image):
- Photorealistic, looks like a real candid photo in a Vietnamese town, not illustration, not stock-photo posing.
- Setting: ordinary Vietnamese public school: cream/pale-yellow painted walls, green-painted iron gate, a few trees (bàng / phượng), tiled schoolyard, motorbikes parked outside. Modest, clean, not luxury.
- Palette: warm late-afternoon daylight, cream and pale yellow walls, deep indigo-blue accents (bags, shirts), touches of amber. Soft shadows, slightly low contrast.
- Eye-level camera, 28–35 mm lens, straight verticals.
- People ONLY seen from behind, from far away, or as hands. NO clearly visible faces, especially children's faces.
- Children on motorbikes ALWAYS wear helmets. At most 2 children on one motorbike.
- NEVER include: readable text, letters, numbers, school names, signage, logos, licence plates, uniform badges, watermarks, frames or borders. Phone screens show only soft blurred colour blocks.
```

## Từng ảnh

### 1. Mở đầu: `intro-bg.png`
Ảnh này nằm sau hai cánh cổng sắt, lộ ra khi khách cuộn.
```
16:9 landscape. View from just outside an open school gate into a sunny schoolyard in the late afternoon: tiled yard, a big shade tree, two-storey cream school building in the background. Nobody near the camera; a few tiny figures of children far away. Centre of the frame open and bright, calm sky in the top third (headline area).
```

### 2. Cảnh 1, nhờ phụ huynh cùng lớp (`pan`): `cat-1-bg.png`
Web lướt ngang ảnh này, có 3 chú thích chỉ vào 3 chỗ trong ảnh.
```
16:9 landscape, EXTRA WIDE composition because the website pans across it. School gate at pick-up time, seen from the street side. Place: a female teacher seen from behind holding a clipboard, around x 20–28%, y 55–65%; a parent seen from behind standing next to a parked motorbike, around x 48–56%, y 60–70%; two small children with backpacks seen from behind walking towards the gate, around x 76–84%, y 50–60%. Keep the top 30% calm (headline area).
```
→ Khi có ảnh, chỉnh `xy` của `nho-cung-lop` trong `src/content.ts` cho khớp vị trí thật.

### 3. Cảnh 2, xác nhận 3 bên (`zoom`): `cat-2-bg.png`, `cat-2-detail-1.png`, `cat-2-detail-2.png`
Web đẩy máy vào chiếc điện thoại trong tay cô giáo, rồi hiện thêm 2 ảnh cận.
```
16:9 landscape. Classroom doorway at pick-up time. A teacher, seen from behind over her shoulder, holds a smartphone; the phone sits around x 64%, y 56% (the website zooms into this point). An adult waits beyond the doorway, out of focus. Keep the left 40% darker and calm (text area).
```
```
4:5 portrait close-up of a teacher's hand holding a smartphone, the screen shows only a soft blurred photo thumbnail and a square blurred pattern (no readable text), shallow depth of field.
```
```
4:5 portrait close-up of hands only: an adult hand gently holding a small child's hand at a classroom door, warm afternoon light, shallow depth of field. No faces.
```

### 4. Cảnh 3, đi đón kiếm thêm (`wipe`): `cat-3-bg.png`
```
16:9 landscape. A parent seen from behind riding a motorbike slowly on a quiet tree-lined street near a school, carrying two small children who both wear helmets and backpacks. Late-afternoon light. Keep the right 40% calm and simple (text area): plain wall or open road.
```
Bản điện thoại: nếu người và xe nằm ở khoảng 30% chiều ngang từ trái, đặt tên `cat-3-bg@x0.3.png` để bản cắt dọc giữ được xe máy.

### 5. Cảnh 4, về tới nhà (`dusk`): `cat-4-bg.png`
```
16:9 landscape. Entrance of a narrow Vietnamese alley (hẻm) with a typical tube house; a motorbike stopped in front of the house gate, a child with a helmet and backpack seen from behind walking to the door. The brightest part, a lit doorway / window, is around x 70%, y 40%. Lighting: soft late-afternoon daylight, NOT sunset (the website adds the sunset colour itself). Keep the bottom 35% calm (text area).
```

### 6. Cảnh 5, nhà trường (`reveal`): tạo `cat-5-bg.png` trước, rồi `cat-5-before.png`
Ảnh "trước" sẽ mờ dần để lộ ra ảnh "sau". Hai ảnh phải cùng góc máy.
```
16:9 landscape, high eye-level view of a school gate at pick-up time: parents waiting calmly in an orderly line along the fence, motorbikes parked neatly on one side, a teacher at the gate. Everyone seen from behind or far away. Keep the left 40% calm (text area).
```
→ lưu `cat-5-bg.png`, rồi trong cùng cuộc chat:
```
Edit the image you just created. Keep EXACTLY the same camera position, framing, gate, walls, trees and lighting. Only change the people and motorbikes: make it a crowded, disorganised pick-up, parents and motorbikes bunched up in front of the gate, blocking it. Do not move or resize the gate, walls or trees.
```
→ lưu `cat-5-before.png`.

## Nguồn ảnh
Cả 9 ảnh tạo bằng Canva AI (generate-image) ngày 28/10/2026, theo đúng câu lệnh ở trên. Ảnh ngang 1680x944, ảnh dọc 1136x1408.

| File | Mã ảnh Canva | Ghi chú |
|---|---|---|
| `intro-bg` | MAHZSLNZV2Y | Cổng mở, sân trường, cây xanh |
| `cat-1-bg` | MAHZSJ3kctM | Phụ huynh + xe máy giữa khung, 2 bé bên phải |
| `cat-2-bg` | MAHZSI3eCSA | Cô cầm điện thoại, nhìn từ sau vai |
| `cat-2-detail-1` | MAHZSG-LqW0 | Màn hình chỉ có mảng mờ dạng mã QR |
| `cat-2-detail-2` | MAHZSI9DT90 | Tay người lớn nắm tay bé |
| `cat-3-bg` | MAHZSNOIv9g | Xe máy chở 2 bé đội mũ, nằm khoảng 30% từ trái |
| `cat-4-bg` | MAHZSJN4JKM | Hẻm, cửa nhà sáng đèn |
| `cat-5-bg` | MAHZSNL_Et4 | Phụ huynh đứng chờ trật tự dọc hàng rào |
| `cat-5-before` | MAHZSFUoeaI | Sửa từ `cat-5-bg`, cùng góc máy, đông và lộn xộn |

Công cụ Canva chỉ trả về ảnh thu nhỏ 200px. Bản gốc phải tải từ tài khoản Canva (mục *Nội dung tải lên*), rồi chạy `python scripts/import_canva.py <thư mục tải về>`: script so với ảnh mẫu trong `assets/canva_thumbs/` và chép vào `assets/raw/` đúng tên.
