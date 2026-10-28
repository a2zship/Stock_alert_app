import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { CopyText, PrintButton } from "@/components/CopyText";
import { FunnelSteps } from "@/components/FunnelSteps";
import { Icon } from "@/components/Icon";
import { Note, PageHead } from "@/components/ui";
import { MIN_HELPERS, MIN_PARENTS, STAGE_NEXT } from "@/domain/sales";
import { AppError } from "@/server/db";
import { currentUser } from "@/server/queries";
import { classKit } from "@/server/sales";

// Bộ khởi động của một lớp: đường dẫn đăng ký điền sẵn lớp, áp phích QR để in, tin mẫu cho nhóm Zalo và cho người đón tiên phong.
export default async function ClassKitPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const { id } = await params;
  let kit;
  try {
    kit = await classKit(me.id, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const qr = await QRCode.toString(kit.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <>
      <PageHead title={`Bộ khởi động · ${kit.cls.name}`} sub={`${kit.cls.school.name}. Gửi đường dẫn hoặc dán áp phích để phụ huynh tự đăng ký; cô gọi xác minh rồi xác nhận từng người.`}>
        {kit.isAdmin && <Link href="/truong" className="btn btn-plain btn-sm">Về trang trường</Link>}
        {me.isTeacher && <Link href="/giao-vien/phu-huynh-moi" className="btn btn-plain btn-sm">Xác nhận phụ huynh mới</Link>}
      </PageHead>

      <div className="stats">
        <div className="stat"><div className="label">Phụ huynh đã xác nhận ở lớp</div><div className="value">{kit.parents}</div><div className="hint">Cả trường cần ít nhất {MIN_PARENTS}</div></div>
        <div className="stat"><div className="label">Đang chờ cô xác nhận</div><div className="value">{kit.waitingClaims}</div></div>
        <div className="stat"><div className="label">Người đón có phí của trường</div><div className="value">{kit.counts.helpers}</div><div className="hint">Cần ít nhất {MIN_HELPERS}</div></div>
      </div>

      <div className="card">
        <h2>Trường đang ở bước nào</h2>
        <FunnelSteps stage={kit.stage} />
        <Note kind="info"><strong>Việc tiếp theo:</strong> {STAGE_NEXT[kit.stage]}</Note>
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h2><Icon name="send" /> Tin gửi nhóm Zalo phụ huynh</h2>
            <p className="meta">Sao chép, dán vào nhóm Zalo của lớp. Đường dẫn đã chọn sẵn trường và lớp.</p>
            <CopyText id="msg-parents" label="Tin gửi phụ huynh" text={kit.msgParents} rows={9} />
          </div>
          <div className="card">
            <h2><Icon name="heart" /> Tin mời người đón tiên phong</h2>
            <p className="meta">Gửi riêng cho 2–3 phụ huynh hay đón con sớm, nhà gần trường.</p>
            <CopyText id="msg-helpers" label="Tin mời người đón" text={kit.msgHelpers} rows={9} />
          </div>
          <div className="card">
            <h2><Icon name="mapPin" /> Đường dẫn đăng ký của lớp</h2>
            <CopyText id="class-url" label="Đường dẫn đăng ký" text={kit.url} />
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-head">
              <h2><Icon name="qr" /> Áp phích dán cửa lớp</h2>
              <PrintButton>In áp phích</PrintButton>
            </div>
            <div className="poster">
              <p className="poster-eyebrow">{kit.cls.school.name} · Lớp {kit.cls.name}</p>
              <p className="poster-title">Bận đột xuất? Nhờ đón con qua Đón Hộ</p>
              <div className="qr" role="img" aria-label={`Mã QR đăng ký Đón Hộ lớp ${kit.cls.name}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <ul className="poster-points">
                <li>Cô xác minh người đón tại cổng</li>
                <li>Theo dõi bé trên bản đồ tới khi về nhà</li>
                <li>Phụ huynh cùng lớp đón giúp nhau</li>
              </ul>
              <p className="poster-foot">Quét mã để đăng ký — miễn phí, khoảng 2 phút</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
