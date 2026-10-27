import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { offerHelpAction, registerHelperAction, settleCommissionAction } from "@/app/actions";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead, StatusBadge } from "@/components/ui";
import { FEE_MAX, FEE_MIN, OWED_DAYS, OWED_LIMIT, showVnd } from "@/domain/money";
import type { Status } from "@/domain/state";
import { BANKS, bankName } from "@/domain/vietqr";
import { db } from "@/server/db";
import { earnings, paidBoard } from "@/server/earn";
import { currentUser } from "@/server/queries";

const pct = (r: number) => `${Math.round(r * 100)}%`;

export default async function EarnPage() {
  const me = await currentUser();
  if (!me?.isParent) redirect("/");
  const prof = await db.helperProfile.findUnique({ where: { userId: me.id } });
  const approved = prof?.status === "DA_DUYET";
  const [board, earn] = await Promise.all([approved ? paidBoard(me.id) : [], earnings(me.id)]);
  const settleSvg = earn.settleQr ? await QRCode.toString(earn.settleQr.qr, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <>
      <PageHead title="Kiếm thêm khi đón hộ" sub="Đón giúp con của phụ huynh cùng trường và nhận thù lao. Mỗi lượt vẫn qua đủ 3 bên xác nhận và kiểm tra tại cổng." />

      {approved && (
        <div className="stat-row">
          <div><div className="k">Tháng này</div><div className="money-lg">{showVnd(earn.month.net)}</div><div className="small muted">{earn.month.jobs} lượt · thực nhận sau phí</div></div>
          <div><div className="k">Chờ phụ huynh chuyển</div><div className="money-lg">{showVnd(earn.waitingPay)}</div></div>
          <div><div className="k">Phí nền tảng còn nợ</div><div className="money-lg">{showVnd(earn.owed.amount)}</div>{earn.owed.overdue && <div className="small" style={{ color: "var(--danger)" }}>Quá hạn — tạm không nhận việc mới</div>}</div>
        </div>
      )}

      <div className="row">
        <div className="col">
          {approved ? (
            <div className="card">
              <h2>Việc đón trong trường {board.length > 0 && <span className="count">{board.length}</span>}</h2>
              {board.length === 0 ? <Empty icon="hand">Chưa có lời nhờ có thù lao nào. Khi có, bạn sẽ nhận thông báo.</Empty> : board.map((b) => (
                <div key={b.id} className="job">
                  <div>
                    <strong>{b.className}</strong> · {b.when}
                    <div className="meta">{b.ward ? `Trả bé ở ${b.ward}` : "Điểm trả: hỏi phụ huynh"}{b.note ? ` · “${b.note}”` : ""}</div>
                    <div className="meta">Thù lao từ <span className="money">{showVnd(b.fee)}</span> · bạn nhận từ <span className="money">{showVnd(b.net)}</span>{b.offers ? ` · ${b.offers} người đã nhận` : ""}</div>
                  </div>
                  {b.offered ? <span className="badge badge-ok"><Icon name="check" size={16} />Đã nhận, chờ chọn</span> : (
                    <ActionForm action={offerHelpAction} className="inline">
                      <input type="hidden" name="postId" value={b.id} />
                      <input type="hidden" name="note" value="Người đón có phí của trường" />
                      <SubmitButton className="btn btn-accent btn-sm" confirm={`Nhận đón lượt này với thù lao tối thiểu ${showVnd(b.fee)}? Nếu phụ huynh chọn bạn, bạn vẫn phải xác nhận và được cô duyệt.`}><Icon name="hand" size={16} />Tôi nhận đón</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <h2>{prof ? "Hồ sơ người đón có phí" : "Đăng ký làm người đón có phí"}</h2>
              {prof?.status === "CHO_DUYET" && <Note>Đã gửi đăng ký. Đang chờ cô giáo lớp của con bạn duyệt. Bạn có thể sửa và gửi lại bên dưới.</Note>}
              {prof?.status === "TU_CHOI" && <Note kind="warn">Đăng ký chưa được duyệt. Lý do: {prof.note}. Sửa thông tin rồi gửi lại.</Note>}
              {prof?.status === "TAM_DUNG" ? <Note kind="error">Tài khoản người đón có phí đang bị tạm dừng. Lý do: {prof.note}. Liên hệ giáo viên.</Note> : (
                <ActionForm action={registerHelperAction}>
                  <div className="field">
                    <label htmlFor="cccd">4 số cuối CCCD</label>
                    <input id="cccd" name="cccdLast4" type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={prof?.cccdLast4} required />
                    <p className="hint">Cô giáo đối chiếu CCCD bản gốc ở cổng mỗi lần đón.</p>
                  </div>
                  <PhotoInput name="photo" label={prof ? "Chụp lại ảnh chân dung (không bắt buộc)" : "Chụp ảnh chân dung của bạn"} capture="user" required={!prof} />
                  <div className="fields">
                    <div className="field">
                      <label htmlFor="bankBin">Ngân hàng nhận tiền</label>
                      <select id="bankBin" name="bankBin" defaultValue={prof?.bankBin ?? ""} required>
                        <option value="" disabled>Chọn ngân hàng</option>
                        {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="bankAccount">Số tài khoản</label>
                      <input id="bankAccount" name="bankAccount" type="text" inputMode="numeric" autoComplete="off" defaultValue={prof?.bankAccount} required />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="accountName">Tên chủ tài khoản</label>
                    <input id="accountName" name="accountName" type="text" autoComplete="off" placeholder="NGUYEN VAN A" defaultValue={prof?.accountName} required />
                    <p className="hint">Tài khoản phải đứng tên chính bạn. Phụ huynh nhờ đón sẽ thấy tên và số tài khoản này để chuyển thù lao.</p>
                  </div>
                  <div className="checks mb-10">
                    <label>
                      <input type="checkbox" name="agree" value="1" required />
                      <span>Tôi đồng ý quy định người đón có phí (bên cạnh) và chịu trách nhiệm đưa bé về đúng điểm trả.</span>
                    </label>
                  </div>
                  <SubmitButton className="btn btn-block">{prof ? "Gửi lại để cô duyệt" : "Gửi đăng ký"}</SubmitButton>
                </ActionForm>
              )}
            </div>
          )}

          {earn.jobs.length > 0 && (
            <div className="card">
              <h2>Lượt đón có phí của bạn</h2>
              {earn.jobs.map((j) => (
                <div key={j.id} className="job">
                  <div>
                    <Link href={`/yeu-cau/${j.id}`}><strong>{j.className}</strong> · {j.when}</Link>
                    <div className="meta">{j.paid ? <><span className="money">+{showVnd(j.paid - j.commission)}</span> thực nhận · phí nền tảng −{showVnd(j.commission)}</> : <>Thù lao từ <span className="money">{showVnd(j.fee)}</span></>}</div>
                  </div>
                  {j.status === "HOAN_TAT"
                    ? <span className={`badge ${j.receivedAt ? "badge-ok" : j.paidAt ? "badge-info" : "badge-warn"}`}>{j.receivedAt ? "Đã nhận tiền" : j.paidAt ? "PH báo đã chuyển" : "Chờ PH chuyển"}</span>
                    : <StatusBadge status={j.status as Status} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col">
          {approved && earn.owed.amount > 0 && (
            <div className="card">
              <h2>Nộp phí nền tảng</h2>
              <p className="small muted">Phí {pct(earn.rate)} trên số tiền thực nhận mỗi lượt. Nợ từ {showVnd(OWED_LIMIT)} và quá {OWED_DAYS} ngày thì tạm không nhận việc có phí mới.</p>
              {earn.settleQr && settleSvg ? (
                <div className="pay-box">
                  <div className="qr" role="img" aria-label={`Mã VietQR nộp ${showVnd(earn.owed.amount)} phí nền tảng`} dangerouslySetInnerHTML={{ __html: settleSvg }} />
                  <dl className="kv">
                    <dt>Số tiền</dt><dd className="money">{showVnd(earn.owed.amount)}</dd>
                    <dt>Ngân hàng</dt><dd>{earn.settleQr.bank}</dd>
                    <dt>Tài khoản</dt><dd>{earn.settleQr.account}</dd>
                    <dt>Chủ TK</dt><dd>{earn.settleQr.name}</dd>
                    <dt>Nội dung</dt><dd>{earn.settleQr.note}</dd>
                  </dl>
                </div>
              ) : <Note kind="warn">Nền tảng chưa cấu hình tài khoản nhận phí.</Note>}
              <ActionForm action={settleCommissionAction} className="mt-10">
                <SubmitButton className="btn" confirm={`Bạn đã chuyển ${showVnd(earn.owed.amount)} phí nền tảng?`}><Icon name="check" size={16} />Tôi đã nộp phí</SubmitButton>
              </ActionForm>
            </div>
          )}
          <div className="card card-soft">
            <h3>Quy định người đón có phí</h3>
            <ul className="small mb-0">
              <li>Chỉ phụ huynh có con học cùng trường, đã khai CCCD, ảnh chân dung và được cô giáo lớp của con mình duyệt.</li>
              <li>Phụ huynh nhờ đặt mức tối thiểu ({showVnd(FEE_MIN)}–{showVnd(FEE_MAX)}/lượt); khi bé về an toàn họ tự chuyển từ mức đó trở lên kèm lời cảm ơn. Có thể thoả thuận thêm trong nhóm. Phí nền tảng {pct(earn.rate)} tính trên số thực nhận.</li>
              <li>Mỗi lượt vẫn phải: phụ huynh chọn bạn → bạn xác nhận → cô duyệt → kiểm mã, ảnh, CCCD tại cổng.</li>
              <li>Phụ huynh chuyển khoản <strong>thẳng cho bạn</strong> sau khi bé về an toàn. App không giữ tiền. Không nhận tiền trước, không đòi thêm.</li>
              <li>Thông tin của bé chỉ dùng cho lượt đón; không chụp ảnh, không chia sẻ.</li>
              <li>Vi phạm hoặc bị phản ánh: giáo viên tạm dừng tài khoản.</li>
              <li>Lượt đón có phí không cộng điểm tương trợ.</li>
              <li>Thu nhập này có thể phải kê khai thuế thu nhập cá nhân theo quy định.</li>
            </ul>
          </div>
          {prof && <p className="small muted">Tài khoản nhận tiền: {bankName(prof.bankBin)} · {prof.bankAccount} · {prof.accountName}</p>}
        </div>
      </div>
    </>
  );
}
