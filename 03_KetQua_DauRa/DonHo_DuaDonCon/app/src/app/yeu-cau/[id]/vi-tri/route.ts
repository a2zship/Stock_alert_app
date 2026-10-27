// Bản đồ theo dõi: GET = dữ liệu bản đồ (phụ huynh, GV lớp, người đón); POST = người đón gửi vị trí mới / tắt chia sẻ.
import { AppError } from "@/server/db";
import { currentUser } from "@/server/queries";
import { shareLocation, stopSharing, trackingView } from "@/server/tracking";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  const { id } = await params;
  const data = me ? await trackingView(me.id, id) : null;
  return data ? json(data) : json({ error: "Không tìm thấy" }, 404);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Chỉ nhận từ chính trang của app (chặn trang lạ gửi vị trí giả)
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return json({ error: "Sai nguồn gửi" }, 403);
  const me = await currentUser();
  if (!me) return json({ error: "Chưa đăng nhập" }, 401);
  const { id } = await params;
  try {
    const body = (await req.json()) as { lat?: unknown; lng?: unknown; stop?: unknown };
    if (body.stop === true) await stopSharing(me.id, id);
    else await shareLocation(me.id, id, Number(body.lat), Number(body.lng));
    return json(await trackingView(me.id, id));
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: "Không gửi được vị trí." }, 500);
  }
}
