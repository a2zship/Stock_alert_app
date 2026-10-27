import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { buyMembershipAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Note, PageHead } from "@/components/ui";
import { isPaidTier, MEMBER_TIERS, priceOf, rateOf, tierInfo, tierRank, type MemberTier } from "@/domain/membership";
import { showVnd } from "@/domain/money";
import { platformRate } from "@/server/db";
import { membershipHistory, membershipQr, tierOf } from "@/server/membership";
import { currentUser } from "@/server/queries";

const pct = (r: number) => `${Math.round(r * 100)}%`;
/** Ngày có năm — gói 12 tháng mà thiếu năm sẽ trông như hết hạn hôm nay. */
const showDay = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const STATUS = { CHO_DOI_SOAT: "Chờ đối soát", DA_XAC_NHAN: "Đã xác nhận", HUY: "Đã huỷ" } as const;

/** Ưu đãi của một hạng, chia theo vai: khi nhận đón và khi nhờ đón. */
function perks(t: MemberTier, base: number) {
  const r = pct(rateOf(t, base));
  return {
    helper: [
      `Phí nền tảng ${r} trên thù lao thực nhận`,
      `Hạn mức nợ phí ${showVnd(t.owedLimit)} · ${t.owedDays} ngày`,
    ],
    requester: [
      t.key === "THUONG" ? "Người đón giúp bạn chịu phí nền tảng thường" : `Người đón giúp bạn chỉ chịu phí ${r} — nhận nhiều hơn, dễ có người nhận`,
      `Lưu ${t.places} điểm trả hay dùng`,
      ...(t.featured ? ["Lời nhờ có thù lao nổi bật, đứng đầu bảng việc của trường"] : []),
      ...(t.askBoost ? ["Trong nhóm lớp: đứng trước lời nhờ cùng hạng tương trợ"] : []),
    ],
  };
}

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ hang?: string; thang?: string }> }) {
  const me = await currentUser();
  if (!me?.isParent) redirect("/");
  const { hang, thang } = await searchParams;
  const base = platformRate();
  const [current, history] = await Promise.all([tierOf(me.id), membershipHistory(me.id)]);
  const months = thang === "12" ? 12 : 1;
  const order = isPaidTier(hang) ? await membershipQr(me.id, hang, months) : null;
  const orderSvg = order ? await QRCode.toString(order.qr, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <>
      <PageHead title="Thành viên ưu đãi" sub="Không đóng phí vẫn dùng đủ mọi dịch vụ đón hộ. Đóng phí nhận thêm ưu đãi về tiền và tiện lợi, cho cả khi nhờ đón lẫn khi nhận đón." />

      <div className="card member-now">
        <div className="ic"><Icon name="star" /></div>
        <div>
          <div className="small muted">Hạng hiện tại</div>
          <strong className="member-name">{current.name}</strong>
          <div className="small muted">{current.endsAt ? `Ưu đãi tới ngày ${showDay(current.endsAt)}` : "Miễn phí — dùng đủ dịch vụ thông thường"}</div>
        </div>
      </div>

      <div className="tier-grid">
        {MEMBER_TIERS.map((t) => {
          const p = perks(t, base);
          const isNow = t.key === current.key;
          return (
            <section key={t.key} className={`card tier-card${isNow ? " now" : ""}${hang === t.key ? " picked" : ""}`} aria-labelledby={`tier-${t.key}`}>
              <h2 id={`tier-${t.key}`}>{t.name}{isNow && <span className="badge badge-ok ml-5">Đang dùng</span>}</h2>
              <div className="tier-price">{t.monthly ? <><span className="money-lg">{showVnd(t.monthly)}</span><span className="small muted">/tháng</span></> : <span className="money-lg">0đ</span>}</div>
              <h3 className="tier-role"><Icon name="hand" size={16} />Khi nhờ đón</h3>
              <ul className="small">{p.requester.map((x) => <li key={x}>{x}</li>)}</ul>
              <h3 className="tier-role"><Icon name="wallet" size={16} />Khi nhận đón có phí</h3>
              <ul className="small">{p.helper.map((x) => <li key={x}>{x}</li>)}</ul>
              {t.monthly > 0 && (
                <Link href={`/thanh-vien?hang=${t.key}&thang=${months}#mua`} className={`btn btn-block ${tierRank(t.key) > tierRank(current.key) ? "btn-accent" : "btn-plain"}`}>
                  {isNow ? "Gia hạn" : tierRank(t.key) > tierRank(current.key) ? `Nâng lên ${t.name}` : `Chọn ${t.name}`}
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <div className="row">
        <div className="col">
          {isPaidTier(hang) && (
            <div className="card" id="mua">
              <h2>Mua gói {tierInfo(hang).name}</h2>
              <div className="pick-row mb-10" role="group" aria-label="Thời hạn gói">
                <Link href={`/thanh-vien?hang=${hang}&thang=1#mua`} className={`btn btn-sm ${months === 1 ? "btn-accent" : "btn-plain"}`} aria-current={months === 1 ? "true" : undefined}>1 tháng · {showVnd(priceOf(hang, 1))}</Link>
                <Link href={`/thanh-vien?hang=${hang}&thang=12#mua`} className={`btn btn-sm ${months === 12 ? "btn-accent" : "btn-plain"}`} aria-current={months === 12 ? "true" : undefined}>12 tháng · {showVnd(priceOf(hang, 12))} (tặng 2 tháng)</Link>
              </div>
              {order && orderSvg ? (
                <>
                  <p className="small muted">Quét mã bằng app ngân hàng; tiền vào tài khoản của nền tảng Đón Hộ. {tierRank(hang) > tierRank(current.key) ? "Nâng hạng có hiệu lực ngay." : "Gói nối tiếp sau gói đang dùng."}</p>
                  <div className="pay-box">
                    <div className="qr" role="img" aria-label={`Mã VietQR mua gói ${tierInfo(hang).name} ${months} tháng`} dangerouslySetInnerHTML={{ __html: orderSvg }} />
                    <dl className="kv">
                      <dt>Số tiền</dt><dd className="money">{showVnd(order.amount)}</dd>
                      <dt>Ngân hàng</dt><dd>{order.bank}</dd>
                      <dt>Tài khoản</dt><dd>{order.account}</dd>
                      <dt>Chủ TK</dt><dd>{order.name}</dd>
                      <dt>Nội dung</dt><dd>{order.note}</dd>
                    </dl>
                  </div>
                  <ActionForm action={buyMembershipAction} className="mt-10">
                    <input type="hidden" name="tier" value={hang} />
                    <input type="hidden" name="months" value={months} />
                    <SubmitButton className="btn btn-ok" confirm={`Bạn đã chuyển ${showVnd(order.amount)} cho gói ${tierInfo(hang).name} ${months} tháng?`}><Icon name="check" size={16} />Tôi đã chuyển khoản</SubmitButton>
                  </ActionForm>
                </>
              ) : <Note kind="warn">Nền tảng chưa cấu hình tài khoản nhận tiền, chưa mua gói được.</Note>}
            </div>
          )}

          {history.length > 0 && (
            <div className="card">
              <h2>Gói đã mua</h2>
              {history.map((m) => (
                <div key={m.id} className="job">
                  <div>
                    <strong>{tierInfo(m.tier).name} · {m.months} tháng</strong>
                    <div className="meta"><span className="money">{showVnd(m.amount)}</span> · {showDay(m.startsAt)} → {showDay(m.endsAt)}</div>
                  </div>
                  <span className={`badge ${m.status === "DA_XAC_NHAN" ? "badge-ok" : m.status === "HUY" ? "badge-danger" : "badge-info"}`}>{STATUS[m.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col">
          <div className="card card-soft">
            <h3>Luôn miễn phí cho mọi phụ huynh</h3>
            <ul className="small mb-0">
              <li>Nhờ đón hộ người tin cậy hoặc người ngoài danh sách, có cô duyệt.</li>
              <li>Mã QR/PIN, kiểm ảnh và CCCD tại cổng, ảnh bàn giao, nhật ký.</li>
              <li>Bản đồ theo dõi người đón, điểm trả theo từng lần.</li>
              <li>Nhóm lớp, điểm tương trợ, huy hiệu, lời cảm ơn.</li>
              <li>Đăng ký nhận đón có phí và nhận việc trong trường.</li>
            </ul>
          </div>
          <div className="card card-soft">
            <h3>Hạng thành viên không mua được</h3>
            <ul className="small mb-0">
              <li>Không bỏ qua bước cô duyệt, gọi xác minh hay kiểm tra tại cổng.</li>
              <li>Không hiện hạng của người đón cho phụ huynh nhờ — tiền không phải là lý do để tin một người đón.</li>
              <li>Không vượt hạng tương trợ: người hay giúp đỡ vẫn được ưu tiên trước trong nhóm lớp.</li>
              <li>Không hoàn tiền giữa kỳ [CẦN XÁC MINH chính sách hoàn tiền và hoá đơn].</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
