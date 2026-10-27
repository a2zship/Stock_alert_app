import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { RewardBadges, RewardPerks, RewardRules, RewardSummary } from "@/components/Reward";
import { Empty, PageHead } from "@/components/ui";
import { showDate } from "@/domain/time";
import { currentUser, delegateInbox } from "@/server/queries";
import { rewardPage } from "@/server/rewards";

export default async function DelegateHome() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const [{ rows, monthly }, { reward, thanks }] = await Promise.all([delegateInbox(me.id), rewardPage(me.id)]);
  const open = rows.filter((r) => ["CHO_NGUOI_DON", "CHO_GIAO_VIEN", "DA_DUYET", "DA_GIAO"].includes(r.status));
  const past = rows.filter((r) => !open.includes(r));
  return (
    <>
      <PageHead title="Giúp đón & tương trợ" sub="Đón giúp con của người thân, phụ huynh cùng lớp. Mỗi lần đón trọn vẹn được ghi nhận bằng điểm tương trợ.">
        {me.isParent && <Link href="/nhom" className="btn btn-accent"><Icon name="message" />Xem ai đang cần giúp</Link>}
      </PageHead>

      <div className="row">
        <div className="col">
          <RewardSummary r={reward} />
          <div className="card">
            <h2>Huy hiệu</h2>
            <RewardBadges r={reward} />
          </div>
          <div className="card">
            <h2>Quyền lợi của bạn</h2>
            <RewardPerks r={reward} />
          </div>
          <div className="card card-soft"><RewardRules /></div>
        </div>
        <div className="col">
          <div className="card">
            <h2>Lời nhờ đang chờ bạn {open.length > 0 && <span className="count">{open.length}</span>}</h2>
            {open.length === 0
              ? <Empty icon="hand">Chưa có ai nhờ bạn. {me.isParent ? "Vào nhóm lớp để xem phụ huynh nào đang cần giúp." : ""}</Empty>
              : <RequestList rows={open} show="student" />}
            <p className="small muted mt-10 mb-0">Các bước: nhận lời → cô giáo duyệt → bạn nhận mã đón → tới cổng đưa mã + CCCD bản gốc.</p>
          </div>
          {monthly.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Buổi đón theo tháng <span className="count">{monthly.length}</span></h2><Link href="/thang" className="btn btn-plain btn-sm">Hợp đồng</Link></div>
              <RequestList rows={monthly} show="student" />
              <p className="small muted mt-10 mb-0">Buổi theo hợp đồng có thù lao trọn gói, không tính điểm tương trợ. Báo nghỉ hoặc dừng hợp đồng ở trang hợp đồng.</p>
            </div>
          )}
          {thanks.length > 0 && (
            <div className="card">
              <h2>Lời cảm ơn gửi bạn</h2>
              {thanks.map((t) => (
                <div key={t.id} className="thanks">
                  <q>{t.text}</q>
                  <div className="meta">{t.from} · đón bé {t.student.split(" ").pop()}{t.at ? ` · ${showDate(t.at)}` : ""}</div>
                </div>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="card">
              <h2>Đã xong</h2>
              <RequestList rows={past} show="student" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
