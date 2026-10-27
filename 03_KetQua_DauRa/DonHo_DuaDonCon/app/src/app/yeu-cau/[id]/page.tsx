import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import {
  cancelRequestAction, confirmHomeAction, delegateRespondAction, failHandoverAction, gatePinAction, handoverAction, teacherDecideAction,
} from "@/app/actions";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { Icon, type IconName } from "@/components/Icon";
import { Journey } from "@/components/Journey";
import { TrackingMap } from "@/components/TrackingMap";
import { Note, PageHead, Photo, StatusBadge } from "@/components/ui";
import { maskPhone } from "@/domain/phone";
import { FINAL, PIN_MAX_ATTEMPTS, type Status } from "@/domain/state";
import { showDateTime, showWindow } from "@/domain/time";
import { publicUrl } from "@/server/db";
import { currentUser, requestView } from "@/server/queries";
import { trackingView } from "@/server/tracking";

const ACTION_LABEL: Record<string, { text: string; icon: IconName; tone?: "ok" | "danger" | "warn" }> = {
  TAO: { text: "Phụ huynh gửi yêu cầu đón hộ", icon: "plus", tone: "ok" },
  NGUOI_DON_NHAN: { text: "Người đón nhận lời", icon: "hand", tone: "ok" },
  NGUOI_DON_TU_CHOI: { text: "Người đón từ chối", icon: "x", tone: "danger" },
  GV_DUYET: { text: "Giáo viên duyệt, sinh mã đón", icon: "shield", tone: "ok" },
  GV_TU_CHOI: { text: "Giáo viên từ chối", icon: "x", tone: "danger" },
  PH_HUY: { text: "Phụ huynh huỷ yêu cầu", icon: "x", tone: "danger" },
  QUET_QR: { text: "Giáo viên quét mã QR tại cổng", icon: "qr" },
  NHAP_PIN_DUNG: { text: "Giáo viên nhập đúng mã PIN", icon: "key" },
  NHAP_PIN_SAI: { text: "Nhập sai mã PIN", icon: "alert", tone: "warn" },
  KHOA_SAI_PIN: { text: "Khoá yêu cầu vì sai mã nhiều lần", icon: "lock", tone: "danger" },
  GIAO_TRE: { text: "Giáo viên giao trẻ cho người đón", icon: "userCheck", tone: "ok" },
  KHONG_GIAO_DUOC: { text: "Không giao được trẻ", icon: "ban", tone: "danger" },
  PH_XAC_NHAN_VE: { text: "Phụ huynh xác nhận bé về an toàn", icon: "home", tone: "ok" },
  TU_DONG_DONG: { text: "Tự đóng sau 24 giờ", icon: "clock" },
  HET_HAN: { text: "Hết hạn vì quá giờ đón", icon: "clock", tone: "warn" },
  CHIA_SE_VI_TRI: { text: "Người đón bật chia sẻ vị trí", icon: "navigation" },
  TOI_CONG: { text: "Người đón báo đã tới cổng", icon: "mapPin", tone: "ok" },
  TOI_NOI_TRA: { text: "Người đón báo đã đưa bé tới nơi", icon: "home", tone: "ok" },
};
const ROLE_LABEL: Record<string, string> = { PHU_HUYNH: "Phụ huynh", NGUOI_DON: "Người đón", GIAO_VIEN: "Giáo viên", HE_THONG: "Hệ thống" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ moi?: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const { id } = await params;
  const { moi } = await searchParams;
  const v = await requestView(me.id, id);
  if (!v) notFound();
  const { r, asParent, asTeacher, asDelegate, codes, gateReady, drop } = v;
  const status = r.status as Status;

  const qrSvg = codes ? await QRCode.toString(`${publicUrl()}/giao-vien/giao-tre?ma=${codes.token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const canCancel = asParent && ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "BI_KHOA"].includes(status);

  const tracking = ["DA_DUYET", "DA_GIAO"].includes(status) ? await trackingView(me.id, r.id) : null;
  const map = tracking && (
    <TrackingMap requestId={r.id} initial={tracking} isDelegate={asDelegate} studentName={r.student.name} />
  );

  return (
    <>
      <PageHead title={`Đón bé ${r.student.name}`} sub={`${r.student.class.name} · ${r.student.class.school.name} · ${showWindow(r.windowStart, r.windowEnd)}`}>
        <StatusBadge status={status} />
      </PageHead>
      {moi && asParent && status === "CHO_NGUOI_DON" && <Note kind="ok">Đã gửi. {r.delegateName} sẽ nhận tin nhắn để nhận lời; sau đó giáo viên duyệt.</Note>}

      <Journey status={status} events={r.events} />
      {!asDelegate && map}
      <div className="row">
        <div className="col">
          {asDelegate && codes && qrSvg && (
            <div className="card code-box">
              <h2>Mã đón bé {r.student.name}</h2>
              <p className="small muted">Đưa màn hình này cho cô giáo ở cổng, kèm <strong>CCCD bản gốc</strong>.</p>
              <div className="qr" role="img" aria-label="Mã QR đón trẻ" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div className="eyebrow mt-15">Mã PIN dự phòng</div>
              <div className="pin" aria-label={`Mã PIN ${codes.pin.split("").join(" ")}`}>{codes.pin}</div>
              <p className="small muted">Dùng được từ 30 phút trước giờ đón đến {showWindow(r.windowStart, r.windowEnd)}. Mã chỉ dùng một lần. Không gửi mã cho ai khác.</p>
            </div>
          )}
          {asDelegate && map}
          {asTeacher && status === "DA_DUYET" && r.arrivedAt && <Note kind="ok">{r.delegateName} đã báo tới cổng lúc {showDateTime(r.arrivedAt)}. Đưa bé ra và kiểm mã.</Note>}
          {/* ── Người đón ── */}
          <div className="card">
            <div className="card-head">
              <h2>Người đón hộ</h2>
              {r.isAdhoc ? <span className="badge badge-warn"><Icon name="alert" size={16} />Ngoài danh sách tin cậy</span>
                : <span className="badge badge-ok"><Icon name="shield" size={16} />Trong danh sách tin cậy</span>}
            </div>
            <div className="person">
              <Photo id={r.delegatePhotoId} alt={`Ảnh chân dung ${r.delegateName}`} size={gateReady ? 200 : 96} />
              <div>
                <div className="name">{r.delegateName}</div>
                <dl className="kv">
                  <dt>Quan hệ</dt><dd>{r.relation}</dd>
                  <dt>Điện thoại</dt><dd>{asDelegate ? r.delegatePhone : <a href={`tel:${r.delegatePhone}`} className="btn btn-plain btn-sm"><Icon name="phone" size={16} />{r.delegatePhone}</a>}</dd>
                  {!asDelegate && <><dt>CCCD</dt><dd>{r.cccdLast4 ? `…${r.cccdLast4}` : "Chưa khai"}</dd></>}
                  <dt>Trả bé tại</dt>
                  <dd>{drop ? (drop.address ? <><strong>{drop.label}</strong> · {drop.address}</> : <>{drop.ward} <span className="small muted">— số nhà hiện sau khi cô giáo duyệt</span></>)
                    : <span className="muted">{FINAL.includes(status) ? "Đã xoá khi yêu cầu đóng" : "Chưa khai — gọi phụ huynh để hỏi"}</span>}</dd>
                  {r.reason && <><dt>Lời nhắn</dt><dd>{r.reason}</dd></>}
                </dl>
              </div>
            </div>
          </div>

          {/* ── Người đón: nhận lời / mã đón ── */}
          {asDelegate && status === "CHO_NGUOI_DON" && (
            <div className="card">
              <h2>{r.requester.name} nhờ bạn đón bé</h2>
              <p className="small muted">Bạn đón được không? Sau khi bạn nhận lời, giáo viên sẽ duyệt và gửi mã đón cho bạn.</p>
              <ActionForm action={delegateRespondAction}>
                <input type="hidden" name="id" value={r.id} />
                {r.isAdhoc && (
                  <>
                    <div className="field">
                      <label htmlFor="cccd">4 số cuối CCCD của bạn</label>
                      <input id="cccd" name="cccdLast4" type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} required />
                      <p className="hint">Cô giáo sẽ xem CCCD thật của bạn ở cổng trường.</p>
                    </div>
                    <PhotoInput name="photo" label="Chụp ảnh chân dung của bạn" capture="user" required />
                  </>
                )}
                <div className="actions">
                  <SubmitButton className="btn btn-lg btn-ok" name="decision" value="accept"><Icon name="check" />Tôi nhận lời đón</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={delegateRespondAction} className="mt-10">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="cccdLast4" value="" />
                <SubmitButton className="btn btn-danger" name="decision" value="decline" confirm="Báo phụ huynh là bạn không đón được?">Tôi không đón được</SubmitButton>
              </ActionForm>
            </div>
          )}
          {asDelegate && status === "CHO_GIAO_VIEN" && <Note>Bạn đã nhận lời. Đang chờ giáo viên duyệt, bạn sẽ nhận tin nhắn khi có mã đón.</Note>}

          {/* ── Giáo viên: duyệt ── */}
          {asTeacher && status === "CHO_GIAO_VIEN" && (
            <div className="card">
              <h2>Duyệt yêu cầu</h2>
              {r.isAdhoc && <Note kind="warn">Người đón <strong>không</strong> có trong danh sách tin cậy. Gọi cho phụ huynh để xác minh trước khi duyệt.</Note>}
              <p className="small">Gọi phụ huynh:{" "}
                {r.student.guardians.map((g) => <a key={g.userId} href={`tel:${g.user.phone}`} className="btn btn-plain btn-sm mr-5"><Icon name="phone" size={16} />{g.relation} {g.user.phone}</a>)}
              </p>
              <ActionForm action={teacherDecideAction}>
                <input type="hidden" name="id" value={r.id} />
                <div className="checks">
                  <label><input type="checkbox" name="calledParent" required={r.isAdhoc} />Tôi đã gọi điện xác minh với phụ huynh{r.isAdhoc ? " (bắt buộc)" : ""}</label>
                </div>
                <div className="field"><label htmlFor="note">Ghi chú (bắt buộc khi từ chối)</label><input id="note" name="note" type="text" /></div>
                <div className="actions">
                  <SubmitButton className="btn btn-lg btn-ok" name="decision" value="approve"><Icon name="check" />Duyệt</SubmitButton>
                  <SubmitButton className="btn btn-danger" name="decision" value="reject" noValidate><Icon name="x" />Từ chối</SubmitButton>
                </div>
              </ActionForm>
            </div>
          )}

          {/* ── Giáo viên: tại cổng ── */}
          {asTeacher && status === "DA_DUYET" && !gateReady && (
            <div className="card">
              <h2>Nhập mã PIN người đón</h2>
              <p className="small muted">Người đón đọc mã 6 số trên điện thoại của họ. Hoặc quét mã QR bằng camera. Sai {PIN_MAX_ATTEMPTS} lần sẽ khoá yêu cầu.</p>
              {r.pinAttempts > 0 && <Note kind="warn">Đã nhập sai {r.pinAttempts} lần.</Note>}
              <ActionForm action={gatePinAction}>
                <input type="hidden" name="id" value={r.id} />
                <div className="field">
                  <label htmlFor="pin">Mã PIN</label>
                  <input id="pin" name="pin" type="text" className="pin-input" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" required />
                </div>
                <SubmitButton className="btn btn-lg"><Icon name="key" />Kiểm tra mã</SubmitButton>
              </ActionForm>
            </div>
          )}
          {asTeacher && status === "DA_DUYET" && gateReady && (
            <div className="card alert-banner">
              <h2>Đối chiếu trước khi giao bé</h2>
              <ActionForm action={handoverAction}>
                <input type="hidden" name="id" value={r.id} />
                <div className="checks">
                  <label><input type="checkbox" name="face" required />Khuôn mặt khớp với ảnh</label>
                  <label><input type="checkbox" name="cccd" required />CCCD thật có 4 số cuối …{r.cccdLast4}</label>
                  <label><input type="checkbox" name="child" required />Bé nhận ra và chịu đi với người đón</label>
                </div>
                <PhotoInput name="photo" label="Ảnh bàn giao (không bắt buộc)" capture="environment" />
                <SubmitButton className="btn btn-lg btn-ok btn-block"><Icon name="userCheck" />Đã giao bé</SubmitButton>
              </ActionForm>
              <details className="mt-15">
                <summary className="btn btn-danger">Không giao được</summary>
                <ActionForm action={failHandoverAction} className="mt-10">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="field"><label htmlFor="reason">Lý do</label><input id="reason" name="reason" type="text" placeholder="Ví dụ: không khớp CCCD, bé không nhận ra" required /></div>
                  <SubmitButton className="btn btn-solid-danger">Xác nhận không giao, báo phụ huynh</SubmitButton>
                </ActionForm>
              </details>
            </div>
          )}

          {/* ── Phụ huynh ── */}
          {asParent && status === "DA_GIAO" && (
            <div className="card alert-banner">
              <h2>Bé đã được giao lúc {r.handedOverAt ? showDateTime(r.handedOverAt) : ""}</h2>
              {r.handoverPhotoId && <Photo id={r.handoverPhotoId} alt="Ảnh bàn giao tại cổng trường" size={200} />}
              <ActionForm action={confirmHomeAction} className="mt-15">
                <input type="hidden" name="id" value={r.id} />
                <div className="field">
                  <label htmlFor="thanks">Lời cảm ơn gửi {r.delegateName} (không bắt buộc)</label>
                  <input id="thanks" name="thanks" type="text" maxLength={200} placeholder="Ví dụ: Cảm ơn anh nhiều, bé về vui lắm!" />
                  <p className="hint">Người đón được cộng điểm tương trợ khi bạn xác nhận.</p>
                </div>
                <SubmitButton className="btn btn-lg btn-ok btn-block"><Icon name="home" />Con đã về an toàn</SubmitButton>
              </ActionForm>
            </div>
          )}
          {asTeacher && status === "DA_GIAO" && r.handedOverAt && (
            <Note kind="ok">Đã giao bé lúc {showDateTime(r.handedOverAt)}. Phụ huynh đã nhận thông báo và sẽ xác nhận khi bé về tới nơi.</Note>
          )}
          {asDelegate && status === "DA_GIAO" && <Note kind="ok">Cảm ơn bạn đã đón bé. Phụ huynh đã nhận thông báo; khi phụ huynh xác nhận bé về an toàn, bạn được cộng điểm tương trợ.</Note>}
          {asDelegate && status === "HOAN_TAT" && (
            <div className="card reward">
              <h2>Bé đã về an toàn — cảm ơn bạn!</h2>
              {r.thanks && <div className="thanks mt-10"><q>{r.thanks}</q><div className="meta">{r.requester.name}</div></div>}
              <Link href="/nguoi-don" className="btn btn-accent btn-sm mt-10"><Icon name="award" size={16} />Xem điểm tương trợ</Link>
            </div>
          )}
          {!asDelegate && status === "HOAN_TAT" && r.thanks && <Note kind="ok">Lời cảm ơn đã gửi: “{r.thanks}”</Note>}
          {status === "BI_KHOA" &&<Note kind="error">Yêu cầu bị khoá vì nhập sai mã nhiều lần. Không giao trẻ theo yêu cầu này. Phụ huynh liên hệ giáo viên và tạo yêu cầu mới nếu cần.</Note>}
          {status === "KHONG_GIAO_DUOC" && <Note kind="error">Không giao được. Lý do: {r.failReason}</Note>}
          {status === "GV_TU_CHOI" && r.decisionNote && <Note kind="error">Giáo viên từ chối. Lý do: {r.decisionNote}</Note>}
          {canCancel && (
            <ActionForm action={cancelRequestAction}>
              <input type="hidden" name="id" value={r.id} />
              <SubmitButton className="btn btn-danger" confirm="Huỷ yêu cầu này? Mã đón sẽ hết hiệu lực ngay.">Huỷ yêu cầu</SubmitButton>
            </ActionForm>
          )}
        </div>

        <div className="col">
          <div className="card">
            <h2>Nhật ký</h2>
            <ol className="timeline">
              {r.events.map((e) => {
                const a = ACTION_LABEL[e.action] ?? { text: e.action, icon: "info" as IconName };
                return (
                  <li key={e.id}>
                    <span className={`dot ${a.tone ?? ""}`}><Icon name={a.icon} size={16} /></span>
                    <div>
                      <div className="what">{a.text}</div>
                      <div className="meta">{v.actorName(e.actorId)} · {ROLE_LABEL[e.actorRole] ?? e.actorRole} · {showDateTime(e.at)}</div>
                      {e.note && <div className="small">{e.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {asDelegate && <p className="small muted">Số người nhờ: {maskPhone(r.requester.phone)}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
