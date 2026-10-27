import type { Status } from "@/domain/state";
import { Icon, type IconName } from "./Icon";

type Ev = { action: string; at: Date };
type State = "done" | "now" | "fail" | "todo";

const hhmm = (d: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(d);
const STATE_TEXT: Record<State, string> = { done: "đã xong", now: "đang ở bước này", fail: "dừng lại", todo: "chưa tới" };

/** Hành trình 5 bước của một lần đón hộ: ai đã xác nhận, đang chờ ai, dừng ở đâu. Luôn icon + chữ, không chỉ dựa vào màu. */
export function Journey({ status, events }: { status: Status; events: Ev[] }) {
  const at = (a: string) => events.find((e) => e.action === a)?.at;
  const closed = ["DA_HUY", "HET_HAN"].includes(status);
  const steps: { label: string; icon: IconName; done?: Date; fail: boolean; now: boolean }[] = [
    { label: "Gửi nhờ", icon: "send", done: at("TAO"), fail: false, now: false },
    { label: "Nhận lời", icon: "hand", done: at("NGUOI_DON_NHAN"), fail: !!at("NGUOI_DON_TU_CHOI"), now: status === "CHO_NGUOI_DON" },
    { label: "Cô duyệt", icon: "shield", done: at("GV_DUYET"), fail: !!at("GV_TU_CHOI"), now: status === "CHO_GIAO_VIEN" },
    { label: "Giao ở cổng", icon: "userCheck", done: at("GIAO_TRE"), fail: status === "KHONG_GIAO_DUOC" || status === "BI_KHOA", now: status === "DA_DUYET" },
    { label: "Về an toàn", icon: "home", done: at("PH_XAC_NHAN_VE") ?? at("TU_DONG_DONG"), fail: false, now: status === "DA_GIAO" },
  ];
  // Huỷ / hết hạn: đánh dấu bước đang dở là "dừng lại"
  const firstOpen = steps.findIndex((s) => !s.done && !s.fail);
  return (
    <ol className="journey" aria-label="Hành trình đón bé">
      {steps.map((s, i) => {
        const state: State = s.done ? "done" : s.fail || (closed && i === firstOpen) ? "fail" : s.now ? "now" : "todo";
        const icon: IconName = state === "done" ? "check" : state === "fail" ? "x" : s.icon;
        return (
          <li key={s.label} className={state} aria-current={state === "now" ? "step" : undefined}>
            <span className="step"><Icon name={icon} size={state === "done" || state === "fail" ? 20 : 16} /></span>
            <span className="label">{s.label}</span>
            <span className="when">{s.done ? hhmm(s.done) : state === "now" ? "Đang chờ" : ""}</span>
            <span className="sr-only">: {STATE_TEXT[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}
