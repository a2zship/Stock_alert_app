import { redirect } from "next/navigation";
import { reviewHelperAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, PageHead, Photo } from "@/components/ui";
import { bankName } from "@/domain/vietqr";
import { helpersToReview } from "@/server/earn";
import { currentUser } from "@/server/queries";

const LABEL = { CHO_DUYET: "Chờ duyệt", DA_DUYET: "Đã duyệt", TU_CHOI: "Đã từ chối", TAM_DUNG: "Tạm dừng" } as const;

export default async function TeacherHelpers() {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const rows = await helpersToReview(me.id);
  const pending = rows.filter((h) => h.status === "CHO_DUYET");
  const others = rows.filter((h) => h.status !== "CHO_DUYET");
  const kids = (h: (typeof rows)[number]) => h.user.guardianOf.map((g) => `${g.relation} bé ${g.student.name} (${g.student.class.name})`).join("; ");

  return (
    <>
      <PageHead title="Duyệt người đón có phí" sub="Phụ huynh của lớp mình đăng ký nhận đón hộ có thù lao trong trường. Duyệt khi cô/thầy biết rõ người này; mỗi lượt đón vẫn phải duyệt riêng và kiểm tại cổng." />
      <div className="card">
        <h2>Chờ duyệt</h2>
        {pending.length === 0 ? <Empty icon="checkCircle">Không có ai chờ duyệt.</Empty> : pending.map((h) => (
          <div key={h.id} className="list-item">
            <div className="person">
              <Photo id={h.photoId} alt={`Ảnh ${h.user.name}`} size={96} />
              <div>
                <div className="name">{h.user.name}</div>
                <dl className="kv">
                  <dt>Phụ huynh của</dt><dd>{kids(h)}</dd>
                  <dt>Điện thoại</dt><dd><a href={`tel:${h.user.phone}`} className="btn btn-plain btn-sm"><Icon name="phone" size={16} />{h.user.phone}</a></dd>
                  <dt>CCCD</dt><dd>…{h.cccdLast4}</dd>
                  <dt>Nhận tiền</dt><dd>{bankName(h.bankBin)} · {h.accountName}</dd>
                </dl>
              </div>
            </div>
            <ActionForm action={reviewHelperAction} className="mt-15">
              <input type="hidden" name="id" value={h.id} />
              <div className="field"><label htmlFor={`note-${h.id}`}>Ghi chú (bắt buộc khi từ chối)</label><input id={`note-${h.id}`} name="note" type="text" /></div>
              <div className="actions">
                <SubmitButton className="btn btn-ok" name="decision" value="approve"><Icon name="check" />Duyệt</SubmitButton>
                <SubmitButton className="btn btn-danger" name="decision" value="reject"><Icon name="x" />Từ chối</SubmitButton>
              </div>
            </ActionForm>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Đã xử lý ({others.length})</h2>
        {others.length === 0 ? <Empty icon="users">Chưa có.</Empty> : others.map((h) => (
          <div key={h.id} className="list-item">
            <div className="person">
              <Photo id={h.photoId} alt={`Ảnh ${h.user.name}`} size={48} />
              <div><div className="desc">{h.user.name} · {LABEL[h.status]}</div><div className="meta">{kids(h)}{h.note ? ` · ${h.note}` : ""}</div></div>
            </div>
            {h.status === "DA_DUYET" && (
              <ActionForm action={reviewHelperAction} className="mt-10">
                <input type="hidden" name="id" value={h.id} />
                <div className="offer-form">
                  <div><label htmlFor={`stop-${h.id}`} className="sr-only">Lý do tạm dừng</label><input id={`stop-${h.id}`} name="note" type="text" placeholder="Lý do tạm dừng" /></div>
                  <SubmitButton className="btn btn-danger btn-sm" name="decision" value="suspend" confirm={`Tạm dừng ${h.user.name}?`}>Tạm dừng</SubmitButton>
                </div>
              </ActionForm>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
