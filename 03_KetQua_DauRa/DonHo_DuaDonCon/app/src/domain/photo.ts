// Chỉ nhận ảnh JPEG/PNG/WebP thật (kiểm chữ ký tệp, không tin phần mở rộng hay MIME do trình duyệt gửi).
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export function sniffImage(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...buf.slice(a, b));
  if (buf.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Ảnh gửi từ trình duyệt ở dạng data URL (đã thu nhỏ). Trả về bytes + mime, hoặc lỗi dễ hiểu. */
export function parseDataUrl(dataUrl: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } | { error: string } {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: "Ảnh không hợp lệ. Hãy chụp hoặc chọn lại ảnh." };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > PHOTO_MAX_BYTES) return { error: "Ảnh quá lớn (tối đa 3 MB)." };
  const mime = sniffImage(bytes);
  if (!mime) return { error: "Tệp không phải ảnh JPEG/PNG/WebP." };
  return { bytes: new Uint8Array(bytes), mime };
}
