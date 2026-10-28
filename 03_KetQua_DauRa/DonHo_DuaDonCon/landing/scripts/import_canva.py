"""Nhận ảnh tải từ Canva về, tự nhận ra ảnh nào là ảnh nào và chép vào assets/raw/ đúng tên.

Canva đặt tên file tải về lung tung, nên script so từng ảnh với ảnh thu nhỏ mẫu
trong assets/canva_thumbs/ (lưu lúc tạo ảnh) rồi chọn ảnh giống nhất.

Chạy:  python scripts/import_canva.py [thư mục chứa ảnh tải về]
Mặc định đọc thư mục Downloads. Không xoá, không sửa file gốc, chỉ chép.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
THUMBS, RAW = ROOT / 'assets' / 'canva_thumbs', ROOT / 'assets' / 'raw'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads'
SIZE = (48, 48)
MAX_DIFF = 40  # chênh lệch trung bình mỗi kênh (0-255); lớn hơn coi như không khớp


def sig(path):
    with Image.open(path) as im:
        return im.convert('RGB').resize(SIZE, Image.LANCZOS), im.size


def diff(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


thumbs = {t.stem: sig(t)[0] for t in sorted(THUMBS.glob('*.png'))}
cands = []
for f in sorted(SRC.glob('*')):
    if f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
        continue
    try:
        s, size = sig(f)
    except OSError:
        continue
    if max(size) < 800:  # bỏ qua ảnh thu nhỏ, ảnh không liên quan
        continue
    cands.append((f, s, size))

# ghép cặp tham lam theo độ giống, mỗi ảnh mẫu và mỗi file chỉ dùng một lần
pairs = sorted((diff(ts, s), name, f, size) for name, ts in thumbs.items() for f, s, size in cands)
used_n, used_f, done = set(), set(), []
for d, name, f, size in pairs:
    if d > MAX_DIFF or name in used_n or f in used_f:
        continue
    used_n.add(name)
    used_f.add(f)
    RAW.mkdir(parents=True, exist_ok=True)
    for old in RAW.glob(f'{name}.*'):
        if old.suffix.lower() != f.suffix.lower():
            print(f'Lưu ý: đã có {old.name}, bản mới có đuôi khác, process_images sẽ đọc cả hai')
    dest = RAW / f'{name}{f.suffix.lower()}'
    shutil.copy2(f, dest)
    done.append(name)
    print(f'OK  {name:16} <- {f.name}  ({size[0]}x{size[1]}, lệch {d:.1f})')

missing = [n for n in thumbs if n not in used_n]
print(f'\nĐã chép {len(done)}/{len(thumbs)} ảnh vào {RAW}')
if missing:
    print('Chưa thấy: ' + ', '.join(missing))
