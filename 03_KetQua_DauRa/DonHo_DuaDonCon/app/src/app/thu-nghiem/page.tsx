import { notFound } from "next/navigation";
import { Empty, Note, PageHead } from "@/components/ui";
import { maskPhone } from "@/domain/phone";
import { showDateTime } from "@/domain/time";
import { devInbox } from "@/server/queries";

// Hộp tin thử nghiệm: các SMS lẽ ra được gửi (kể cả OTP). Chỉ bật khi DEV_INBOX=1 — TẮT khi chạy thật.
export default async function DevInbox() {
  if (process.env.DEV_INBOX !== "1") notFound();
  const msgs = await devInbox();
  return (
    <div className="container">
      <PageHead title="Hộp tin thử nghiệm" sub="Tin nhắn SMS mà hệ thống lẽ ra gửi tới điện thoại. Trang này chỉ có ở bản thử nghiệm." />
      <Note kind="warn">Trang này hiện mã đăng nhập của mọi người. Phải tắt (DEV_INBOX=0) trước khi cho người thật dùng.</Note>
      <div className="card">
        <h2>Tài khoản mẫu</h2>
        <dl className="kv">
          <dt>Phụ huynh (bố bé An)</dt><dd>0901000001</dd>
          <dt>Phụ huynh (mẹ bé An)</dt><dd>0901000002</dd>
          <dt>Phụ huynh (mẹ bé Bình)</dt><dd>0901000003</dd>
          <dt>Cô giáo lớp Lá 1</dt><dd>0901000010</dd>
          <dt>Cô giáo lớp Chồi 2</dt><dd>0901000011</dd>
          <dt>Bà ngoại bé An (tin cậy)</dt><dd>0901000020</dd>
        </dl>
      </div>
      <div className="card">
        <h2>Tin gần nhất</h2>
        {msgs.length === 0 ? <Empty>Chưa có tin nào.</Empty> : msgs.map((m) => (
          <div key={m.id} className="list-item">
            <div className="list-row"><span className="desc">Tới {maskPhone(m.toPhone)} <span className="muted">({m.toPhone})</span></span><span className="meta">{showDateTime(m.createdAt)}</span></div>
            <div className="msg-body small">{m.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
