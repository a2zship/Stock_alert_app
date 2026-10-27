// Chuẩn hoá số điện thoại di động Việt Nam về dạng 0xxxxxxxxx (10 số).
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
  return /^0[35789]\d{8}$/.test(s) ? s : null;
}

/** Che bớt số khi hiển thị cho người không cần biết đủ: 0901***001 */
export function maskPhone(p: string): string {
  return p.length === 10 ? `${p.slice(0, 4)}***${p.slice(7)}` : p;
}
