import { STATUS_LABEL, type Status, type Tone } from "@/domain/state";
import { Icon, type IconName } from "./Icon";

const TONE_ICON: Record<Tone, IconName> = { warn: "clock", ok: "checkCircle", danger: "alert", info: "shield", muted: "x" };

/** Trạng thái yêu cầu: luôn icon + chữ + màu (không chỉ dựa vào màu). */
export function StatusBadge({ status }: { status: Status }) {
  const { label, tone } = STATUS_LABEL[status];
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={TONE_ICON[tone]} size={16} />
      {label}
    </span>
  );
}

export function Note({ kind = "info", children }: { kind?: "info" | "ok" | "warn" | "error"; children: React.ReactNode }) {
  const icon: IconName = kind === "ok" ? "checkCircle" : kind === "info" ? "info" : "alert";
  return (
    <div className={`note ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon = "inbox", children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} />
      <div>{children}</div>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

/** Ảnh chỉ tải qua /anh/[id] — máy chủ kiểm quyền mỗi lần xem. */
export function Photo({ id, alt, size = 96 }: { id: string | null | undefined; alt: string; size?: number }) {
  if (!id) {
    return (
      <span className="photo photo-empty" style={{ width: size, height: size }} role="img" aria-label={`${alt}: chưa có ảnh`}>
        <Icon name="users" size={24} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="photo" src={`/anh/${id}`} alt={alt} width={size} height={size} loading="lazy" />;
}

/** Ảnh đại diện bằng chữ cái đầu (không cần ảnh thật) — màu cố định theo tên. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter((w) => !/^(anh|chị|cô|thầy|bà|ông|chú|bé)$/i.test(w));
  const initials = ((words.at(-2)?.[0] ?? "") + (words.at(-1)?.[0] ?? "")).toUpperCase() || "?";
  const tone = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  return <span className={`avatar avatar-${size} av-${tone}`} aria-hidden="true">{initials}</span>;
}

/** Khối chào đầu trang: nền chàm, chữ trắng, hình minh hoạ mờ. */
export function Hero({ title, sub, children, art = "shield" }: { title: string; sub?: React.ReactNode; children?: React.ReactNode; art?: IconName }) {
  return (
    <section className="hero">
      <span className="hero-art" aria-hidden="true"><Icon name={art} size={40} /></span>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
      {children && <div className="actions">{children}</div>}
    </section>
  );
}
