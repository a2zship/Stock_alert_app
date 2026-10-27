import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { RewardSummary } from "@/components/Reward";
import { Avatar, Empty, Hero, Photo } from "@/components/ui";
import { computeReward } from "@/domain/reward";
import { vnToday } from "@/domain/time";
import { db } from "@/server/db";
import { currentUser, parentHome } from "@/server/queries";
import { rewardOf } from "@/server/rewards";

/** Tên gọi thân mật: "Chị Phạm Thu Hoa" → "chị Hoa". */
const greetName = (full: string) => {
  const w = full.split(/\s+/);
  const title = /^(anh|chị|cô|thầy|bà|ông|chú)$/i.test(w[0]) ? `${w[0].toLowerCase()} ` : "";
  return `${title}${w.at(-1)}`;
};

export default async function ParentHome() {
  const me = await currentUser();
  if (!me?.isParent) redirect("/");
  const { students, active, recent } = await parentHome(me.id);
  const needConfirm = active.filter((r) => r.status === "DA_GIAO");
  const tracking = active.filter((r) => r.status === "DA_DUYET");
  const classIds = [...new Set(students.map((s) => s.classId))];
  const [openAsks, reward] = await Promise.all([
    db.chatPost.count({ where: { classId: { in: classIds }, kind: "NHO_DON", status: "MO", date: { gte: vnToday() }, authorId: { not: me.id } } }),
    rewardOf(me.id).then(computeReward),
  ]);
  const first = students[0];

  return (
    <>
      <Hero
        title={`Chào ${greetName(me.name)}`}
        sub={first ? `Hôm nay ${students.map((s) => `bé ${s.name.split(" ").pop()}`).join(", ")} tan học lúc ${first.class.pickupStart}–${first.class.pickupEnd}. Bận đột xuất? Nhờ người đón chỉ mất một phút.` : "Bận đột xuất? Nhờ người đón chỉ mất một phút."}
        art="shield"
      >
        <Link href="/phu-huynh/nho-don" className="btn btn-lg"><Icon name="plus" />Nhờ đón hộ</Link>
        <Link href="/nhom" className="btn btn-lg btn-outline"><Icon name="message" />Nhờ trong nhóm lớp</Link>
      </Hero>

      {needConfirm.length > 0 && (
        <div className="card alert-banner">
          <h2>Bé đã được giao — chờ bạn xác nhận</h2>
          <p className="muted small">Khi bé về tới nơi, mở yêu cầu và bấm &quot;Con đã về an toàn&quot;. Bạn có thể xem người đón đang ở đâu trên bản đồ.</p>
          <RequestList rows={needConfirm} show="student" />
        </div>
      )}
      {tracking.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Đang chờ người đón tới trường</h2><span className="live-dot on">Theo dõi trên bản đồ</span></div>
          <RequestList rows={tracking} show="student" />
        </div>
      )}

      <div className="quick-grid">
        <Link href="/nhom" className="quick warm">
          <span className="ic"><Icon name="message" /></span>
          <strong>Nhóm lớp</strong>
          <span className="small">{openAsks ? `${openAsks} phụ huynh đang cần người đón giúp` : "Nhắn tin, nhờ đón trong lớp"}</span>
        </Link>
        <Link href="/nguoi-don" className="quick warm">
          <span className="ic"><Icon name="award" /></span>
          <strong>{reward.points} điểm tương trợ</strong>
          <span className="small">{reward.tier.name}</span>
        </Link>
        <Link href="/nguoi-tin-cay" className="quick">
          <span className="ic"><Icon name="users" /></span>
          <strong>Người tin cậy</strong>
          <span className="small">Ông bà, người thân được cô duyệt sẵn</span>
        </Link>
        <Link href="/hop-tin" className="quick">
          <span className="ic"><Icon name="inbox" /></span>
          <strong>Hộp tin</strong>
          <span className="small">Thông báo từ trường và người đón</span>
        </Link>
      </div>

      <h2 className="section-title"><Icon name="smile" />Con của tôi</h2>
      <div className="row">
        {students.map((s) => (
          <div key={s.id} className="col">
            <div className="card">
              <div className="kid">
                {s.photoId ? <Photo id={s.photoId} alt={`Ảnh bé ${s.name}`} size={56} /> : <Avatar name={s.name} size="lg" />}
                <div>
                  <div className="name">{s.name}</div>
                  <div className="meta">{s.class.name} · {s.class.school.name}</div>
                  <span className="kid-time"><Icon name="clock" size={16} />Giờ đón {s.class.pickupStart}–{s.class.pickupEnd}</span>
                </div>
              </div>
              <div className="actions mt-15">
                <Link href={`/phu-huynh/nho-don?be=${s.id}`} className="btn btn-ghost btn-sm"><Icon name="plus" size={16} />Nhờ đón bé {s.name.split(" ").pop()}</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Đang nhờ đón</h2>
            {active.length === 0 ? <Empty icon="hand">Chưa có yêu cầu nào đang chạy. Khi bận đột xuất, bấm &quot;Nhờ đón hộ&quot;.</Empty> : <RequestList rows={active} show="student" />}
          </div>
          <div className="card">
            <h2>Gần đây</h2>
            {recent.length === 0 ? <Empty icon="clock">Chưa có lịch sử.</Empty> : <RequestList rows={recent} show="student" />}
          </div>
        </div>
        <div className="col">
          <RewardSummary r={reward} compact />
          <div className="card card-soft">
            <h3>Giúp người, khi cần có người giúp</h3>
            <p className="small muted mb-0">Đón giúp con của phụ huynh cùng lớp để nhận điểm tương trợ, huy hiệu và lời cảm ơn. Khi bạn đạt hạng “Hàng xóm tin cậy”, lời nhờ của bạn được ưu tiên lên đầu nhóm lớp.</p>
            <Link href="/nguoi-don" className="btn btn-ghost btn-sm mt-10">Xem quyền lợi</Link>
          </div>
        </div>
      </div>
    </>
  );
}
