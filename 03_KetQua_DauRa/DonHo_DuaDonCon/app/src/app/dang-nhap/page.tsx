import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { currentUser } from "@/server/queries";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <span className="logo-mark"><Icon name="shield" size={24} /></span>
        <h1>Đón Hộ</h1>
        <p className="muted">Bận đột xuất vẫn yên tâm: nhờ người đón con, có cô giáo xác nhận.</p>
        <ul className="login-points">
          <li><Icon name="userCheck" size={16} />Phụ huynh, người đón và cô giáo cùng xác nhận</li>
          <li><Icon name="mapPin" size={16} />Theo dõi người đón trên bản đồ tới khi bé về</li>
          <li><Icon name="heart" size={16} />Phụ huynh cùng lớp giúp nhau, được ghi nhận</li>
        </ul>
        <LoginForm next={next ?? "/"} />
        {process.env.DEV_INBOX === "1" && (
          <p className="small muted mt-15">
            Bản thử nghiệm chưa gửi SMS thật. Xem mã OTP ở <a href="/thu-nghiem">Hộp tin thử nghiệm</a>.
          </p>
        )}
      </div>
    </div>
  );
}
