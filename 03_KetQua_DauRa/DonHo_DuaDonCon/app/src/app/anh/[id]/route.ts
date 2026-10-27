// Ảnh chỉ trả về cho người có quyền xem; không cache công khai.
import { canViewPhoto } from "@/server/access";
import { db } from "@/server/db";
import { currentUser } from "@/server/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  const { id } = await params;
  if (!me || !(await canViewPhoto(me.id, id))) return new Response("Không tìm thấy", { status: 404 });
  const p = await db.photo.findUniqueOrThrow({ where: { id } });
  return new Response(new Uint8Array(p.bytes), {
    headers: { "content-type": p.mime, "cache-control": "private, max-age=300", "content-security-policy": "default-src 'none'" },
  });
}
