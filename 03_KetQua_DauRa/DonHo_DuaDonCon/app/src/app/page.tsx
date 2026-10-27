import { redirect } from "next/navigation";
import { currentUser } from "@/server/queries";

// Trang chính chuyển theo vai trò: giáo viên → lớp hôm nay; phụ huynh → con của tôi; người đón → lời nhờ đón; còn lại → khu vực của tôi.
export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (me.isTeacher) redirect("/giao-vien");
  if (me.isParent) redirect("/phu-huynh");
  if (me.isDelegate) redirect("/nguoi-don");
  // vừa tự đăng ký, chưa được cô xác nhận con: về trang khu vực (trạng thái xác nhận, trường cùng phường/xã)
  redirect("/khu-vuc");
}
