import { redirect } from "next/navigation";
import { currentUser } from "@/server/queries";

// Trang chính chuyển theo vai trò: giáo viên → lớp hôm nay; phụ huynh → con của tôi; còn lại → lời nhờ đón.
export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/dang-nhap");
  if (me.isTeacher) redirect("/giao-vien");
  if (me.isParent) redirect("/phu-huynh");
  redirect("/nguoi-don");
}
