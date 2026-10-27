import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { Empty, Hero, Note } from "@/components/ui";
import { currentUser, teacherToday } from "@/server/queries";

export default async function TeacherHome() {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const { today, waiting, pendingTrusted } = await teacherToday(me.id);
  const toReview = today.filter((r) => r.status === "CHO_GIAO_VIEN");
  const ready = today.filter((r) => r.status === "DA_DUYET");
  const others = today.filter((r) => !toReview.includes(r) && !ready.includes(r));
  const arrived = ready.filter((r) => r.arrivedAt);

  return (
    <>
      <Hero title="Hôm nay của lớp" sub={`${me.teaches.map((t) => `${t.class.name} · ${t.class.school.name}`).join("; ")}. ${toReview.length + waiting.length ? `${toReview.length + waiting.length} yêu cầu chờ cô duyệt.` : "Chưa có yêu cầu nào chờ duyệt."}`} art="school">
        <Link href="/giao-vien/giao-tre" className="btn btn-lg"><Icon name="qr" />Giao trẻ tại cổng</Link>
        <Link href="/nhom" className="btn btn-lg btn-outline"><Icon name="message" />Nhóm lớp</Link>
      </Hero>
      {arrived.length > 0 && (
        <div className="card alert-banner">
          <h2>Người đón đã tới cổng <span className="count">{arrived.length}</span></h2>
          <RequestList rows={arrived} show="student" />
        </div>
      )}
      {pendingTrusted > 0 && (
        <Note kind="warn">Có {pendingTrusted} người tin cậy đang chờ cô/thầy duyệt.<div className="mt-10"><Link href="/giao-vien/nguoi-tin-cay" className="btn btn-plain btn-sm">Xem và duyệt</Link></div></Note>
      )}
      <div className="card">
        <h2>Cần duyệt <span className="count">{toReview.length + waiting.length}</span></h2>
        {toReview.length + waiting.length === 0 ? <Empty icon="checkCircle">Không có yêu cầu nào chờ duyệt.</Empty> : <RequestList rows={[...toReview, ...waiting]} show="student" />}
      </div>
      <div className="card">
        <h2>Đã duyệt, chờ người đón tới</h2>
        {ready.length === 0 ? <Empty icon="clock">Chưa có.</Empty> : <RequestList rows={ready} show="student" />}
      </div>
      {others.length > 0 && (
        <div className="card">
          <h2>Khác trong ngày</h2>
          <RequestList rows={others} show="student" />
        </div>
      )}
    </>
  );
}
