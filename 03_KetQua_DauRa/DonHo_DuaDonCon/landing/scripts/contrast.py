"""Đo tỉ lệ tương phản WCAG 2.1 cho các cặp màu chữ/nền của bảng màu thương hiệu.
Chạy: python scripts/contrast.py            (đọc token trong src/styles.css)
      python scripts/contrast.py '#123C46' '#BCE3D3'   (đo một cặp bất kỳ)
Ngưỡng: chữ thường >= 4.5 · chữ lớn (>= 24px, hoặc >= 18.66px đậm) >= 3 · viền/biểu tượng điều khiển >= 3.
Trường hợp "chữ trên ảnh": đo chữ trên lớp phủ --scrim đặt trên ảnh trắng tinh (trường hợp xấu nhất).
"""
import re
import sys

from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')  # console Windows mặc định cp1252, in tiếng Việt bị lỗi


def lum(hexv):
    h = hexv.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def over(rgb, alpha, bg='#ffffff'):
    b = [int(bg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{round(alpha * x + (1 - alpha) * y):02x}' for x, y in zip(rgb, b))


# (chữ, nền, ngưỡng, ghi chú) — tên là biến CSS trong :root
PAIRS = [
    ('--paper', '--night', 4.5, 'chữ chính trên nền tối'),
    ('--paper', '--night-2', 4.5, 'chữ trên bề mặt nổi'),
    ('--muted', '--night', 4.5, 'chữ phụ trên nền tối'),
    ('--mint', '--night', 4.5, 'nhấn/nhãn trên nền tối'),
    ('--night-2', '--mint', 4.5, 'chữ trên nút chính'),
    ('--ink', '--paper', 4.5, 'chữ chính trên nền sáng'),
    ('--ink-soft', '--paper', 4.5, 'chữ phụ trên nền sáng'),
    ('--teal', '--paper', 4.5, 'nhấn trên nền sáng'),
    ('--paper', '--teal', 4.5, 'chữ trên nút đậm (nếu dùng)'),
]


def main():
    if len(sys.argv) == 3:
        print(f'{sys.argv[1]} / {sys.argv[2]}: {ratio(sys.argv[1], sys.argv[2]):.2f}:1')
        return
    css = (Path(__file__).resolve().parent.parent / 'src' / 'styles.css').read_text(encoding='utf-8')
    root = css[css.index(':root {'):css.index('}', css.index(':root {'))]
    tok = dict(re.findall(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b', root))
    bad = 0
    for fg, bg, need, note in PAIRS:
        if fg not in tok or bg not in tok:
            print(f'  (bỏ qua {fg} / {bg}: không thấy token)')
            continue
        r = ratio(tok[fg], tok[bg])
        ok = r >= need
        bad += not ok
        print(f"{'OK  ' if ok else 'LỖI '} {r:5.2f}:1  {fg} trên {bg}  ({note}, cần {need})")
    m = re.search(r'--scrim:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)', root)
    if m and '--paper' in tok:
        rgb, a = [int(m.group(i)) for i in (1, 2, 3)], float(m.group(4))
        r = ratio(tok['--paper'], over(rgb, a))
        bad += r < 4.5
        print(f"{'OK  ' if r >= 4.5 else 'LỖI '} {r:5.2f}:1  --paper trên --scrim phủ ảnh trắng (trường hợp xấu nhất)")
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
