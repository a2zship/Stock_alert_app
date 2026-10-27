import Link from "next/link";
import type { Status } from "@/domain/state";
import { showWindow } from "@/domain/time";
import { Icon } from "./Icon";
import { StatusBadge } from "./ui";

type Row = {
  id: string; status: string; windowStart: Date; windowEnd: Date; delegateName: string; relation: string; isAdhoc: boolean;
  student: { name: string; class: { name: string } };
};

/** Danh sách yêu cầu dùng chung cho mọi vai trò; mỗi dòng mở trang chi tiết. */
export function RequestList({ rows, show = "delegate" }: { rows: Row[]; show?: "delegate" | "student" }) {
  return (
    <div>
      {rows.map((r) => (
        <Link key={r.id} href={`/yeu-cau/${r.id}`} className="list-item">
          <div className="list-row">
            <span className="desc">
              {show === "student" ? `Bé ${r.student.name}` : `${r.delegateName} (${r.relation})`}
              {r.isAdhoc && <span className="badge badge-warn ml-5"><Icon name="alert" size={16} />Ngoài danh sách</span>}
            </span>
            <StatusBadge status={r.status as Status} />
          </div>
          <div className="meta">
            {show === "student" ? `${r.student.class.name} · người đón ${r.delegateName} (${r.relation})` : `Bé ${r.student.name} · ${r.student.class.name}`}
            {" · "}{showWindow(r.windowStart, r.windowEnd)}
          </div>
        </Link>
      ))}
    </div>
  );
}
