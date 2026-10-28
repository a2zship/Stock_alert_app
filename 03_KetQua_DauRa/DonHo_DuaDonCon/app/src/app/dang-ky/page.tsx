import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Note } from "@/components/ui";
import { provinces } from "@/server/area";
import { currentUser } from "@/server/queries";
import { classDefaults } from "@/server/sales";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ma?: string; lop?: string }> }) {
  if (await currentUser()) redirect("/");
  const q = await searchParams;
  // đường dẫn / áp phích QR của lớp: điền sẵn tỉnh, phường/xã, trường, lớp
  const cls = q.lop && /^[a-z0-9]{10,40}$/.test(q.lop) ? await classDefaults(q.lop) : null;
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <span className="logo-mark"><Icon name="shield" size={24} /></span>
        <h1>Đăng ký Đón Hộ</h1>
        <p className="muted">Chọn nơi bạn sống và trường của con. Khi đăng nhập, app hiện đúng phường/xã, trường và nhóm lớp của bạn.</p>
        {cls && <Note kind="info">Bạn đăng ký theo đường dẫn của lớp <strong>{cls.label}</strong>. Trường và lớp đã được chọn sẵn, chỉ cần ghi họ tên bé.</Note>}
        <SignupForm provinces={await provinces()} refCode={q.ma?.slice(0, 8).toUpperCase()} defaults={cls ?? undefined} />
        <p className="small muted mt-15 mb-0">Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></p>
        {process.env.DEV_INBOX === "1" && <p className="small muted mt-10">Bản thử nghiệm chưa gửi SMS thật. Xem mã ở <a href="/thu-nghiem">Hộp tin thử nghiệm</a>.</p>}
      </div>
    </div>
  );
}
