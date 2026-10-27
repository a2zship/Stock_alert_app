import { redirect } from "next/navigation";
import { claimReferralAction } from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Empty, PageHead } from "@/components/ui";
import { showVnd } from "@/domain/money";
import { CREDIT_HOLD_DAYS, REF_MONTHS, REF_RATE, SOURCE_LABEL } from "@/domain/share";
import { publicUrl } from "@/server/db";
import { currentUser } from "@/server/queries";
import { referralView } from "@/server/share";

const showDay = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default async function ReferralPage() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  const v = await referralView(me.id);
  const url = `${publicUrl()}/dang-ky?ma=${v.code}`;
  const pct = `${Math.round(REF_RATE * 100)}%`;

  return (
    <>
      <PageHead title="Giới thiệu bạn bè" sub={`Mời phụ huynh khác dùng Đón Hộ. Trong ${REF_MONTHS} tháng, bạn nhận ${pct} số tiền nền tảng thu được từ người đó, dạng tín dụng trừ phí thành viên và phí nền tảng.`} />

      <div className="stat-row">
        <div><div className="k">Tín dụng dùng được</div><div className="money-lg">{showVnd(v.balance.available)}</div></div>
        <div><div className="k">Đang chờ đối soát</div><div className="money-lg">{showVnd(v.balance.pending)}</div><div className="small muted">Dùng được sau {CREDIT_HOLD_DAYS} ngày</div></div>
        <div><div className="k">Đã dùng</div><div className="money-lg">{showVnd(v.balance.used)}</div></div>
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h2>Mã của bạn</h2>
            <p className="ref-code" aria-label={`Mã giới thiệu ${v.code.split("").join(" ")}`}>{v.code}</p>
            <CopyLink url={url} text={`Mình đang dùng Đón Hộ để nhờ đón con khi bận. Đăng ký bằng mã ${v.code}:`} />
          </div>

          <div className="card">
            <h2>Người bạn đã giới thiệu {v.referrals.length > 0 && <span className="count">{v.referrals.length}</span>}</h2>
            {v.referrals.length === 0 ? <Empty icon="users">Chưa có ai. Gửi liên kết cho phụ huynh cùng lớp, cùng trường hoặc hàng xóm.</Empty> : v.referrals.map((r, i) => (
              <div key={i} className="job">
                <div>
                  <strong>{r.name}</strong>
                  <div className="meta">Từ {showDay(r.since)} · {r.active ? `tính tới ${showDay(r.until)}` : "đã hết 12 tháng"}{r.parent ? "" : " · chưa được cô xác nhận con"}</div>
                </div>
                <span className="money">+{showVnd(r.earned)}</span>
              </div>
            ))}
          </div>

          {v.history.length > 0 && (
            <div className="card">
              <h2>Tín dụng nhận được</h2>
              {v.history.map((h) => (
                <div key={h.id} className="job">
                  <div>
                    <strong>{SOURCE_LABEL[h.source]}</strong> · {h.who}
                    <div className="meta">{showDay(h.at)}{h.status === "HUY" ? " · đã huỷ khi đối soát" : ""}</div>
                  </div>
                  <span className="money">{h.status === "HUY" ? <s>+{showVnd(h.amount)}</s> : `+${showVnd(h.amount)}`}</span>
                </div>
              ))}
              {v.uses.map((u) => (
                <div key={u.id} className="job">
                  <div><strong>Đã dùng: {SOURCE_LABEL[u.purpose]}</strong><div className="meta">{showDay(u.createdAt)}</div></div>
                  <span className="money">−{showVnd(u.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col">
          {v.referredBy && <p className="small muted"><Icon name="userCheck" size={16} /> Bạn được {v.referredBy} giới thiệu.</p>}
          {v.canClaim && (
            <div className="card">
              <h2>Bạn được ai giới thiệu?</h2>
              <p className="small muted">Quên nhập mã lúc đăng ký thì nhập ở đây, trong 7 ngày đầu.</p>
              <ActionForm action={claimReferralAction}>
                <div className="field">
                  <label htmlFor="claim-code">Mã giới thiệu</label>
                  <input id="claim-code" name="refCode" type="text" autoCapitalize="characters" autoComplete="off" maxLength={8} required placeholder="Ví dụ: AB12CD" />
                </div>
                <SubmitButton className="btn">Lưu mã</SubmitButton>
              </ActionForm>
            </div>
          )}
          <div className="card card-soft">
            <h3>Quy tắc</h3>
            <ul className="small mb-0">
              <li>Bạn nhận <strong>{pct}</strong> số tiền nền tảng <strong>thực thu</strong> từ người được giới thiệu (phí thành viên, phí nền tảng khi họ nhận đón có phí) trong <strong>{REF_MONTHS} tháng</strong> kể từ ngày họ đăng ký.</li>
              <li>Người được giới thiệu <strong>không trả thêm</strong> khoản nào.</li>
              <li>Thưởng là <strong>tín dụng</strong>, tự trừ vào phí thành viên và phí nền tảng của bạn. Không đổi ra tiền mặt, không chuyển cho người khác.</li>
              <li>Tín dụng dùng được sau {CREDIT_HOLD_DAYS} ngày (để nền tảng đối soát). Khoản tiền tạo ra tín dụng bị huỷ khi đối soát thì tín dụng đó cũng huỷ.</li>
              <li>Phần người khác trả bằng tín dụng không sinh thưởng.</li>
              <li>Mỗi người chỉ có một người giới thiệu. Không dùng mã của chính mình, không giới thiệu chéo hai chiều.</li>
              <li>Giới thiệu không thay đổi việc cô xác nhận phụ huynh hay việc kiểm tra tại cổng.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
