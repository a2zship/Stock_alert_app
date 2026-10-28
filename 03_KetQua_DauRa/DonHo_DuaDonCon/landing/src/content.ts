/**
 * CẤU HÌNH + NỘI DUNG TRANG GIỚI THIỆU ĐÓN HỘ — file duy nhất cần sửa khi đổi chữ.
 *
 * Trang chỉ có tiếng Việt. Khác bộ khung gốc (danh sách sản phẩm có giá):
 * - Phim cuộn = 5 cảnh của một buổi chiều đón con; mỗi cảnh có nút dẫn vào app.
 * - So sánh = Đón Hộ / xe công nghệ / nhờ giúp việc (chữ cố định, không lấy từ Sheet).
 * - Danh sách = các trường đang có Đón Hộ, đọc từ Google Sheet; lọc theo cấp học, tỉnh/thành, tình trạng, tên trường.
 * Quy ước:
 * - [IN HOA TRONG NGOẶC VUÔNG] = placeholder, thay bằng thông tin thật trước khi chạy quảng cáo.
 * - "ĐỐI CHIẾU THỰC TẾ" = câu mô tả tính năng app; sửa nếu app đổi cách làm.
 * - Không bịa số trường, số lượt đón, lời khen. Danh sách trường thật chỉ đến từ Google Sheet.
 */
export type Img = { src: string; alt: string }
export type Callout = { x?: number; y?: number; below?: boolean; label: string }
export type Effect = 'pan' | 'zoom' | 'wipe' | 'dusk' | 'reveal'

/** Địa chỉ app Đón Hộ (VITE_APP_URL trong .env). Mọi nút "Đăng ký", "Mở trường" dẫn về đây. */
export const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined)?.trim() || 'http://localhost:3271').replace(/\/$/, '')
export const appLink = (path: string) => `${APP_URL}${path}`

/* ================================================================== */
/* 1. CẤU HÌNH CHUNG                                                    */
/* ================================================================== */
export const SITE = {
  brand: {
    name: 'Đón Hộ',
    /** Logo bản sáng cho nền tối, đặt trong public/brand/. Để '' thì hiện tên dạng chữ. */
    logoOnDark: '',
    phone: '[SĐT/ZALO HỖ TRỢ]',
    /** Số dạng quốc tế, ví dụ 84901234567. Để '' thì ẩn nút Zalo + Gọi. */
    phoneDigits: '',
  },
  /** Tỉnh/thành hiện sẵn trong bộ lọc. Tỉnh mới gặp trong Sheet tự được thêm vào. */
  segments: [] as string[],
  /**
   * Cảnh trong phim. effect: pan (lướt ngang + chú thích neo, cần xy; thêm 'below' làm phần tử thứ 3 để đặt thẻ dưới điểm neo) · zoom (đẩy máy vào focus + 2 ảnh cận) ·
   * wipe (vuốt dọc) · dusk (ánh chiều từ focus) · reveal (ảnh "trước" mờ dần lộ ảnh "sau", cần extra[0])
   * xy / focus đã chỉnh theo ảnh Canva 28/10/2026; đổi ảnh thì đo lại.
   */
  categories: [
    { code: 'nho-cung-lop', effect: 'pan', bg: 'cat-1/bg', xy: [[25, 60], [50, 58], [78, 62, 'below']] },
    { code: 'xac-nhan-3-ben', effect: 'zoom', bg: 'cat-2/bg', extra: ['cat-2/detail-1', 'cat-2/detail-2'], focus: { x: 64, y: 70 } },
    { code: 'kiem-them', effect: 'wipe', bg: 'cat-3/bg' },
    { code: 've-toi-nha', effect: 'dusk', bg: 'cat-4/bg', focus: { x: 62, y: 30 } },
    { code: 'nha-truong', effect: 'reveal', bg: 'cat-5/bg', extra: ['cat-5/before'] },
  ] as { code: string; effect: Effect; bg: string; extra?: string[]; focus?: { x: number; y: number }; xy?: [number, number, 'below'?][] }[],
  /** Cấp học trong danh sách trường. aliases: cách viết người nhập Sheet có thể gõ (viết thường, không dấu). */
  levels: [
    { code: 'mam-non', name: 'Mầm non', aliases: ['mam non', 'mn', 'nha tre', 'mau giao'] },
    { code: 'tieu-hoc', name: 'Tiểu học', aliases: ['tieu hoc', 'th', 'cap 1'] },
    { code: 'thcs', name: 'THCS', aliases: ['thcs', 'trung hoc co so', 'cap 2'] },
  ],
  introBg: 'intro/bg',
}

type SceneCopy = {
  name: string
  headline: string
  alt: string
  extraAlt?: string[]
  /** Nhãn ngắn (≤ 5 chữ), hiện kèm dấu tích; ở cảnh pan là chú thích neo vào ảnh. */
  points: string[]
  cta: { label: string; path: string }
}

/* ================================================================== */
/* 2. CHỮ TRÊN TRANG — Sếp muốn ít chữ nhất có thể (28/10/2026):        */
/*    mỗi cảnh 1 tiêu đề + 1 câu, ý phụ là nhãn ngắn, không đoạn văn.    */
/* ================================================================== */
const vi = {
  terms: {
    item: 'trường',
    available: 'Đang đón',
    reserved: 'Đang tìm người đón',
    segment: 'Tỉnh/thành',
    segmentAll: 'Tất cả tỉnh/thành',
    spec: { label: 'Lớp đang dùng', unit: 'lớp' },
  },
  brand: {
    tagline: 'Nhờ người quen đón con, cô giáo xác nhận',
    slogan: 'Chiều nay ai đón con cũng có người biết.',
  },
  imageCaption: 'Ảnh minh hoạ',
  // ĐỐI CHIẾU THỰC TẾ: nhãn mô tả đúng cách app đang chạy (27–28/10/2026)
  categories: {
    'nho-cung-lop': {
      name: 'Nhờ phụ huynh cùng lớp',
      headline: 'Người đón là người cô quen mặt.',
      alt: 'Cổng trường giờ tan học: cô giáo cầm danh sách lớp, phụ huynh đứng chờ, các bé đeo cặp.',
      points: ['Cô có danh sách đón', 'Phụ huynh đã được duyệt', 'Bé không cần điện thoại'],
      cta: { label: 'Đăng ký cho con', path: '/dang-ky' },
    },
    'xac-nhan-3-ben': {
      name: 'Xác nhận 3 bên',
      headline: 'Đúng người, cô mới giao bé.',
      alt: 'Cô giáo cầm điện thoại xem thông tin người đón trước khi giao bé.',
      extraAlt: ['Cận cảnh màn hình điện thoại hiện ảnh người đón và mã QR.', 'Cô giáo trao tay bé cho người đón ở cổng lớp.'],
      points: ['Bố mẹ chọn người đón', 'Mã QR dùng một lần', 'Cô xem ảnh và CCCD'],
      cta: { label: 'Đăng ký cho con', path: '/dang-ky' },
    },
    'kiem-them': {
      name: 'Đi đón, kiếm thêm',
      headline: 'Đón con mình, chở thêm bé cùng lớp.',
      alt: 'Phụ huynh trên xe máy, chở hai bé đội mũ bảo hiểm, đi trên đường gần trường.',
      points: ['Thù lao qua VietQR', 'Chỉ nhận khi tiện đường', 'Có đón theo tháng'],
      cta: { label: 'Đăng ký nhận đón', path: '/dang-ky' },
    },
    've-toi-nha': {
      name: 'Về tới nhà',
      headline: 'Bé tới cửa, bố mẹ biết ngay.',
      alt: 'Đầu ngõ buổi chiều, cửa nhà đã sáng đèn, xe máy dừng trước cổng.',
      points: ['Xem đường trên bản đồ', 'Bấm "Con đã về"', 'Lưu lại mỗi lần đón'],
      cta: { label: 'Đăng ký cho con', path: '/dang-ky' },
    },
    'nha-truong': {
      name: 'Cho nhà trường',
      headline: 'Bớt cảnh hỏi "ai đón bé này?".',
      alt: 'Cổng trường giờ tan học, phụ huynh xếp hàng đón gọn gàng.',
      extraAlt: ['Cùng cổng trường khi chưa có danh sách đón: phụ huynh đứng chen nhau.'],
      points: ['Danh sách đón mỗi chiều', 'Tự mở trường trong vài phút', 'Áp phích QR cho từng lớp'],
      cta: { label: 'Mở cho trường', path: '/mo-truong' },
    },
  } as Record<string, SceneCopy>,

  scenes: {
    intro: {
      nav: 'Mở đầu',
      eyebrow: 'Đón Hộ',
      title: 'Chiều nay ai đón con?',
      sub: 'Bạn cùng lớp đón giúp. Cô giáo xác nhận.',
      hint: 'Cuộn để mở cổng',
      alt: 'Sân trường buổi chiều nhìn qua cổng.',
    },
    compare: {
      nav: 'So sánh',
      title: 'Vì sao chọn Đón Hộ?',
      // ĐỐI CHIẾU THỰC TẾ: chỉ so những điều chắc chắn đúng, không so giá
      rows: ['Cô giáo xác nhận người đón', 'Bé không cần điện thoại', 'Người đón quen mặt'],
      cols: [
        { name: 'Đón Hộ', yes: [true, true, true], highlight: true },
        { name: 'Đặt xe', yes: [false, false, false] },
        { name: 'Người nhà, giúp việc', yes: [false, true, true] },
      ],
      yes: 'Có',
      no: 'Không',
      cta: 'Tìm trường của con',
    },
    listing: {
      nav: 'Trường',
      title: 'Trường đang có Đón Hộ',
      sub: 'Tìm trường của con.',
      all: 'Tất cả',
      typeLabel: 'Cấp học',
      statusLabel: 'Tình trạng',
      statusAll: 'Mọi tình trạng',
      searchLabel: 'Tên trường',
      searchPlaceholder: 'Gõ tên trường',
      empty: 'Chưa có trường này. Đề xuất để Đón Hộ mời trường.',
      error: 'Chưa tải được danh sách. Tải lại trang, hoặc đăng ký thẳng trên app.',
      sampleNotice: 'Dữ liệu mẫu, chưa phải trường thật.',
      cacheNotice: 'Đang hiện bản cập nhật gần nhất.',
      signup: 'Đăng ký cho con ở trường này',
      helper: 'Đăng ký nhận đón',
      notFound: { title: 'Chưa thấy trường của con?', text: 'Đủ 3 phụ huynh đề xuất là có tin mời gửi trường.', cta: 'Đề xuất trường' },
    },
    steps: {
      nav: 'Các bước',
      title: '3 bước',
      // ĐỐI CHIẾU THỰC TẾ
      items: ['Đăng ký theo lớp', 'Nhờ đón hoặc nhận đón', 'Cô giao bé, bố mẹ nhận tin'],
    },
    cta: {
      nav: 'Bắt đầu',
      title: 'Bắt đầu từ lớp của con.',
      paths: [
        { who: 'Phụ huynh', label: 'Đăng ký cho con', path: '/dang-ky' },
        { who: 'Nhà trường', label: 'Mở cho trường', path: '/mo-truong' },
      ],
      login: 'Đã có tài khoản? Đăng nhập',
      zalo: 'Nhắn Zalo hỗ trợ',
      call: 'Gọi',
    },
    jump: 'Tìm trường của con',
  },

  ui: {
    skip: 'Bỏ qua phần giới thiệu, tới danh sách trường',
    navLabel: 'Chuyển cảnh',
    typeOf: (i: number, n: number) => `${i}/${n}`,
    filtersLabel: 'Lọc danh sách trường',
    footNote: 'Ảnh minh hoạ, không phải trường hay người thật.',
    footRole: 'Đón Hộ kết nối phụ huynh, cô giáo và người đón. Đón Hộ không trực tiếp đưa đón.',
    count: (open: number, gathering: number) => `${open} trường đang đón${gathering ? `, ${gathering} trường đang tìm người đón` : ''}`,
    close: 'Đóng',
    facts: { ward: 'Phường/xã', level: 'Cấp học', updated: 'Cập nhật' },
    updatedAt: (d: string) => `Cập nhật lúc ${d}`,
    pageTitle: 'Đón Hộ · Nhờ người quen đón con, cô giáo xác nhận',
    pageDesc: 'Nhờ phụ huynh cùng lớp đón con khi kẹt giờ. Cô giáo xác nhận đúng người mới giao bé, bố mẹ nhận tin lúc đón và lúc về tới nhà.',
  },
}

/* ================================================================== */
/* 3. XUẤT RA CHO CÁC MODULE KHÁC — thường không cần sửa               */
/* ================================================================== */
export const brand = { ...SITE.brand, ...vi.brand }
export const terms = vi.terms
export const imageCaption = vi.imageCaption
export const ui = vi.ui
export const segments = SITE.segments
export const levels = SITE.levels

export type Category = {
  code: string
  name: string
  headline: string
  callouts: Callout[]
  effect: Effect
  bg: Img
  extra?: Img[]
  focus?: { x: number; y: number }
  cta: { label: string; href: string }
}

export const categories: Category[] = SITE.categories.map((s) => {
  const c = vi.categories[s.code]
  if (!c) throw new Error(`content.ts: thiếu chữ cho cảnh "${s.code}"`)
  return {
    code: s.code,
    name: c.name,
    headline: c.headline,
    effect: s.effect,
    bg: { src: s.bg, alt: c.alt },
    extra: s.extra?.map((src, i) => ({ src, alt: c.extraAlt?.[i] ?? '' })),
    focus: s.focus,
    callouts: c.points.map((label, i) => ({ label, x: s.xy?.[i]?.[0], y: s.xy?.[i]?.[1], below: s.xy?.[i]?.[2] === 'below' })),
    cta: { label: c.cta.label, href: appLink(c.cta.path) },
  }
})

export const scenes = {
  ...vi.scenes,
  intro: { ...vi.scenes.intro, bg: { src: SITE.introBg, alt: vi.scenes.intro.alt } as Img },
}

/* ---------- Cột "Cấp học" trong Google Sheet → mã cấp học ---------- */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export function levelByName(name: string): string | undefined {
  const n = norm(name)
  if (!n) return undefined
  return levels.find((l) => l.code === n || l.aliases.includes(n) || norm(l.name) === n)?.code
}

export const levelName = (code: string) => levels.find((l) => l.code === code)?.name ?? code
