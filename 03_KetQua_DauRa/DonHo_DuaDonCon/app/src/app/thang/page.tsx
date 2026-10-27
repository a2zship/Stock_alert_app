import Link from "next/link";
import { redirect } from "next/navigation";
import { createMonthlyAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { RequestList } from "@/components/RequestList";
import { Empty, Note, PageHead } from "@/components/ui";
import { FEE_MIN, showVnd } from "@/domain/money";
import { MONTHLY_LABEL, monthOptions, NOTICE_DAYS, REFUND_DAYS, showDays, showMonth, WEEKDAYS } from "@/domain/monthly";
import { MONTHLY_FILTER, monthlySessionsToday, myMonthly } from "@/server/monthly";
import { placesOf } from "@/server/places";
import { currentUser, parentTrusted } from "@/server/queries";

type Loc = keyof typeof MONTHLY_FILTER | "hom-nay" | "tat-ca";
const TABS: { loc: Loc; label: string }[] = [
  { loc: "tat-ca", label: "Tất cả" }, { loc: "hom-nay", label: "Buổi hôm nay" }, { loc: "dang-chay", label: "Đang chạy" },
  { loc: "cho", label: "Đang chờ" }, { loc: "da-xong", label: "Đã xong" },
];

// Quản lý riêng các hợp đồng đón theo tháng và các buổi chúng sinh ra; lời nhờ đón lẻ vẫn ở trang chủ từng vai trò.
export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const q = (await searchParams).loc;
  const loc: Loc = TABS.some((t) => t.loc === q) ? (q as Loc) : "tat-ca";
  const [all, today, students, places] = await Promise.all([
    myMonthly(me.id), monthlySessionsToday(me.id), me.isParent ? parentTrusted(me.id) : [], me.isParent ? placesOf(me.id) : [],
  ]);
  const inGroup = (k: keyof typeof MONTHLY_FILTER) => all.filter((c) => (MONTHLY_FILTER[k] as readonly string[]).includes(c.status));
  const count: Record<Loc, number> = { "tat-ca": all.length, "hom-nay": today.length, "dang-chay": inGroup("dang-chay").length, cho: inGroup("cho").length, "da-xong": inGroup("da-xong").length };
  const list = loc === "tat-ca" || loc === "hom-nay" ? all : inGroup(loc);
  const months = monthOptions();

  return (
    <>
      <PageHead title="Đón theo tháng" sub="Một người đón cố định cho các buổi trong tháng. Cô duyệt một lần; mỗi buổi app tự tạo mã đón mới, tại cổng vẫn kiểm mã, ảnh và CCCD." />

      <div className="row">
        <div className="col">
          <nav className="seg mb-10" aria-label="Lọc hợp đồng">
            {TABS.map((t) => (
              <Link key={t.loc} href={t.loc === "tat-ca" ? "/thang" : `/thang?loc=${t.loc}`} aria-current={loc === t.loc ? "page" : undefined}>
                {t.label}{count[t.loc] > 0 && <span className="count ml-5">{count[t.loc]}</span>}
              </Link>
            ))}
          </nav>
          {loc === "hom-nay" ? (
            <div className="card">
              <h2>Buổi đón theo tháng hôm nay</h2>
              {today.length === 0
                ? <Empty icon="calendar">Hôm nay không có buổi đón theo hợp đồng tháng.</Empty>
                : <RequestList rows={today} show="student" />}
              <p className="small muted mt-10 mb-0">Mỗi buổi có mã đón riêng. Tại cổng vẫn quét mã hoặc nhập PIN, đối chiếu ảnh và CCCD.</p>
            </div>
          ) : (
          <div className="card">
            <h2>Hợp đồng {list.length > 0 && <span className="count">{list.length}</span>}</h2>
            {list.length === 0 ? <Empty icon="calendar">{loc === "tat-ca" ? "Chưa có hợp đồng đón theo tháng nào." : "Không có hợp đồng nào trong mục này."}</Empty> : list.map((c) => {
              const st = MONTHLY_LABEL[c.status];
              return (
                <div key={c.id} className="job">
                  <div>
                    <Link href={`/thang/${c.id}`}><strong>Bé {c.student.name}</strong> · {showMonth(c.month)}</Link>
                    <div className="meta">{c.student.class.name} · {showDays(c.weekdays)} · <span className="money">{showVnd(c.fee)}</span> trọn gói{c.helper ? ` · ${c.helper.name}` : ""}</div>
                  </div>
                  <span className={`badge badge-${st.tone}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
          )}

          {me.isParent && students.length > 0 && (
            <div className="card" id="tao">
              <h2>Tạo hợp đồng đón theo tháng</h2>
              <ActionForm action={createMonthlyAction}>
                <div className="fields">
                  <div className="field">
                    <label htmlFor="studentId">Bé</label>
                    <select id="studentId" name="studentId" required>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.class.name} ({s.class.pickupStart}–{s.class.pickupEnd})</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="month">Tháng</label>
                    <select id="month" name="month" defaultValue={months[1]} required>
                      {months.map((m, i) => <option key={m} value={m}>{showMonth(m)}{i === 0 ? " (từ ngày mai)" : ""}</option>)}
                    </select>
                  </div>
                </div>
                <fieldset className="field">
                  <legend>Các buổi đón trong tuần</legend>
                  <div className="checks week-pick">
                    {WEEKDAYS.map((w) => (
                      <label key={w.n}><input type="checkbox" name="weekdays" value={w.n} defaultChecked={w.n <= 5} /><span>{w.short}<span className="sr-only"> ({w.name})</span></span></label>
                    ))}
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor="fee">Thù lao trọn gói cả tháng (đồng)</label>
                  <input id="fee" name="fee" type="text" inputMode="numeric" placeholder="Ví dụ 600000" required />
                  <p className="hint">Tối thiểu {showVnd(FEE_MIN)} mỗi buổi. Trả một lần sau khi cô duyệt, chuyển thẳng cho người đón.</p>
                </div>
                <fieldset className="field">
                  <legend>Người đón</legend>
                  <div className="checks">
                    <label><input type="radio" name="mode" value="mo" defaultChecked /><span>Mở cho người đón có phí của trường <span className="small muted">— 24 giờ đầu ưu tiên thành viên Kim cương</span></span></label>
                    <label><input type="radio" name="mode" value="chi-dinh" /><span>Tôi chỉ định một người</span></label>
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor="helperPhone">Số điện thoại người được chỉ định</label>
                  <input id="helperPhone" name="helperPhone" type="tel" inputMode="tel" autoComplete="off" placeholder="09xxxxxxxx" />
                  <p className="hint">Chỉ dùng khi chọn &quot;Tôi chỉ định&quot;. Người này phải là người đón có phí đã được duyệt của trường.</p>
                </div>
                {places.length > 0 && (
                  <div className="field">
                    <label htmlFor="placeId">Điểm trả bé cả tháng</label>
                    <select id="placeId" name="placeId" defaultValue="">
                      <option value="">Thoả thuận với người đón</option>
                      {places.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.ward}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="note">Lời nhắn (không bắt buộc)</label>
                  <input id="note" name="note" type="text" maxLength={300} placeholder="Bé hay say xe, nhờ đi chậm" />
                </div>
                <SubmitButton className="btn btn-block"><Icon name="calendar" size={16} />Tạo hợp đồng</SubmitButton>
              </ActionForm>
            </div>
          )}
        </div>

        <div className="col">
          <div className="card card-soft">
            <h3>Cách đón theo tháng hoạt động</h3>
            <ol className="small mb-0">
              <li>Chọn người đón: chỉ định người quen trong trường, hoặc mở cho người đón có phí đã được duyệt.</li>
              <li>Cô lớp của bé duyệt người đón và lịch <strong>một lần</strong>, có gọi điện xác minh với phụ huynh.</li>
              <li>Phụ huynh chuyển <strong>trọn gói</strong> thẳng cho người đón bằng VietQR. App không giữ tiền.</li>
              <li>Mỗi buổi, app tự tạo mã đón mới. Tại cổng cô vẫn quét mã, đối chiếu ảnh và CCCD.</li>
            </ol>
          </div>
          <div className="card card-soft">
            <h3>Huỷ buổi, nghỉ và hoàn tiền</h3>
            <ul className="small mb-0">
              <li>Phụ huynh huỷ một buổi (bé nghỉ học): người đón được báo, <strong>không hoàn tiền</strong> vì đã giữ lịch.</li>
              <li>Người đón báo nghỉ một buổi: phụ huynh và cô được báo ngay để nhờ người khác; buổi đó được <strong>hoàn tiền</strong>.</li>
              <li>Người đón dừng hợp đồng: hoàn mọi buổi còn lại. Phụ huynh dừng: hoàn các buổi còn lại trừ {NOTICE_DAYS} buổi báo trước.</li>
              <li>Người đón hoàn tiền trong {REFUND_DAYS} ngày; quá hạn thì tạm không nhận việc có phí mới.</li>
              <li>Trả trước là rủi ro của phụ huynh: app chỉ ghi sổ, không giữ hay hoàn tiền thay. [CẦN XÁC MINH chính sách hoàn tiền và trách nhiệm pháp lý]</li>
            </ul>
          </div>
          {!me.isParent && <Note>Phụ huynh tạo hợp đồng; cô duyệt ở đây hoặc từ thông báo.</Note>}
        </div>
      </div>
    </>
  );
}
