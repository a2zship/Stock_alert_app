import { redirect } from "next/navigation";
import { addBlockedAction, addTrustedAction, removeTrustedAction } from "@/app/actions";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead, Photo } from "@/components/ui";
import { maskPhone } from "@/domain/phone";
import { currentUser, parentTrusted } from "@/server/queries";

const TRUST_BADGE = {
  DA_DUYET: <span className="badge badge-ok"><Icon name="checkCircle" size={16} />Đã duyệt</span>,
  CHO_DUYET: <span className="badge badge-warn"><Icon name="clock" size={16} />Chờ giáo viên duyệt</span>,
  TU_CHOI: <span className="badge badge-danger"><Icon name="x" size={16} />Không được duyệt</span>,
  DA_XOA: null,
};

export default async function TrustedPage() {
  const me = await currentUser();
  if (!me?.isParent) redirect("/");
  const students = await parentTrusted(me.id);

  return (
    <>
      <PageHead title="Người tin cậy" sub="Người được duyệt trước có thể đón bé chỉ sau một lần chọn. Giáo viên duyệt mỗi người một lần." />
      {students.map((s) => (
        <section key={s.id} aria-labelledby={`st-${s.id}`}>
          <h2 id={`st-${s.id}`} className="mb-10">Bé {s.name} <span className="muted small">· {s.class.name}</span></h2>
          <div className="row">
            <div className="col">
              <div className="card">
                <h3>Danh sách tin cậy</h3>
                {s.trusted.length === 0 ? <Empty icon="users">Chưa có ai. Thêm ông bà, người thân thường đón bé.</Empty> : s.trusted.map((t) => (
                  <div key={t.id} className="list-item">
                    <div className="person">
                      <Photo id={t.photoId} alt={`Ảnh ${t.name}`} size={64} />
                      <div>
                        <div className="desc">{t.name}</div>
                        <div className="meta">{t.relation} · {maskPhone(t.phone)} · CCCD …{t.cccdLast4}</div>
                        <div className="mt-10">{TRUST_BADGE[t.status]}</div>
                        {t.status === "TU_CHOI" && t.reviewNote && <p className="small muted mt-10">Lý do: {t.reviewNote}</p>}
                      </div>
                      <ActionForm action={removeTrustedAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <SubmitButton className="btn btn-danger btn-sm" confirm={`Xoá ${t.name} khỏi danh sách tin cậy?`}>Xoá</SubmitButton>
                      </ActionForm>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col">
              <div className="card">
                <h3>Thêm người tin cậy</h3>
                <ActionForm action={addTrustedAction} resetOnOk>
                  <input type="hidden" name="studentId" value={s.id} />
                  <div className="fields">
                    <div className="field"><label htmlFor={`n-${s.id}`}>Họ tên</label><input id={`n-${s.id}`} name="name" type="text" required /></div>
                    <div className="field"><label htmlFor={`r-${s.id}`}>Quan hệ với bé</label><input id={`r-${s.id}`} name="relation" type="text" placeholder="Bà ngoại, chú ruột…" required /></div>
                    <div className="field"><label htmlFor={`p-${s.id}`}>Số điện thoại</label><input id={`p-${s.id}`} name="phone" type="tel" inputMode="tel" required /></div>
                    <div className="field"><label htmlFor={`c-${s.id}`}>4 số cuối CCCD</label><input id={`c-${s.id}`} name="cccdLast4" type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} required /></div>
                  </div>
                  <PhotoInput name="photo" label="Ảnh chân dung (rõ mặt)" capture="environment" required />
                  <SubmitButton className="btn">Gửi giáo viên duyệt</SubmitButton>
                </ActionForm>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Người KHÔNG được đón bé</h3>
            <p className="small muted">Nếu có ai được nhờ đón mà trùng số điện thoại trong danh sách này, hệ thống chặn ngay và báo giáo viên.</p>
            {s.blocked.length === 0 ? <p className="small muted">Chưa có ai.</p> : s.blocked.map((b) => (
              <div key={b.id} className="list-item">
                <div className="list-row"><span className="desc"><Icon name="ban" size={16} className="mr-5" />{b.name}</span><span className="meta">{b.phone ? maskPhone(b.phone) : "không có số"}</span></div>
                {b.note && <div className="meta">{b.note}</div>}
              </div>
            ))}
            <details className="mt-15">
              <summary className="btn btn-plain btn-sm">Thêm người không được đón</summary>
              <div className="box mt-10">
                <ActionForm action={addBlockedAction} resetOnOk>
                  <input type="hidden" name="studentId" value={s.id} />
                  <div className="fields">
                    <div className="field"><label htmlFor={`bn-${s.id}`}>Họ tên</label><input id={`bn-${s.id}`} name="name" type="text" required /></div>
                    <div className="field"><label htmlFor={`bp-${s.id}`}>Số điện thoại (nếu biết)</label><input id={`bp-${s.id}`} name="phone" type="tel" inputMode="tel" /></div>
                  </div>
                  <div className="field"><label htmlFor={`bt-${s.id}`}>Ghi chú cho giáo viên</label><input id={`bt-${s.id}`} name="note" type="text" /></div>
                  <SubmitButton className="btn btn-danger">Thêm vào danh sách cấm</SubmitButton>
                </ActionForm>
              </div>
            </details>
            <Note>Muốn gỡ một người khỏi danh sách cấm, liên hệ nhà trường. Phụ huynh không tự gỡ được để tránh một bên gỡ lệnh cấm của bên kia.</Note>
          </div>
        </section>
      ))}
    </>
  );
}
