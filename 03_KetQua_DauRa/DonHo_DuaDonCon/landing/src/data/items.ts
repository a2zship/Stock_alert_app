/**
 * Danh sách trường đang có Đón Hộ — đọc từ Google Sheet (trang tính đã "Công bố lên web" dạng CSV).
 * - VITE_SHEET_CSV_URL trong .env: link CSV. Chưa cấu hình → dữ liệu mẫu + nhãn "Dữ liệu mẫu".
 * - Sheet lỗi/chậm → dùng bản đọc thành công gần nhất lưu trong trình duyệt.
 * - Tiêu đề cột được so khớp không dấu, không phân biệt hoa thường, nhận nhiều cách đặt tên (xem COLS).
 */
import { levelByName } from '../content'

/** available = đang đón · reserved = đang tìm người đón (vẫn hiện, gắn nhãn) · gone = tạm ngừng (ẩn) */
export type Status = 'available' | 'reserved' | 'gone'

export type Item = {
  code: string
  name: string
  category: string // cấp học
  segment: string // tỉnh/thành
  address: string // phường/xã
  spec: number // số lớp đang dùng; 0 = không ghi
  status: Status
  note: string
  updated: string
}

export type Dataset = { items: Item[]; source: 'sheet' | 'cache' | 'sample'; fetchedAt: Date }

const CACHE_KEY = 'schools-v1'
const SHEET_URL = (import.meta.env.VITE_SHEET_CSV_URL as string | undefined)?.trim()

/* ---------- CSV (RFC 4180) ---------- */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') row.push(cell), (cell = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell), rows.push(row), (row = []), (cell = '')
    } else cell += ch
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim()))
}

/** "Tỉnh/thành" → "tinhthanh": so khớp tiêu đề cột không phụ thuộc dấu, hoa thường, ký tự đặc biệt */
const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Các tên cột được chấp nhận (đã qua key()). */
const COLS = {
  code: ['ma', 'matruong', 'code', 'id'],
  name: ['tentruong', 'truong', 'ten', 'name'],
  category: ['caphoc', 'cap', 'loai', 'level'],
  segment: ['tinhthanh', 'tinh', 'thanhpho', 'province'],
  address: ['phuongxa', 'phuong', 'xa', 'ward'],
  spec: ['solop', 'solopdangdung', 'lopdangdung', 'classes'],
  status: ['tinhtrang', 'trangthai', 'status'],
  note: ['ghichu', 'note'],
  updated: ['ngaycapnhat', 'capnhat', 'updated'],
}

/** Tình trạng: mặc định là đang đón; nhận vài cách ghi phổ biến */
const toStatus = (s: string): Status => {
  const k = key(s)
  if (/^(tamngung|ngung|an|dong|hidden)/.test(k)) return 'gone'
  if (/^(dangtim|timnguoidon|canthem|dangmo|moimo|gathering)/.test(k)) return 'reserved'
  return 'available'
}

export function rowsToItems(rows: string[][]): Item[] {
  const [head, ...body] = rows
  if (!head) return []
  const hk = head.map(key)
  const idx = (names: string[]) => hk.findIndex((h) => names.includes(h))
  const at = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, idx(v)])) as Record<keyof typeof COLS, number>
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

  const out: Item[] = []
  const skipped: string[] = []
  body.forEach((r, n) => {
    const name = get(r, at.name)
    const category = levelByName(get(r, at.category))
    if (!name || !category) {
      // bỏ dòng thiếu tên hoặc sai cấp học, báo ra console để người nhập biết mà sửa
      skipped.push(`dòng ${n + 2}: ${!name ? 'thiếu Tên trường' : `Cấp học "${get(r, at.category)}" không khớp`}`)
      return
    }
    out.push({
      code: get(r, at.code) || `dong-${n + 2}`,
      name,
      category,
      segment: get(r, at.segment) || '—',
      address: get(r, at.address),
      spec: Number(get(r, at.spec).replace(/\D/g, '')) || 0,
      status: toStatus(get(r, at.status)),
      note: get(r, at.note),
      updated: get(r, at.updated),
    })
  })
  if (skipped.length) console.warn('[truong] bỏ qua các dòng không hợp lệ trong Sheet:\n' + skipped.join('\n'))
  return out
}

/* ---------- Tải dữ liệu ---------- */
async function fetchSheet(url: string): Promise<Item[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}_=${Math.floor(Date.now() / 300000)}`, { signal: ctrl.signal }) // làm mới mỗi 5 phút
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items = rowsToItems(parseCsv(await res.text()))
    if (!items.length) throw new Error('Sheet không có dòng hợp lệ')
    return items
  } finally {
    clearTimeout(t)
  }
}

function readCache(): Dataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    return { items: d.items, source: 'cache', fetchedAt: new Date(d.fetchedAt) }
  } catch {
    return null
  }
}

export async function loadItems(): Promise<Dataset> {
  if (!SHEET_URL) {
    const { sampleItems } = await import('./sample')
    return { items: sampleItems, source: 'sample', fetchedAt: new Date() }
  }
  try {
    const items = await fetchSheet(SHEET_URL)
    const fetchedAt = new Date()
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ items, fetchedAt }))
    } catch {
      /* trình duyệt chặn lưu trữ: bỏ qua */
    }
    return { items, source: 'sheet', fetchedAt }
  } catch (err) {
    console.warn('[truong] không đọc được Google Sheet, dùng bản lưu gần nhất', err)
    const cached = readCache()
    if (cached) return cached
    throw err
  }
}
