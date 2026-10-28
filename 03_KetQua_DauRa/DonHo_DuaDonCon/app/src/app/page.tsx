import { redirect } from "next/navigation";
import { currentUser } from "@/server/queries";
import { Landing } from "./Landing";

// Chưa đăng nhập: trang giới thiệu công khai. Đã đăng nhập: chuyển theo vai trò — giáo viên → lớp hôm nay; phụ huynh → con của tôi;
// người đón → lời nhờ đón; ban giám hiệu → trường của tôi; còn lại → khu vực của tôi.
export default async function Home() {
  const me = await currentUser();
  if (!me) return <Landing />;
  if (me.isTeacher) redirect("/giao-vien");
  if (me.isParent) redirect("/phu-huynh");
  if (me.isDelegate) redirect("/nguoi-don");
  if (me.isSchoolAdmin) redirect("/truong");
  // vừa tự đăng ký, chưa được cô xác nhận con: về trang khu vực (trạng thái xác nhận, trường cùng phường/xã)
  redirect("/khu-vuc");
}
