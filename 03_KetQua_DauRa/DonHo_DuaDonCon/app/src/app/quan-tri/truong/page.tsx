import { redirect } from "next/navigation";
import { runNudgesAction, verifySchoolAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { CopyText } from "@/components/CopyText";
import { Empty, Note, PageHead } from "@/components/ui";
import { DEMAND_MIN, msgInviteSchool, STAGE_LABEL, STAGES } from "@/domain/sales";
import { currentUser } from "@/server/queries";
import { funnel, inviteSchoolUrl } from "@/server/sales";

const NUDGE_LABEL: Record<string, string> = {
  "truong-chua-co-co": "Nhắc trường thêm cô",
  "lop-it-phu-huynh": "Nhắc cô mời phụ huynh",
  "thieu-nguoi-don": "Nhắc cô mời người đón",
  "de-xuat-truong": "Nhắc phụ huynh mời trường",
};
const day = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

// Phễu tự bán cho quản trị nền tảng: trường ở bước nào, trường chờ xác minh, nhu cầu phụ huynh đề xuất, nhắc việc tự động.
export default async function FunnelPage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (!me.isPlatformAdmin) redirect("/");
  const { rows, byStage, demand, nudges } = await funnel(me.id);
  const unverified = rows.filter((r) => !r.verified);

  return (
    <>
      <PageHead title="Phễu trường" sub="Trường tự mở trên app và đi qua từng bước. Lượt đón và doanh thu tính 30 ngày gần nhất.">
        <ActionForm action={runNudgesAction}><SubmitButton className="btn btn-plain btn-sm">Chạy nhắc việc ngay</SubmitButton></ActionForm>
      </PageHead>

      <div className="stats">
        {STAGES.map((s) => (
          <div key={s} className="stat"><div className="label">{STAGE_LABEL[s]}</div><div className="value">{byStage.get(s) ?? 0}</div><div className="hint">trường</div></div>
        ))}
      </div>

      {unverified.length > 0 && (
        <div className="card">
          <h2>Chờ gọi xác minh <span className="count">{unverified.length}</span></h2>
          <p className="meta">Gọi số của ban giám hiệu, hỏi đúng trường và địa chỉ rồi mới bấm xác minh. Xác minh xong mới mở đón có phí và chuyển chia sẻ.</p>
          {unverified.map((r) => (
            <div key={r.id} className="list-item list-row">
              <span><span className="desc">{r.name}</span><span className="meta"> · {r.ward.name}, {r.ward.province.name} · mở {day(r.createdAt)}</span></span>
              <ActionForm action={verifySchoolAction}>
                <input type="hidden" name="schoolId" value={r.id} />
                <SubmitButton className="btn btn-ok btn-sm" confirm={`Đã gọi xác minh ${r.name}?`}>Đã gọi, xác minh</SubmitButton>
              </ActionForm>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Tất cả trường</h2>
        {rows.length === 0 ? <Empty icon="school">Chưa có trường.</Empty> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Trường</th><th scope="col">Bước</th><th scope="col" className="num">Lớp</th><th scope="col" className="num">Cô</th><th scope="col" className="num">PH</th><th scope="col" className="num">Người đón</th><th scope="col" className="num">Lượt đón</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.name}<div className="meta">{r.ward.name}{r.verified ? "" : " · chưa xác minh"}</div></th>
                    <td>{STAGE_LABEL[r.stage]}</td>
                    <td className="num">{r._count.classes}</td>
                    <td className="num">{r.counts.teachers}</td>
                    <td className="num">{r.counts.parents}</td>
                    <td className="num">{r.counts.helpers}</td>
                    <td className="num">{r.counts.pickups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Phụ huynh đề xuất trường chưa có</h2>
            <p className="meta">Đủ {DEMAND_MIN} phụ huynh cùng đề xuất thì app tự nhắc họ gửi đường dẫn mời nhà trường. Danh sách này cũng là khách để gọi trước.</p>
            {demand.length === 0 ? <Empty icon="school">Chưa có đề xuất.</Empty> : demand.map((g) => (
              <details key={g.key} className="list-item">
                <summary className="list-row">
                  <span className="desc">{g.name}</span>
                  <span className="meta">{g.ward}, {g.province} · {g.users.length} phụ huynh</span>
                </summary>
                <CopyText id={`inv-${g.key}`} label={`Tin mời ${g.name}`} rows={6}
                  text={msgInviteSchool({ school: g.name, count: g.users.length, url: inviteSchoolUrl(g) })} />
              </details>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="card">
            <h2>Nhắc việc đã gửi</h2>
            {nudges.length === 0 ? <Empty icon="inbox">Chưa gửi lời nhắc nào.</Empty> : nudges.map((n) => (
              <div key={n.id} className="list-item list-row">
                <span>{NUDGE_LABEL[n.kind] ?? n.kind}</span>
                <span className="meta">{day(n.sentAt)}</span>
              </div>
            ))}
          </div>
          <Note kind="info"><Icon name="clock" size={16} /> Chạy tự động: gọi <code>POST /api/nhac-viec</code> mỗi ngày với <code>Authorization: Bearer CRON_SECRET</code>. Mỗi lời nhắc gửi tối đa 3 lần, cách nhau ít nhất 7 ngày.</Note>
        </div>
      </div>
    </>
  );
}
