import Link from "next/link";
import { redirect } from "next/navigation";
import { chooseOfferAction, closePostAction, offerHelpAction, withdrawOfferAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Avatar, Empty, PageHead, StatusBadge } from "@/components/ui";
import type { Status } from "@/domain/state";
import { addDays, vnToday } from "@/domain/time";
import { chatFeed, classesOf } from "@/server/chat";
import { placesOf } from "@/server/places";
import { currentUser } from "@/server/queries";
import { AutoRefresh, Composer } from "./ChatClient";

const stamp = (d: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(d);

function TierChip({ tierIdx, tier, pickups }: { tierIdx: number; tier: string; pickups: number }) {
  if (pickups === 0) return null;
  return <span className="chip-tier" title={`Đã đón hộ ${pickups} lần`}><Icon name="award" size={12} />{tierIdx > 0 ? tier : `Đã giúp ${pickups} lần`}</span>;
}

export default async function GroupPage({ searchParams }: { searchParams: Promise<{ lop?: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const classes = await classesOf(me.id);
  if (classes.length === 0) {
    return (<><PageHead title="Nhóm lớp" /><div className="card"><Empty icon="message">Bạn chưa thuộc lớp nào. Nhóm lớp dành cho phụ huynh và giáo viên của lớp.</Empty></div></>);
  }
  const { lop } = await searchParams;
  const current = classes.find((c) => c.id === lop) ?? classes[0];
  const [feed, places] = await Promise.all([chatFeed(me.id, current.id), placesOf(me.id)]);
  const sc = feed.cls.school;
  const today = vnToday();

  return (
    <>
      <AutoRefresh />
      <PageHead title={`Nhóm ${feed.cls.name.replace(/^Lớp /, "lớp ")}`} sub={`${feed.cls.school.name} · ${feed.members} thành viên · phụ huynh và giáo viên của lớp`} />
      {classes.length > 1 && (
        <nav className="seg mb-10" aria-label="Chọn lớp">
          {classes.map((c) => <Link key={c.id} href={`/nhom?lop=${c.id}`} aria-current={c.id === current.id ? "page" : undefined}>{c.name}</Link>)}
        </nav>
      )}

      {feed.openAsks.length > 0 && (
        <>
          <h2 className="section-title"><Icon name="hand" />Đang cần người đón giúp <span className="count">{feed.openAsks.length}</span></h2>
          <div className="open-asks">
            {feed.openAsks.map((p) => (
              <a key={p.id} href={`#p-${p.id}`}>
                <div className="who"><strong>{p.author.name}</strong><TierChip {...p.author} /></div>
                <div className="desc">Bé {p.ask!.studentName}</div>
                <div className="meta">{p.ask!.when}{p.ask!.ward ? ` · trả bé ở ${p.ask!.ward}` : ""} · {p.offers.length ? `${p.offers.length} người nhận` : "chưa có ai nhận"}</div>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="chat" aria-live="polite">
        {feed.posts.length === 0 && <div className="card"><Empty icon="message">Nhóm chưa có tin nào. Hãy chào cả lớp!</Empty></div>}
        {feed.posts.map((p) => p.kind === "TIN_NHAN" ? (
          <div key={p.id} id={`p-${p.id}`} className={`msg ${p.mine ? "mine" : ""}`}>
            {!p.mine && <Avatar name={p.author.name} size="sm" />}
            <div>
              <div className="bubble">
                {!p.mine && <div className="who"><strong>{p.author.name}</strong>{p.author.who}<TierChip {...p.author} /></div>}
                <div className="text">{p.body}</div>
              </div>
              <div className="time">{stamp(p.createdAt)}</div>
            </div>
          </div>
        ) : (
          <article key={p.id} id={`p-${p.id}`} className={`ask ${p.mine ? "mine" : ""} ${p.status !== "MO" || p.ask?.expired ? "closed" : ""}`} aria-label={`Lời nhờ đón bé ${p.ask?.studentName}`}>
            <div className="ask-head">
              <Avatar name={p.author.name} size="sm" />
              <div className="who"><strong>{p.mine ? "Bạn" : p.author.name}</strong>{p.author.who}<TierChip {...p.author} /></div>
            </div>
            <div className="ask-kicker mt-10"><Icon name="hand" size={16} />Nhờ đón hộ</div>
            <div className="ask-title">Bé {p.ask?.studentName}</div>
            <div className="meta"><Icon name="clock" size={16} /> {p.ask?.when}</div>
            {p.ask?.ward && <div className="ask-ward"><Icon name="home" size={16} />{p.ask.dropAddress ?? `Trả bé ở ${p.ask.ward}`}</div>}
            {p.body && <p className="mt-10 mb-0">{p.body}</p>}

            {p.status === "DA_CHON" && p.ask?.requestId && (
              <div className="mt-10 actions">
                {p.ask.requestStatus && <StatusBadge status={p.ask.requestStatus as Status} />}
                {p.ask.canView ? <Link href={`/yeu-cau/${p.ask.requestId}`} className="btn btn-plain btn-sm">Xem yêu cầu đón hộ</Link>
                  : <span className="small muted">Đã chọn được người đón.</span>}
              </div>
            )}
            {p.status === "DA_DONG" && <p className="small muted mt-10 mb-0">Người đăng đã đóng lời nhờ.</p>}
            {p.status === "MO" && p.ask?.expired && <p className="small muted mt-10 mb-0">Đã qua giờ đón.</p>}

            {p.offers.length > 0 && (
              <div className="offers">
                {p.offers.map((o) => (
                  <div key={o.id} className="offer">
                    <Avatar name={o.name} size="sm" />
                    <div>
                      <div className="who"><strong>{o.userId === me.id ? "Bạn" : o.name}</strong>{o.who}<TierChip {...o} /></div>
                      <div className="small">{o.note || "Có thể đón giúp"}</div>
                    </div>
                    {p.ask?.canChoose && !p.ask.expired && (
                      <ActionForm action={chooseOfferAction} className="inline">
                        <input type="hidden" name="offerId" value={o.id} />
                        <SubmitButton className="btn btn-sm btn-ok" confirm={`Nhờ ${o.name} đón bé? Hệ thống sẽ gửi yêu cầu để người này xác nhận và cô giáo duyệt.`}><Icon name="check" size={16} />Chọn người này</SubmitButton>
                      </ActionForm>
                    )}
                    {o.userId === me.id && p.status === "MO" && (
                      <ActionForm action={withdrawOfferAction} className="inline">
                        <input type="hidden" name="postId" value={p.id} />
                        <SubmitButton className="btn btn-sm btn-plain">Rút</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                ))}
              </div>
            )}

            {p.ask?.canOffer && !p.ask.expired && (
              <ActionForm action={offerHelpAction} className="mt-15">
                <input type="hidden" name="postId" value={p.id} />
                <div className="offer-form">
                  <div>
                    <label htmlFor={`note-${p.id}`} className="sr-only">Lời nhắn khi nhận đón</label>
                    <input id={`note-${p.id}`} name="note" type="text" maxLength={200} placeholder="Lời nhắn (ví dụ: Mình tiện đường)" />
                  </div>
                  <SubmitButton className="btn btn-accent"><Icon name="heart" size={16} />Tôi đón giúp được</SubmitButton>
                </div>
              </ActionForm>
            )}
            {p.mine && p.status === "MO" && (
              <ActionForm action={closePostAction} className="mt-10">
                <input type="hidden" name="postId" value={p.id} />
                <SubmitButton className="btn btn-sm btn-plain" confirm="Đóng lời nhờ này? Mọi người sẽ không nhận được nữa.">Đóng lời nhờ</SubmitButton>
              </ActionForm>
            )}
            <div className="time">{stamp(p.createdAt)}</div>
          </article>
        ))}
      </div>

      <Composer classId={current.id} kids={feed.isParent ? feed.myKids.map((k) => ({ id: k.id, name: k.name })) : []} today={today} maxDate={addDays(today, 7)}
        places={places.map((p) => ({ id: p.id, label: p.label, address: p.address, ward: p.ward, lat: p.lat, lng: p.lng }))}
        center={sc.lat != null && sc.lng != null ? { lat: sc.lat, lng: sc.lng } : null} />
    </>
  );
}
