import { redirect } from "next/navigation";
import { reviewTrustedAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, PageHead, Photo } from "@/components/ui";
import { currentUser, teacherTrusted } from "@/server/queries";

export default async function TeacherTrusted() {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const rows = await teacherTrusted(me.id);
  const pending = rows.filter((t) => t.status === "CHO_DUYET");
  const approved = rows.filter((t) => t.status === "DA_DUYET");

  return (
    <>
      <PageHead title="Duyệt người tin cậy" sub="Duyệt một lần cho mỗi người. Nên đối chiếu với phụ huynh (gọi điện hoặc gặp trực tiếp) trước khi duyệt." />
      <div className="card">
        <h2>Chờ duyệt</h2>
        {pending.length === 0 ? <Empty icon="checkCircle">Không có ai chờ duyệt.</Empty> : pending.map((t) => (
          <div key={t.id} className="list-item">
            <div className="person">
              <Photo id={t.photoId} alt={`Ảnh ${t.name}`} size={96} />
              <div>
                <div className="name">{t.name}</div>
                <dl className="kv">
                  <dt>Đón bé</dt><dd>{t.student.name} ({t.student.class.name})</dd>
                  <dt>Quan hệ</dt><dd>{t.relation}</dd>
                  <dt>Điện thoại</dt><dd>{t.phone}</dd>
                  <dt>CCCD</dt><dd>…{t.cccdLast4}</dd>
                  <dt>Phụ huynh</dt>
                  <dd className="call-list">{t.student.guardians.map((g) => <a key={g.userId} href={`tel:${g.user.phone}`} className="btn btn-plain btn-sm"><Icon name="phone" size={16} />{g.relation} {g.user.phone}</a>)}</dd>
                </dl>
              </div>
            </div>
            <ActionForm action={reviewTrustedAction} className="mt-15">
              <input type="hidden" name="id" value={t.id} />
              <div className="field"><label htmlFor={`note-${t.id}`}>Ghi chú (bắt buộc khi từ chối)</label><input id={`note-${t.id}`} name="note" type="text" /></div>
              <div className="actions">
                <SubmitButton className="btn btn-ok" name="decision" value="approve"><Icon name="check" />Duyệt</SubmitButton>
                <SubmitButton className="btn btn-danger" name="decision" value="reject"><Icon name="x" />Từ chối</SubmitButton>
              </div>
            </ActionForm>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Đã duyệt ({approved.length})</h2>
        {approved.length === 0 ? <Empty icon="users">Chưa có.</Empty> : approved.map((t) => (
          <div key={t.id} className="list-item">
            <div className="person">
              <Photo id={t.photoId} alt={`Ảnh ${t.name}`} size={48} />
              <div><div className="desc">{t.name}</div><div className="meta">{t.relation} của bé {t.student.name} · CCCD …{t.cccdLast4}</div></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
