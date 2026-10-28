"""Xuất ảnh gốc trong assets/raw sang public/img (AVIF + WebP: 2560 / 1920 / bản điện thoại; ảnh cận 800).
Chạy: python scripts/process_images.py      (cần Pillow >= 11 có hỗ trợ AVIF)

Cách đặt tên file gốc (không cần sửa code):
    intro-bg.png            -> public/img/intro/bg-*      (ảnh sau cánh cửa ở cảnh mở đầu)
    cat-1-bg.png            -> public/img/cat-1/bg-*      (ảnh nền danh mục 1)
    cat-2-detail-1.png      -> public/img/cat-2/detail-1-800.*  (ảnh cận, dọc 4:5, cho hiệu ứng zoom)
    cat-5-before.png        -> public/img/cat-5/before-*  (ảnh "trước" cho hiệu ứng reveal, cùng góc máy với cat-5-bg)
    cat-3-bg@x0.35.png      -> như trên, lấy cột 35% chiều ngang làm tâm khi cắt bản điện thoại
Đường dẫn đích phải khớp SITE.introBg / SITE.categories[].bg / extra trong src/content.ts.
File có tên khác (vd Gemini_Generated_Image_xxx.png) thì khai báo trong MAP bên dưới.
"""
import sys
import re
from pathlib import Path
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding='utf-8')  # console Windows mặc định cp1252, in tiếng Việt bị lỗi

ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'assets' / 'raw', ROOT / 'public' / 'img'
LIMIT = 300 * 1024  # mỗi ảnh nền <= 300KB

# Tên gốc bất kỳ: (đích, kiểu 'bg' | 'detail', tâm x cho bản điện thoại 0..1)
MAP: dict[str, tuple[str, str, float]] = {
    # 'Gemini_Generated_Image_abc.png': ('cat-1/bg', 'bg', 0.5),
}

NAMED = re.compile(r'^(intro|cat-\d+)-([a-z0-9-]+?)(?:@x(0?\.\d+|1(?:\.0+)?))?$', re.I)


def auto_map():
    out = {}
    for f in sorted(RAW.glob('*')):
        if f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        m = NAMED.match(f.stem)
        if not m:
            continue
        folder, name, cx = m.group(1).lower(), m.group(2).lower(), float(m.group(3) or 0.5)
        out[f.name] = (f'{folder}/{name}', 'detail' if name.startswith('detail') else 'bg', cx)
    return out


def crop_ratio(im, ratio, cx=0.5):
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        left = min(max(round(w * cx - nw / 2), 0), w - nw)
        return im.crop((left, 0, left + nw, h))
    nh = round(w / ratio)
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def up(im, size):
    """Đổi cỡ; nếu phải phóng to ảnh gốc nhỏ thì làm nét nhẹ và cảnh báo (nên thay bằng ảnh gốc độ phân giải cao)."""
    out = im.resize(size, Image.LANCZOS)
    if size[0] > im.width * 1.05:
        print(f'  ! ảnh gốc {im.width}px bị phóng lên {size[0]}px — nên thay bằng bản độ phân giải cao')
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    return out


def save(im, path, fmt):
    path.parent.mkdir(parents=True, exist_ok=True)
    q = 62 if fmt == 'AVIF' else 80
    while True:
        kw = {'quality': q}
        if fmt == 'WEBP':
            kw['method'] = 6
        else:
            kw['speed'] = 4
        im.save(path, fmt, **kw)
        if path.stat().st_size <= LIMIT or q <= 30:
            return path.stat().st_size
        q -= 6


def main():
    jobs = {**MAP, **auto_map()}
    if not jobs:
        print(f'Không có ảnh nào trong {RAW} khớp quy ước tên (xem đầu file).')
        return
    for name, (dest, kind, cx) in jobs.items():
        src = Image.open(RAW / name).convert('RGB')
        variants = (
            [('800', up(crop_ratio(src, 4 / 5, cx), (800, 1000)))]
            if kind == 'detail'
            else [
                ('2560', up(crop_ratio(src, 16 / 9), (2560, 1440))),
                ('1920', up(crop_ratio(src, 16 / 9), (1920, 1080))),
                ('m', up(crop_ratio(src, 9 / 16, cx), (810, 1440))),
            ]
        )
        for suffix, im in variants:
            for fmt, ext in (('AVIF', 'avif'), ('WEBP', 'webp')):
                p = OUT / f'{dest}-{suffix}.{ext}'
                size = save(im, p, fmt)
                print(f'{p.relative_to(ROOT)}  {size // 1024}KB')


if __name__ == '__main__':
    main()
