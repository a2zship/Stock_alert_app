import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Note } from "@/components/ui";
import { provinces } from "@/server/area";
import { db } from "@/server/db";
import { currentUser } from "@/server/queries";
import { OpenSchoolForm } from "./OpenSchoolForm";

// Nhà trường tự mở trường. Đường dẫn phụ huynh gửi trường có sẵn ?phuong=<id>&ten=<tên trường> để điền trước.
export default async function OpenSchoolPage({ searchParams }: { searchParams: Promise<{ phuong?: string; ten?: string }> }) {
  const me = await currentUser();
  const q = await searchParams;
  const wardId = Number(q.phuong);
  const ward = Number.isInteger(wardId) && wardId > 0 ? await db.ward.findUnique({ where: { id: wardId } }) : null;
  const schoolName = q.ten?.slice(0, 120);
  return (
    <div className="login-wrap">
      <div className="card login-card login-card-wide">
        <span className="logo-mark"><Icon name="school" size={24} /></span>
        <h1>Mở Đón Hộ cho trường</h1>
        <p className="muted">Trường không mất phí. Sau khi mở, bạn thêm lớp và số điện thoại cô phụ trách; cô nhận tin mời và gửi đường dẫn cho phụ huynh.</p>
        <ul className="login-points">
          <li><Icon name="banknote" size={16} />Trường nhận 10%, cô lớp nhận 5% doanh thu phát sinh ở lớp</li>
          <li><Icon name="shield" size={16} />Đón Hộ gọi điện xác minh trường trước khi mở đón có phí</li>
          <li><Icon name="clock" size={16} />Khoảng 3 phút</li>
        </ul>
        {me && <Note kind="info">Bạn đang đăng nhập là <strong>{me.name}</strong>. Trường mới sẽ do tài khoản này quản lý.</Note>}
        <OpenSchoolForm provinces={await provinces()} signedIn={!!me} schoolName={schoolName}
          defaults={ward ? { provinceId: ward.provinceId, wardId: ward.verified ? ward.id : null, wardName: ward.verified ? null : ward.name } : undefined} />
        {!me && <p className="small muted mt-15 mb-0">Đã có tài khoản? <Link href="/dang-nhap?next=/mo-truong">Đăng nhập</Link> rồi mở trường.</p>}
        {process.env.DEV_INBOX === "1" && !me && <p className="small muted mt-10">Bản thử nghiệm chưa gửi SMS thật. Xem mã ở <a href="/thu-nghiem">Hộp tin thử nghiệm</a>.</p>}
      </div>
    </div>
  );
}
