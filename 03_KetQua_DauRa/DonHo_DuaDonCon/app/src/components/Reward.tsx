import { BENEFITS, POINTS, FAST_REPLY_MIN, TIERS, type computeReward } from "@/domain/reward";
import { Icon, type IconName } from "./Icon";

type R = ReturnType<typeof computeReward>;
const BADGE_ICON: Record<string, IconName> = { "lan-dau": "heart", nhanh: "zap", "nam-lan": "users", "cam-on": "smile" };
const PERK_ICON: IconName[] = ["heart", "award", "star", "message", "gift", "gift"];

/** Thẻ điểm + hạng tương trợ. `compact` = bản thu gọn cho trang chủ. */
export function RewardSummary({ r, compact = false }: { r: R; compact?: boolean }) {
  return (
    <section className="card reward" aria-labelledby="reward-title">
      <div className="reward-top">
        <span className="reward-medal"><Icon name="award" size={32} /></span>
        <div>
          <div className="eyebrow">Điểm tương trợ</div>
          <div className="reward-points">{r.points} <span className="small muted">điểm</span></div>
          <h2 id="reward-title" className="reward-tier">{r.tier.name}</h2>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-label={r.next ? `Tiến tới hạng ${r.next.name}` : "Đã ở hạng cao nhất"}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.progress * 100)}>
        <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
      </div>
      <p className="small muted mb-0">{r.next ? `Còn ${r.next.min - r.points} điểm nữa lên hạng “${r.next.name}”.` : "Bạn đã ở hạng cao nhất. Cảm ơn bạn!"}</p>
      {!compact && (
        <div className="reward-stats">
          <div><div className="v">{r.pickups}</div><div className="k">lần đón trọn vẹn</div></div>
          <div><div className="v">{r.fast}</div><div className="k">lần nhận lời nhanh</div></div>
          <div><div className="v">{r.thanks}</div><div className="k">lời cảm ơn</div></div>
        </div>
      )}
    </section>
  );
}

export function RewardBadges({ r }: { r: R }) {
  return (
    <div className="badges">
      {r.badges.map((b) => (
        <div key={b.key} className={`badge-tile ${b.earned ? "on" : ""}`}>
          <Icon name={BADGE_ICON[b.key] ?? "star"} />
          <div><strong>{b.name}</strong>{b.earned ? "Đã đạt" : b.hint}</div>
        </div>
      ))}
    </div>
  );
}

/** Quyền lợi theo hạng: đã mở thì đậm màu ấm, chưa mở thì xám + ghi hạng cần đạt. */
export function RewardPerks({ r }: { r: R }) {
  return (
    <ul className="perks">
      {BENEFITS.map((b, i) => {
        const on = r.unlocked(b.tier);
        const tier = TIERS.find((t) => t.key === b.tier)!;
        return (
          <li key={b.title} className={on ? "on" : ""}>
            <span className="ic"><Icon name={on ? PERK_ICON[i] : "lock"} size={16} /></span>
            <div>
              <div className="t">{b.title} {on ? <span className="chip-tier"><Icon name="check" size={12} />Đã mở</span> : <span className="badge badge-muted">Từ hạng {tier.name}</span>}</div>
              <div className="small muted">{b.detail}{b.pending && " (chờ nhà trường/đối tác đồng ý)"}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RewardRules() {
  return (
    <div className="rule-box">
      <strong>Cách tính điểm</strong>
      <ul>
        <li>+{POINTS.pickup} điểm mỗi lần đón trọn vẹn (phụ huynh đã bấm “Con đã về an toàn”).</li>
        <li>+{POINTS.fastReply} điểm khi nhận lời trong {FAST_REPLY_MIN} phút.</li>
        <li>+{POINTS.thanked} điểm khi được phụ huynh gửi lời cảm ơn.</li>
      </ul>
      <p className="small muted mt-10 mb-0">Điểm chỉ để ghi nhận và cảm ơn: <strong>không đổi ra tiền</strong>, không chuyển nhượng, và <strong>không ảnh hưởng</strong> việc giáo viên duyệt hay kiểm tra tại cổng. Ai đón cũng phải qua đủ 3 bên xác nhận.</p>
    </div>
  );
}
