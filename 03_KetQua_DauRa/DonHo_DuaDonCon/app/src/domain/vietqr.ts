// Tạo chuỗi VietQR (chuẩn EMVCo của NAPAS 247) để người nhờ chuyển khoản THẲNG cho người đón — app không giữ tiền.
// Hàm thuần, không phụ thuộc DB. Danh sách mã ngân hàng: [CẦN XÁC MINH] lại với danh sách NAPAS mới nhất trước khi phát hành.

export const BANKS = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970437", name: "HDBank" },
  { bin: "970448", name: "OCB" },
  { bin: "970426", name: "MSB" },
] as const;

export const bankName = (bin: string) => BANKS.find((b) => b.bin === bin)?.name ?? bin;

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) — trường 63 của EMVCo. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Nội dung chuyển khoản: chữ không dấu, in hoa, tối đa 25 ký tự (ngân hàng hay cắt/loại ký tự lạ). */
export function transferNote(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toUpperCase().replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim().slice(0, 25);
}

export function vietQr(o: { bin: string; account: string; amount: number; note: string }): string {
  if (!/^\d{6}$/.test(o.bin) || !/^[0-9A-Za-z]{4,19}$/.test(o.account)) throw new Error("Thông tin tài khoản không hợp lệ");
  const merchant = tlv("00", "A000000727") + tlv("01", tlv("00", o.bin) + tlv("01", o.account)) + tlv("02", "QRIBFTTA");
  const body = tlv("00", "01") + tlv("01", "12") + tlv("38", merchant) + tlv("53", "704")
    + tlv("54", String(Math.round(o.amount))) + tlv("58", "VN") + tlv("62", tlv("08", transferNote(o.note))) + "6304";
  return body + crc16(body);
}
