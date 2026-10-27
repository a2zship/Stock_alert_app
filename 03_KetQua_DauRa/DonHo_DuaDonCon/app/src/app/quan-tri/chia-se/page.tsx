import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { markPayoutAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Note, PageHead } from "@/components/ui";
import { showVnd } from "@/domain/money";
import { SHARE_LABEL } from "@/domain/share";
import { currentUser } from "@/server/queries";
import { payoutQueue, recentPayouts } from "@/server/share";

const showMonth = (m: string) => { const [y, mm] = m.split("-"); return `tháng ${Number(mm)}/${y}`; };

export default async function AdminSharePage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (!me.isPlatformAdmin) redirect("/");
  const [queue, done] = await Promise.all([payoutQueue(me.id), recentPayouts(me.id)]);
  const svgs = await Promise.all(queue.map((q) => (q.qr ? QRCode.toString(q.qr, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null)));

  return (
    <>
      <PageHead title="Chuyển chia sẻ doanh thu" sub="Các khoản đã qua đối soát, đến hạn chuyển cho nhà trường và giáo viên. Chuyển khoản xong mới bấm Đã chuyển." />
      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Đến hạn chuyển {queue.length > 0 && <span className="count">{queue.length}</span>}</h2>
            {queue.length === 0 ? <Empty icon="banknote">Không có khoản nào đến hạn.</Empty> : queue.map((q, i) => (
              <div key={q.key} className="list-item">
                <div className="list-row">
                  <span className="desc"><strong>{q.who}</strong> · {SHARE_LABEL[q.kind]} · {showMonth(q.month)}</span>
                  <span className="money">{showVnd(q.amount)}</span>
                </div>
                {q.kind === "GIAO_VIEN" && <div className="meta">{q.school}</div>}
                {q.pay && svgs[i] ? (
                  <div className="pay-box mt-10">
                    <div className="qr" role="img" aria-label={`Mã VietQR chuyển ${showVnd(q.amount)} cho ${q.who}`} dangerouslySetInnerHTML={{ __html: svgs[i]! }} />
                    <dl className="kv">
                      <dt>Ngân hàng</dt><dd>{q.bank}</dd>
                      <dt>Tài khoản</dt><dd>{q.pay.account}</dd>
                      <dt>Chủ TK</dt><dd>{q.pay.name}</dd>
                      <dt>Nội dung</dt><dd>{q.note}</dd>
                    </dl>
                  </div>
                ) : <Note kind="warn">Người nhận chưa khai tài khoản ngân hàng.</Note>}
                {q.pay && (
                  <ActionForm action={markPayoutAction} className="mt-10">
                    <input type="hidden" name="key" value={q.key} />
                    <SubmitButton className="btn btn-ok btn-sm" confirm={`Đã chuyển ${showVnd(q.amount)} cho ${q.who}?`}>Đã chuyển</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="card">
            <h2>Đã chuyển gần đây</h2>
            {done.length === 0 ? <Empty icon="checkCircle">Chưa có.</Empty> : done.map((p) => (
              <div key={p.id} className="job">
                <div>
                  <strong>{p.school?.name ?? p.user?.name}</strong> · {SHARE_LABEL[p.kind]} · {showMonth(p.month)}
                  <div className="meta">{p.bank} · {p.paidAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
                </div>
                <span className="money">{showVnd(p.amount)}</span>
              </div>
            ))}
          </div>
          <Note kind="warn">Thu nhập của giáo viên: nền tảng có thể phải khấu trừ thuế thu nhập cá nhân trước khi chuyển. [CẦN XÁC MINH với kế toán]</Note>
        </div>
      </div>
    </>
  );
}
