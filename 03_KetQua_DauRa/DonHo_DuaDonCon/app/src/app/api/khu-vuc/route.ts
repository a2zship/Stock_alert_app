// Danh mục cho bộ chọn khu vực khi đăng ký (chưa đăng nhập): phường/xã của tỉnh, trường + lớp của phường/xã.
// Chỉ trả tên đơn vị, trường, lớp — không có dữ liệu trẻ hay phụ huynh.
import { NextResponse } from "next/server";
import { schoolsOf, wardsOf } from "@/server/area";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const tinh = Number(q.get("tinh"));
  const phuong = Number(q.get("phuong"));
  if (Number.isInteger(tinh) && tinh > 0) return NextResponse.json(await wardsOf(tinh));
  if (Number.isInteger(phuong) && phuong > 0) return NextResponse.json(await schoolsOf(phuong));
  return NextResponse.json({ error: "Thiếu tham số" }, { status: 400 });
}
