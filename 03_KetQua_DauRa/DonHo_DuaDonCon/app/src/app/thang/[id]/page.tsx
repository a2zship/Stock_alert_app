import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import {
  cancelMonthlyAction, chooseMonthlyAction, endMonthlyAction, helperRespondMonthlyAction, markMonthlyPaidAction, markMonthlyReceivedAction,
  markRefundedAction, missMonthlyDayAction, skipMonthlyDayAction, teacherDecideMonthlyAction,
} from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Note, PageHead, Photo } from "@/components/ui";
import { showVnd } from "@/domain/money";
import { MONTHLY_LABEL, NOTICE_DAYS, REFUND_DAYS, showDays, showMonth, weekdayOf, WEEKDAYS } from "@/domain/monthly";
import { maskPhone } from "@/domain/phone";
import { showDateTime } from "@/domain/time";
import { monthlyDetail, monthlyPayInfo, type DayState } from "@/server/monthly";
import { currentUser } from "@/server/queries";

const DAY: Record<DayState, { label: string; tone: "ok" | "info" | "warn" | "danger" | "muted" }> = {
  SAP_TOI: { label: "Sắp tới", tone: "muted" },
  HOM_NAY: { label: "Hôm nay", tone: "info" },
  DANG_DON: { label: "Đã có mã", tone: "info" },
  HOAN_TAT: { label: "Đã đón", tone: "ok" },
  PH_HUY: { label: "PH huỷ", tone: "muted" },
  NGUOI_DON_NGHI: { label: "Người đón nghỉ", tone: "danger" },
  KHONG_DON: { label: "Không đón", tone: "warn" },
  SAU_KET_THUC: { label: "Sau khi dừng", tone: "muted" },
};
const dd = (d: string) => `${WEEKDAYS.find((w) => w.n === weekdayOf(d))?.short ?? "CN"} ${d.slice(8)}/${d.slice(5, 7)}`;

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const { id } = await params;
  const v = await monthlyDetail(me.id, id);
  if (!v) notFound();
  const { c, role, days, today, total } = v;
  const st = MONTHLY_LABEL[c.status];
  const asParent = role === "PHU_HUYNH";
  const asHelper = role === "NGUOI_DON";
  const asTeacher = role === "GIAO_VIEN";
  const pay = asParent && !c.paidAt ? await monthlyPayInfo(me.id, c.id) : null;
  const paySvg = pay ? await QRCode.toString(pay.qr, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const upcoming = days.filter((d) => (d.state === "SAP_TOI" || d.state === "HOM_NAY" || d.state === "DANG_DON") && d.date >= today);
  const prof = c.helper?.helper;
  const done = days.filter((d) => d.state === "HOAN_TAT").length;

  return (
    <>
      <PageHead title={`Đón bé ${c.student.name} ${showMonth(c.month)}`} sub={`${c.student.class.name} · ${c.student.class.school.name}`}>
        <span className={`badge badge-${st.tone}`}>{st.label}</span>
      </PageHead>

      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Hợp đồng</h2>
            <dl className="kv">
              <dt>Lịch</dt><dd>{showDays(c.weekdays)} · {c.student.class.pickupStart}–{c.student.class.pickupEnd} · {total} buổi</dd>
              <dt>Trọn gói</dt><dd className="money">{showVnd(c.fee)}</dd>
              <dt>Người đón</dt><dd>{c.helper ? `${c.helper.name} · ${maskPhone(c.helper.phone)}` : "Chưa có"}{c.designated ? " (phụ huynh chỉ định)" : ""}</dd>
              {c.dropWard && <><dt>Điểm trả</dt><dd>{c.dropLabel} · {asTeacher || asParent || c.status === "DA_DUYET" ? [c.dropAddress, c.dropWard].filter(Boolean).join(", ") : c.dropWard}</dd></>}
              {c.note && <><dt>Lời nhắn</dt><dd>{c.note}</dd></>}
              {c.decidedAt && <><dt>Cô duyệt</dt><dd>{showDateTime(c.decidedAt)}{c.teacherCalledParent ? " · đã gọi xác minh phụ huynh" : ""}</dd></>}
              {c.paidAt && <><dt>Trả trọn gói</dt><dd><span className="money">{showVnd(c.paidAmount!)}</span> · {showDateTime(c.paidAt)}{c.receivedAt ? " · người đón đã nhận" : ""}</dd></>}
              {c.endedAt && <><dt>Kết thúc</dt><dd>{showDateTime(c.endedAt)}{c.endReason ? ` · ${c.endReason}` : ""}</dd></>}
            </dl>
            {asHelper && c.paidAmount && c.commission != null && (
              <p className="small muted mt-10">Bạn thực nhận <span className="money">+{showVnd(c.paidAmount - (c.refundDue ?? 0) - c.commission)}</span> sau phí nền tảng −{showVnd(c.commission)}{c.refundDue ? ` và khoản hoàn −${showVnd(c.refundDue)}` : ""}.</p>
            )}
          </div>

          {/* ── Tìm người: phụ huynh chọn trong số người muốn nhận ── */}
          {asParent && c.status === "TIM_NGUOI" && (
            <div className="card">
              <h2>Người muốn nhận đón {c.offers.length > 0 && <span className="count">{c.offers.length}</span>}</h2>
              {c.priorityUntil && new Date() < c.priorityUntil && <Note>Đang trong 24 giờ ưu tiên thành viên Kim cương (tới {showDateTime(c.priorityUntil)}). Sau đó mọi người đón có phí của trường đều thấy.</Note>}
              {c.offers.length === 0 ? <p className="small muted mb-0">Chưa có ai nhận. Bạn sẽ nhận thông báo khi có người.</p> : c.offers.map((o) => (
                <div key={o.id} className="job">
                  <div className="kid">
                    <Photo id={o.user.helper?.photoId} alt={`Ảnh ${o.user.name}`} size={48} />
                    <div><strong>{o.user.name}</strong><div className="meta">Người đón có phí đã được duyệt · {maskPhone(o.user.phone)}</div></div>
                  </div>
                  <ActionForm action={chooseMonthlyAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="helperId" value={o.userId} />
                    <SubmitButton className="btn btn-sm" confirm={`Chọn ${o.user.name} đón bé cả ${showMonth(c.month)}? Sau đó cô sẽ duyệt.`}>Chọn người này</SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}

          {/* ── Người được chỉ định trả lời ── */}
          {asHelper && c.status === "CHO_NGUOI_DON" && (
            <div className="card">
              <h2>Phụ huynh chỉ định bạn đón cả tháng</h2>
              <p className="small muted">Nhận lời thì cô lớp của bé sẽ duyệt. Sau khi phụ huynh chuyển trọn gói, mỗi buổi bạn nhận mã đón qua tin nhắn.</p>
              <ActionForm action={helperRespondMonthlyAction}>
                <input type="hidden" name="id" value={c.id} />
                <div className="field"><label htmlFor="note">Lời nhắn khi từ chối (không bắt buộc)</label><input id="note" name="note" type="text" maxLength={200} /></div>
                <div className="actions">
                  <SubmitButton className="btn btn-ok" name="decision" value="accept"><Icon name="check" size={16} />Nhận lời</SubmitButton>
                  <SubmitButton className="btn btn-plain" name="decision" value="decline" noValidate>Từ chối</SubmitButton>
                </div>
              </ActionForm>
            </div>
          )}

          {/* ── Cô duyệt một lần ── */}
          {asTeacher && c.status === "CHO_GIAO_VIEN" && c.helper && (
            <div className="card">
              <h2>Duyệt người đón cả tháng</h2>
              <div className="kid mb-10">
                <Photo id={prof?.photoId} alt={`Ảnh ${c.helper.name}`} size={72} />
                <div>
                  <strong>{c.helper.name}</strong>
                  <div className="meta">{maskPhone(c.helper.phone)} · CCCD đuôi {prof?.cccdLast4} · người đón có phí {prof?.status === "DA_DUYET" ? "đã được duyệt" : "CHƯA được duyệt"}</div>
                </div>
              </div>
              <p className="small muted">Duyệt một lần cho {total} buổi. Mỗi buổi app tự tạo mã mới; tại cổng cô vẫn quét mã, đối chiếu ảnh và CCCD bản gốc.</p>
              <ActionForm action={teacherDecideMonthlyAction}>
                <input type="hidden" name="id" value={c.id} />
                <div className="checks mb-10">
                  <label><input type="checkbox" name="calledParent" /><span>Tôi đã gọi điện cho phụ huynh ({maskPhone(c.requester.phone)}) xác nhận người đón và lịch này</span></label>
                </div>
                <div className="field"><label htmlFor="tnote">Ghi chú / lý do từ chối</label><input id="tnote" name="note" type="text" maxLength={200} /></div>
                <div className="actions">
                  <SubmitButton className="btn btn-ok" name="decision" value="approve"><Icon name="shield" size={16} />Duyệt cả tháng</SubmitButton>
                  <SubmitButton className="btn btn-danger" name="decision" value="reject" noValidate>Từ chối</SubmitButton>
                </div>
              </ActionForm>
            </div>
          )}

          {/* ── Trả trọn gói ── */}
          {asParent && c.status === "DA_DUYET" && !c.paidAt && (
            <div className="card" id="tra-tien">
              <h2>Chuyển trọn gói để bắt đầu lịch đón</h2>
              <p className="small muted">Tiền chuyển <strong>thẳng cho người đón</strong>, app không giữ tiền. Chưa chuyển thì app chưa tạo mã đón cho các buổi.</p>
              {pay && paySvg ? (
                <>
                  <div className="pay-box">
                    <div className="qr" role="img" aria-label={`Mã VietQR chuyển ${showVnd(pay.amount)} cho ${pay.accountName}`} dangerouslySetInnerHTML={{ __html: paySvg }} />
                    <dl className="kv">
                      <dt>Số tiền</dt><dd className="money">{showVnd(pay.amount)}</dd>
                      <dt>Ngân hàng</dt><dd>{pay.bank}</dd>
                      <dt>Tài khoản</dt><dd>{pay.account}</dd>
                      <dt>Chủ TK</dt><dd>{pay.accountName}</dd>
                      <dt>Nội dung</dt><dd>{pay.note}</dd>
                    </dl>
                  </div>
                  <ActionForm action={markMonthlyPaidAction} className="mt-10">
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn btn-ok" confirm={`Bạn đã chuyển ${showVnd(pay.amount)} cho ${pay.accountName}?`}><Icon name="check" size={16} />Tôi đã chuyển khoản</SubmitButton>
                  </ActionForm>
                </>
              ) : <Note kind="warn">Không lấy được tài khoản của người đón.</Note>}
            </div>
          )}
          {asHelper && c.status === "DA_DUYET" && !c.receivedAt && (
            <div className="card">
              <h2>Trọn gói {showVnd(c.fee)}</h2>
              <p className="small muted">{c.paidAt ? "Phụ huynh báo đã chuyển. Kiểm tra tài khoản rồi xác nhận." : "Chờ phụ huynh chuyển. Lịch đón bắt đầu khi có tiền — nếu đã nhận, bấm xác nhận."}</p>
              <ActionForm action={markMonthlyReceivedAction}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="btn btn-ok" confirm={`Bạn đã nhận ${showVnd(c.fee)} trọn gói?`}><Icon name="wallet" size={16} />Đã nhận tiền</SubmitButton>
              </ActionForm>
            </div>
          )}

          {/* ── Hoàn tiền ── */}
          {c.refundDue && (asParent || asHelper) ? (
            <div className={`card${c.refundedAt ? "" : " alert-banner"}`}>
              <h2>Hoàn tiền {showVnd(c.refundDue)}</h2>
              {c.refundedAt ? <Note kind="ok">Đã hoàn lúc {showDateTime(c.refundedAt)}.</Note> : (
                <>
                  <p className="small muted">{asHelper ? `Chuyển lại ${showVnd(c.refundDue)} cho phụ huynh (${maskPhone(c.requester.phone)}) trong ${REFUND_DAYS} ngày cho các buổi không đón. Quá hạn thì tạm không nhận việc có phí mới.` : `Người đón hoàn ${showVnd(c.refundDue)} cho các buổi không đón, trong ${REFUND_DAYS} ngày. Nhận được thì bấm xác nhận.`}</p>
                  <ActionForm action={markRefundedAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn btn-ok" confirm={asHelper ? `Bạn đã chuyển ${showVnd(c.refundDue)}?` : `Bạn đã nhận ${showVnd(c.refundDue)}?`}><Icon name="check" size={16} />{asHelper ? "Đã hoàn tiền" : "Đã nhận hoàn tiền"}</SubmitButton>
                  </ActionForm>
                </>
              )}
            </div>
          ) : null}

          {/* ── Lịch từng buổi ── */}
          {total > 0 && ["DA_DUYET", "KET_THUC"].includes(c.status) && (
            <div className="card">
              <h2>Lịch đón {c.paidAt && <span className="small muted">· {done}/{total} buổi đã đón</span>}</h2>
              <ul className="day-grid">
                {days.map((d) => (
                  <li key={d.date} className={`day day-${DAY[d.state].tone}`}>
                    {d.requestId ? <Link href={`/yeu-cau/${d.requestId}`}><strong>{dd(d.date)}</strong></Link> : <strong>{dd(d.date)}</strong>}
                    <span>{DAY[d.state].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="col">
          {c.status === "DA_DUYET" && (asParent || asHelper) && upcoming.length > 0 && (
            <div className="card">
              <h2>{asParent ? "Huỷ một buổi" : "Báo nghỉ một buổi"}</h2>
              <p className="small muted">{asParent ? "Bé nghỉ học hoặc có người nhà đón. Người đón được báo; buổi huỷ không hoàn tiền." : "Phụ huynh và cô được báo ngay để nhờ người khác. Buổi nghỉ được hoàn tiền cho phụ huynh."}</p>
              <ActionForm action={asParent ? skipMonthlyDayAction : missMonthlyDayAction}>
                <input type="hidden" name="id" value={c.id} />
                <div className="field">
                  <label htmlFor="date">Buổi</label>
                  <select id="date" name="date" required>{upcoming.map((d) => <option key={d.date} value={d.date}>{dd(d.date)}{d.date === today ? " (hôm nay)" : ""}</option>)}</select>
                </div>
                {asHelper && <div className="field"><label htmlFor="mnote">Lý do</label><input id="mnote" name="note" type="text" maxLength={200} placeholder="Ốm, đi công tác…" /></div>}
                <SubmitButton className="btn btn-plain" confirm={asParent ? "Huỷ buổi đón này?" : "Báo nghỉ buổi này? Phụ huynh sẽ phải nhờ người khác."}><Icon name="x" size={16} />{asParent ? "Huỷ buổi" : "Báo nghỉ"}</SubmitButton>
              </ActionForm>
            </div>
          )}

          {c.status === "DA_DUYET" && (asParent || asHelper) && (
            <div className="card">
              <h2>Dừng hợp đồng sớm</h2>
              <p className="small muted">{asParent
                ? `Buổi hôm nay vẫn đón. Người đón hoàn các buổi còn lại, trừ ${NOTICE_DAYS} buổi báo trước.`
                : "Mã đón hôm nay (nếu có) bị huỷ. Bạn hoàn mọi buổi còn lại cho phụ huynh."}</p>
              <ActionForm action={endMonthlyAction}>
                <input type="hidden" name="id" value={c.id} />
                <div className="field"><label htmlFor="reason">Lý do</label><input id="reason" name="reason" type="text" maxLength={200} required /></div>
                <SubmitButton className="btn btn-danger" confirm="Dừng hợp đồng đón theo tháng? Không hoàn tác được.">Dừng hợp đồng</SubmitButton>
              </ActionForm>
            </div>
          )}

          {asParent && ["TIM_NGUOI", "CHO_NGUOI_DON", "CHO_GIAO_VIEN"].includes(c.status) && (
            <ActionForm action={cancelMonthlyAction}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-plain btn-block" confirm="Huỷ hợp đồng này?"><Icon name="x" size={16} />Huỷ hợp đồng</SubmitButton>
            </ActionForm>
          )}
          {c.status === "DA_DUYET" && prof && prof.status !== "DA_DUYET" && <Note kind="error">Người đón đang bị tạm dừng nhận đón có phí — app ngừng tạo mã đón. Phụ huynh cần nhờ người khác và dừng hợp đồng.</Note>}
          <div className="card card-soft">
            <h3>An toàn mỗi buổi</h3>
            <ul className="small mb-0">
              <li>Mã QR/PIN mới mỗi buổi, chỉ dùng trong khung giờ đón.</li>
              <li>Cô vẫn đối chiếu khuôn mặt, CCCD bản gốc và bé nhận ra người đón.</li>
              <li>Phụ huynh vẫn bấm &quot;Con đã về an toàn&quot; mỗi buổi.</li>
            </ul>
          </div>
          <Link href="/thang" className="btn btn-plain btn-sm"><Icon name="calendar" size={16} />Mọi hợp đồng</Link>
        </div>
      </div>
    </>
  );
}
