import Link from "next/link";
import { redirect } from "next/navigation";
import { addClaimAction, updateAreaAction } from "@/app/actions";
import { AreaPicker } from "@/components/AreaPicker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, Note, PageHead } from "@/components/ui";
import { CLAIM_RELATIONS } from "@/domain/area";
import { showDate } from "@/domain/time";
import { myArea, provinces } from "@/server/area";
import { currentUser } from "@/server/queries";

const CLAIM_LABEL = {
  CHO_DUYET: { label: "Chờ cô xác nhận", tone: "warn" },
  DA_DUYET: { label: "Đã xác nhận", tone: "ok" },
  TU_CHOI: { label: "Chưa xác nhận", tone: "danger" },
} as const;

// Khu vực thực tế của người dùng (chọn khi đăng ký) + trạng thái cô xác nhận con + trường cùng phường/xã.
export default async function AreaPage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const [{ me: u, nearby, sameProvince }, list] = await Promise.all([myArea(me.id), provinces()]);
  const waiting = u.claims.filter((c) => c.status === "CHO_DUYET");

  return (
    <>
      <PageHead title="Khu vực của tôi" sub="Nơi bạn sống và trường của con. App dùng khu vực này để hiện đúng trường, nhóm lớp và người đón gần bạn." />

      {!me.isParent && !me.isTeacher && (
        <Note kind={waiting.length ? "info" : "warn"}>
          {waiting.length
            ? `Cô lớp sẽ gọi điện cho bạn để xác minh ${waiting.length > 1 ? `${waiting.length} bé` : `bé ${waiting[0].studentName}`}. Sau khi cô xác nhận, bạn nhờ đón hộ cho con được ngay.`
            : "Tài khoản chưa gắn với bé nào. Gửi cô lớp xác nhận bé ở bên dưới để bắt đầu nhờ đón hộ."}
        </Note>
      )}

      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Nơi bạn sống</h2>
            {u.ward ? (
              <div className="area-path">
                <Icon name="mapPin" size={16} />
                <span>{u.province?.name}</span><span className="sep">›</span>
                <strong>{u.ward.name}</strong>
                {!u.ward.verified && <span className="badge badge-warn">Chưa xác minh</span>}
                {(u.school || u.pendingSchool) && <><span className="sep">›</span><span>{u.school?.name ?? u.pendingSchool}</span></>}
                {!u.school && u.pendingSchool && <span className="badge badge-info">Trường đề xuất</span>}
              </div>
            ) : me.area ? (
              <Note>Khu vực đang lấy theo trường của con: {me.area.school}, {me.area.ward}, {me.area.province}. Chọn nơi bạn sống ở bên dưới để app hiện đúng.</Note>
            ) : <Empty icon="mapPin">Chưa chọn khu vực.</Empty>}
            {!u.ward?.verified && u.ward && <p className="hint mt-10">Tên phường/xã bạn gõ tay sẽ được đối chiếu với danh mục chính thức.</p>}
          </div>

          <div className="card">
            <h2>Con của tôi</h2>
            {u.guardianOf.length === 0 && u.claims.length === 0 && <Empty icon="smile">Chưa có bé nào.</Empty>}
            {u.guardianOf.map((g) => (
              <div key={g.studentId} className="list-item">
                <div className="list-row"><span className="desc">Bé {g.student.name}</span><span className="badge badge-ok">Đã xác nhận</span></div>
                <div className="meta">{g.relation} · {g.student.class.name} · {g.student.class.school.name}</div>
              </div>
            ))}
            {u.claims.filter((c) => c.status !== "DA_DUYET").map((c) => {
              const st = CLAIM_LABEL[c.status];
              return (
                <div key={c.id} className="list-item">
                  <div className="list-row"><span className="desc">Bé {c.studentName}</span><span className={`badge badge-${st.tone}`}>{st.label}</span></div>
                  <div className="meta">{c.relation} · {c.class.name} · {c.class.school.name} · gửi {showDate(c.createdAt)}</div>
                  {c.status === "TU_CHOI" && c.note && <p className="small mt-10 mb-0">Cô ghi: {c.note}</p>}
                </div>
              );
            })}
            {me.isParent && <div className="actions mt-15"><Link href="/phu-huynh" className="btn btn-plain btn-sm"><Icon name="home" size={16} />Về trang của con</Link></div>}
          </div>

          {u.school && (
            <div className="card">
              <h2>Xin cô xác nhận thêm bé</h2>
              <ActionForm action={addClaimAction} resetOnOk>
                <div className="fields">
                  <div className="field">
                    <label htmlFor="claim-class">Lớp ({u.school.name})</label>
                    <select id="claim-class" name="classId" required defaultValue="">
                      <option value="" disabled>Chọn lớp</option>
                      {u.school.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="claim-name">Họ tên bé</label>
                    <input id="claim-name" name="studentName" type="text" required maxLength={60} />
                  </div>
                  <div className="field">
                    <label htmlFor="claim-rel">Bạn là</label>
                    <select id="claim-rel" name="relation" required defaultValue="">
                      <option value="" disabled>Chọn</option>
                      {CLAIM_RELATIONS.map((r) => <option key={r} value={r}>{r} của bé</option>)}
                    </select>
                  </div>
                </div>
                <SubmitButton className="btn btn-block"><Icon name="userCheck" size={16} />Gửi cô xác nhận</SubmitButton>
              </ActionForm>
            </div>
          )}
        </div>

        <div className="col">
          <div className="card">
            <h2>Trường khác cùng phường/xã</h2>
            {nearby.length === 0
              ? <Empty icon="school">{u.ward ? "Chưa có trường nào khác ở phường/xã này dùng Đón Hộ." : "Chọn khu vực để xem."}</Empty>
              : nearby.map((s) => (
                <div key={s.id} className="list-item">
                  <div className="desc">{s.name}</div>
                  <div className="meta">{s._count.classes} lớp dùng Đón Hộ{s.address ? ` · ${s.address}` : ""}</div>
                </div>
              ))}
            {u.province && <p className="small muted mt-10 mb-0">{u.province.name}: {sameProvince} trường đang dùng Đón Hộ.</p>}
          </div>

          <div className="card" id="doi">
            <h2>{u.ward ? "Đổi khu vực" : "Chọn khu vực"}</h2>
            <ActionForm action={updateAreaAction} keep>
              <AreaPicker provinces={list} defaults={{ provinceId: u.provinceId, wardId: u.wardId, wardName: u.ward && !u.ward.verified ? u.ward.name : null, schoolId: u.schoolId, schoolName: u.pendingSchool }} />
              <SubmitButton className="btn btn-block"><Icon name="mapPin" size={16} />Lưu khu vực</SubmitButton>
            </ActionForm>
            <p className="hint mt-10 mb-0">Đổi khu vực không đổi trường của con đã được cô xác nhận.</p>
          </div>
        </div>
      </div>
    </>
  );
}
