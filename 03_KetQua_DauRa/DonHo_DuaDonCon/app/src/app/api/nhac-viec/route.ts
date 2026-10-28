// Lịch nhắc việc của phễu tự bán — gọi mỗi ngày từ cron máy chủ:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<địa chỉ>/api/nhac-viec
// Không cấu hình CRON_SECRET thì đóng (503). Gọi nhiều lần trong ngày không gửi trùng (xem runNudges).
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runNudges } from "@/server/sales";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return NextResponse.json({ error: "Chưa cấu hình CRON_SECRET" }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "Sai khoá" }, { status: 401 });
  return NextResponse.json(await runNudges());
}
