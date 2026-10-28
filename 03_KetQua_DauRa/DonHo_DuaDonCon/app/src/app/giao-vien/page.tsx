import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { Empty, Hero, Note } from "@/components/ui";
import { db } from "@/server/db";
import { helpersToReview } from "@/server/earn";
import { currentUser, teacherToday } from "@/server/queries";

export default async function TeacherHome() {
  const me = await currentUser();
  if (!me?.isTeacher) redirect("/");
  const { today, monthly: monthlyToday, waiting, pendingTrusted } = await teacherToday(me.id);
  const pendingHelpers = (await helpersToReview(me.id)).filter((h) => h.status === "CHO_DUYET").length;
  const toReview = today.filter((r) => r.status === "CHO_GIAO_VIEN");
  const ready = today.filter((r) => r.status === "DA_DUYET");
  const others = today.filter((r) => !toReview.includes(r) && !ready.includes(r));
  const arrived = [...ready, ...monthlyToday.filter((r) => r.status === "DA_DUYET")].filter((r) => r.arrivedAt);
  const newParents = await db.guardianClaim.count({ where: { status: "CHO_DUYET", class: { teachers: { some: { userId: me.id } } } } });
  const monthly = await db.monthlyContract.findMany({
    where: { status: "CHO_GIAO_VIEN", student: { class: { teachers: { some: { userId: me.id } } } } },
    include: { student: true, helper: true }, orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <Hero title="Hôm nay của lớp" sub={`${me.teaches.map((t) => `${t.class.name} · ${t.class.school.name}`).join("; ")}. ${toReview.length + waiting.length ? `${toReview.length + waiting.length} yêu cầu chờ cô duyệt.` : "Chưa có yêu cầu nào chờ duyệt."}`} art="school">
        <Link href="/giao-vien/giao-tre" className="btn btn-lg"><Icon name="qr" />Giao trẻ tại cổng</Link>
        <Link href="/nhom" className="btn btn-lg btn-outline"><Icon name="message" />Nhóm lớp</Link>
        {me.teaches.map((t) => (
          <Link key={t.classId} href={`/truong/lop/${t.classId}`} className="btn btn-lg btn-outline"><Icon name="send" />Mời phụ huynh {me.teaches.length > 1 ? t.class.name : "vào lớp"}</Link>
        ))}
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
      {pendingHelpers > 0 && (
        <Note kind="warn">Có {pendingHelpers} phụ huynh đăng ký làm người đón có phí đang chờ duyệt.<div className="mt-10"><Link href="/giao-vien/nguoi-don-co-phi" className="btn btn-plain btn-sm">Xem và duyệt</Link></div></Note>
      )}
      {newParents > 0 && (
        <Note kind="warn">Có {newParents} phụ huynh mới tự đăng ký, xin cô xác nhận là phụ huynh của bé.<div className="mt-10"><Link href="/giao-vien/phu-huynh-moi" className="btn btn-plain btn-sm">Gọi xác minh và xác nhận</Link></div></Note>
      )}
      {monthly.length > 0 && (
        <Note kind="warn">
          Có {monthly.length} hợp đồng đón theo tháng chờ cô duyệt (duyệt một lần cho cả tháng).
          <div className="actions mt-10">{monthly.map((c) => <Link key={c.id} href={`/thang/${c.id}`} className="btn btn-plain btn-sm"><Icon name="calendar" size={16} />Bé {c.student.name} · {c.helper?.name}</Link>)}</div>
        </Note>
      )}
      <div className="card">
        <h2>Cần duyệt <span className="count">{toReview.length + waiting.length}</span></h2>
        {toReview.length + waiting.length === 0 ? <Empty icon="checkCircle">Không có yêu cầu nào chờ duyệt.</Empty> : <RequestList rows={[...toReview, ...waiting]} show="student" />}
      </div>
      <div className="card">
        <h2>Đã duyệt, chờ người đón tới</h2>
        {ready.length === 0 ? <Empty icon="clock">Chưa có.</Empty> : <RequestList rows={ready} show="student" />}
      </div>
      {monthlyToday.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Đón theo tháng hôm nay <span className="count">{monthlyToday.length}</span></h2><Link href="/thang?loc=hom-nay" className="btn btn-plain btn-sm">Quản lý</Link></div>
          <p className="small muted">Cô đã duyệt người đón cho cả tháng. Tại cổng vẫn quét mã, đối chiếu ảnh và CCCD như mọi buổi.</p>
          <RequestList rows={monthlyToday} show="student" />
        </div>
      )}
      {others.length > 0 && (
        <div className="card">
          <h2>Khác trong ngày</h2>
          <RequestList rows={others} show="student" />
        </div>
      )}
    </>
  );
}
