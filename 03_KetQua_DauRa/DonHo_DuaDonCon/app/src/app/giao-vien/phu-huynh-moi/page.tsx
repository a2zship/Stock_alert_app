import { redirect } from "next/navigation";
import { reviewClaimAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead } from "@/components/ui";
import { showArea } from "@/domain/area";
import { showDate } from "@/domain/time";
import { claimsForTeacher } from "@/server/area";
import { currentUser } from "@/server/queries";

/** So tên không dấu, không phân biệt hoa thường — để chọn sẵn bé trùng tên trong lớp. */
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

// Phụ huynh tự đăng ký xin nhận là phụ huynh của bé: cô gọi điện xác minh rồi gắn với hồ sơ bé có sẵn hoặc thêm bé mới.
export default async function NewParents() {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const rows = await claimsForTeacher(me.id);
  const pending = rows.filter((c) => c.status === "CHO_DUYET");
  const done = rows.filter((c) => c.status !== "CHO_DUYET");

  return (
    <>
      <PageHead title="Xác nhận phụ huynh mới" sub="Phụ huynh tự đăng ký trên app và xin nhận là phụ huynh của bé. Gọi điện xác minh trước khi xác nhận — sau khi xác nhận, người này nhờ đón hộ cho bé được." />
      <div className="card">
        <h2>Chờ xác nhận {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
        {pending.length === 0 ? <Empty icon="checkCircle">Không có ai chờ xác nhận.</Empty> : pending.map((c) => {
          const match = c.class.students.find((s) => plain(s.name) === plain(c.studentName));
          return (
            <div key={c.id} className="list-item">
              <div className="list-row"><span className="desc">{c.user.name}</span><span className="badge badge-warn">{c.relation} của bé {c.studentName}</span></div>
              <dl className="kv">
                <dt>Lớp</dt><dd>{c.class.name}</dd>
                <dt>Điện thoại</dt><dd><a href={`tel:${c.user.phone}`} className="btn btn-plain btn-sm"><Icon name="phone" size={16} />{c.user.phone}</a></dd>
                <dt>Nơi sống</dt><dd>{showArea(c.user) || "Chưa chọn"}{c.user.ward && !c.user.ward.verified ? " (phường/xã chưa xác minh)" : ""}</dd>
                <dt>Gửi lúc</dt><dd>{showDate(c.createdAt)}</dd>
              </dl>
              {!match && <Note kind="warn">Lớp chưa có bé tên &quot;{c.studentName}&quot;. Chọn đúng bé nếu phụ huynh ghi khác tên, hoặc thêm bé mới vào lớp.</Note>}
              <ActionForm action={reviewClaimAction} className="mt-10">
                <input type="hidden" name="id" value={c.id} />
                <div className="field">
                  <label htmlFor={`stu-${c.id}`}>Gắn với bé</label>
                  <select id={`stu-${c.id}`} name="studentId" defaultValue={match?.id ?? "moi"}>
                    {c.class.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="moi">Thêm bé mới: {c.studentName}</option>
                  </select>
                </div>
                <div className="checks mb-10">
                  <label><input type="checkbox" name="calledParent" /><span>Tôi đã gọi điện và xác minh đúng là {c.relation.toLowerCase()} của bé</span></label>
                </div>
                <div className="field"><label htmlFor={`note-${c.id}`}>Ghi chú (bắt buộc khi từ chối)</label><input id={`note-${c.id}`} name="note" type="text" maxLength={200} /></div>
                <div className="actions">
                  <SubmitButton className="btn btn-ok" name="decision" value="approve"><Icon name="check" />Xác nhận</SubmitButton>
                  <SubmitButton className="btn btn-danger" name="decision" value="reject"><Icon name="x" />Từ chối</SubmitButton>
                </div>
              </ActionForm>
            </div>
          );
        })}
      </div>
      {done.length > 0 && (
        <div className="card">
          <h2>Đã xử lý</h2>
          {done.map((c) => (
            <div key={c.id} className="list-item">
              <div className="list-row"><span className="desc">{c.user.name}</span><span className={`badge badge-${c.status === "DA_DUYET" ? "ok" : "danger"}`}>{c.status === "DA_DUYET" ? "Đã xác nhận" : "Từ chối"}</span></div>
              <div className="meta">{c.relation} của bé {c.studentName} · {c.class.name}{c.decidedAt ? ` · ${showDate(c.decidedAt)}` : ""}{c.note ? ` · ${c.note}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
