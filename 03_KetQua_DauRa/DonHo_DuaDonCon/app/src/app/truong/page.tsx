import Link from "next/link";
import { redirect } from "next/navigation";
import { addClassAction, addTeacherAction, removeTeacherAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { FunnelSteps } from "@/components/FunnelSteps";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead } from "@/components/ui";
import { STAGE_NEXT } from "@/domain/sales";
import { currentUser } from "@/server/queries";
import { schoolConsole } from "@/server/sales";

// Trang của ban giám hiệu: bước của trường, lớp, cô phụ trách, bộ khởi động từng lớp.
export default async function SchoolConsolePage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (!me.isSchoolAdmin) redirect("/mo-truong");
  const schools = await schoolConsole(me.id);

  return (
    <>
      <PageHead title="Trường của tôi" sub="Thêm lớp, mời cô, rồi để cô gửi đường dẫn của lớp cho phụ huynh. App tự nhắc khi một bước bị chậm.">
        <Link href="/chia-se" className="btn btn-plain btn-sm"><Icon name="banknote" size={16} />Chia sẻ doanh thu</Link>
        <Link href="/mo-truong" className="btn btn-plain btn-sm"><Icon name="plus" size={16} />Mở thêm trường</Link>
      </PageHead>
      {schools.map((s) => (
        <section key={s.id} className="card" aria-labelledby={`sch-${s.id}`}>
          <div className="card-head">
            <h2 id={`sch-${s.id}`}>{s.name}</h2>
            {s.verified
              ? <span className="badge badge-ok"><Icon name="checkCircle" size={16} />Đã xác minh</span>
              : <span className="badge badge-warn"><Icon name="clock" size={16} />Chờ Đón Hộ gọi xác minh</span>}
          </div>
          <p className="meta">{s.ward.name}, {s.ward.province.name}{s.address ? ` · ${s.address}` : ""}</p>
          <FunnelSteps stage={s.stage} />
          <Note kind="info"><strong>Việc tiếp theo:</strong> {STAGE_NEXT[s.stage]}</Note>
          {!s.verified && <Note kind="warn">Trước khi xác minh, phụ huynh vẫn nhờ đón tương trợ được; đón có phí và chuyển chia sẻ doanh thu mở sau khi Đón Hộ gọi xác minh trường.</Note>}

          <h3 className="section-title"><Icon name="users" />Lớp ({s.classes.length})</h3>
          {s.classes.length === 0 ? <Empty icon="school">Chưa có lớp. Thêm lớp đầu tiên ở dưới.</Empty> : s.classes.map((c) => (
            <div key={c.id} className="list-item">
              <div className="list-row">
                <span className="desc">{c.name}</span>
                <span className="meta">Đón {c.pickupStart}–{c.pickupEnd} · {c._count.students} bé</span>
              </div>
              {c.teachers.length === 0
                ? <p className="meta">Chưa có cô phụ trách.</p>
                : <ul className="plain-list">
                    {c.teachers.map((t) => (
                      <li key={t.userId} className="list-row">
                        <span>{t.user.name} · <span className="muted">{t.user.phone}</span></span>
                        <ActionForm action={removeTeacherAction}>
                          <input type="hidden" name="classId" value={c.id} />
                          <input type="hidden" name="teacherId" value={t.userId} />
                          <SubmitButton className="btn btn-danger btn-sm" confirm={`Bỏ ${t.user.name} khỏi lớp ${c.name}?`}>Bỏ khỏi lớp</SubmitButton>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>}
              <details className="mt-10">
                <summary className="btn btn-plain btn-sm">Thêm cô phụ trách</summary>
                <ActionForm action={addTeacherAction} className="mt-10" resetOnOk>
                  <input type="hidden" name="classId" value={c.id} />
                  <div className="fields">
                    <div className="field">
                      <label htmlFor={`tn-${c.id}`}>Họ tên cô/thầy</label>
                      <input id={`tn-${c.id}`} name="name" type="text" required maxLength={60} />
                    </div>
                    <div className="field">
                      <label htmlFor={`tp-${c.id}`}>Số điện thoại</label>
                      <input id={`tp-${c.id}`} name="phone" type="tel" inputMode="tel" required />
                    </div>
                  </div>
                  <SubmitButton className="btn btn-sm">Thêm và gửi tin mời</SubmitButton>
                </ActionForm>
              </details>
              <div className="actions mt-10">
                <Link href={`/truong/lop/${c.id}`} className="btn btn-sm"><Icon name="qr" size={16} />Bộ khởi động của lớp</Link>
              </div>
            </div>
          ))}

          <h3 className="section-title"><Icon name="plus" />Thêm lớp</h3>
          <ActionForm action={addClassAction} resetOnOk>
            <input type="hidden" name="schoolId" value={s.id} />
            <div className="fields">
              <div className="field">
                <label htmlFor={`cn-${s.id}`}>Tên lớp</label>
                <input id={`cn-${s.id}`} name="name" type="text" required maxLength={40} placeholder="Ví dụ: Lá 1" />
              </div>
              <div className="field">
                <label htmlFor={`cs-${s.id}`}>Giờ đón từ</label>
                <input id={`cs-${s.id}`} name="pickupStart" type="time" required defaultValue="16:30" />
              </div>
              <div className="field">
                <label htmlFor={`ce-${s.id}`}>Đến</label>
                <input id={`ce-${s.id}`} name="pickupEnd" type="time" required defaultValue="17:30" />
              </div>
            </div>
            <SubmitButton>Thêm lớp</SubmitButton>
          </ActionForm>
        </section>
      ))}
    </>
  );
}
