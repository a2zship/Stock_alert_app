import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { provinces } from "@/server/area";
import { currentUser } from "@/server/queries";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  if (await currentUser()) redirect("/");
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <span className="logo-mark"><Icon name="shield" size={24} /></span>
        <h1>Đăng ký Đón Hộ</h1>
        <p className="muted">Chọn nơi bạn sống và trường của con. Khi đăng nhập, app hiện đúng phường/xã, trường và nhóm lớp của bạn.</p>
        <SignupForm provinces={await provinces()} refCode={(await searchParams).ma?.slice(0, 8).toUpperCase()} />
        <p className="small muted mt-15 mb-0">Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></p>
        {process.env.DEV_INBOX === "1" && <p className="small muted mt-10">Bản thử nghiệm chưa gửi SMS thật. Xem mã ở <a href="/thu-nghiem">Hộp tin thử nghiệm</a>.</p>}
      </div>
    </div>
  );
}
