import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Empty, PageHead } from "@/components/ui";
import { showDateTime } from "@/domain/time";
import { currentUser, inbox } from "@/server/queries";

export default async function InboxPage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const items = await inbox(me.id);
  return (
    <>
      <PageHead title="Hộp tin" sub="Thông báo gửi cho bạn. Bản thử nghiệm: tin SMS cũng hiện ở đây thay vì gửi về điện thoại." />
      <div className="card">
        {items.length === 0 ? <Empty>Chưa có tin nào.</Empty> : items.map((m) => {
          const body = (
            <>
              <div className="list-row">
                <span className="badge">{m.channel === "SMS" ? <><Icon name="phone" size={16} />Tin nhắn</> : <><Icon name="inbox" size={16} />Thông báo</>}</span>
                <span className="meta">{showDateTime(m.createdAt)}{!m.readAt && <strong className="ml-5">· Mới</strong>}</span>
              </div>
              <div className="msg-body mt-10">{m.body}</div>
            </>
          );
          const href = m.link?.startsWith("/") ? m.link : null;
          return href ? <Link key={m.id} href={href} className="list-item">{body}</Link> : <div key={m.id} className="list-item">{body}</div>;
        })}
      </div>
    </>
  );
}
