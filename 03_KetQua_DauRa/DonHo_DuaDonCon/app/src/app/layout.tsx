import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BottomNav, SideNav, type NavItem } from "@/components/Nav";
import { Avatar } from "@/components/ui";
import { unreadCount } from "@/server/notify";
import { currentUser, type Me } from "@/server/queries";
import { logoutAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đón Hộ",
  description: "Nhờ người đón con khi bận đột xuất — phụ huynh, người đón và giáo viên cùng xác nhận",
  applicationName: "Đón Hộ",
  appleWebApp: { capable: true, title: "Đón Hộ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e1b4b" },
    { media: "(prefers-color-scheme: dark)", color: "#11132a" },
  ],
};

export const dynamic = "force-dynamic";

/** Mục điều hướng theo vai trò; một người có thể vừa là phụ huynh vừa là giáo viên. `spare` = bỏ khỏi thanh dưới khi quá 5 mục. */
function navFor(me: NonNullable<Me>, unread: number): (NavItem & { spare?: boolean })[] {
  const items: (NavItem & { spare?: boolean })[] = [];
  if (me.isTeacher) {
    items.push({ href: "/giao-vien", label: "Hôm nay của lớp", short: "Hôm nay", icon: "school" });
    items.push({ href: "/giao-vien/giao-tre", label: "Giao trẻ tại cổng", short: "Giao trẻ", icon: "qr" });
    items.push({ href: "/giao-vien/nguoi-tin-cay", label: "Duyệt người tin cậy", short: "Duyệt", icon: "userCheck", spare: me.isParent });
    items.push({ href: "/giao-vien/nguoi-don-co-phi", label: "Duyệt người đón có phí", short: "Có phí", icon: "banknote", spare: true });
    items.push({ href: "/giao-vien/phu-huynh-moi", label: "Xác nhận phụ huynh mới", short: "PH mới", icon: "userCheck", spare: true });
  }
  if (me.isParent) {
    items.push({ href: "/phu-huynh", label: "Con của tôi", short: "Con", icon: "home" });
    items.push({ href: "/phu-huynh/nho-don", label: "Nhờ đón hộ", short: "Nhờ đón", icon: "plus", spare: me.isTeacher });
  }
  if (me.isParent || me.isTeacher) items.push({ href: "/nhom", label: "Nhóm lớp", short: "Nhóm lớp", icon: "message" });
  if (me.isParent || me.isDelegate) items.push({ href: "/nguoi-don", label: "Giúp đón & tương trợ", short: "Giúp đón", icon: "heart" });
  if (me.isParent) items.push({ href: "/kiem-tien", label: "Kiếm thêm khi đón hộ", short: "Kiếm thêm", icon: "wallet", spare: true });
  if (me.isParent) items.push({ href: "/thanh-vien", label: "Thành viên ưu đãi", short: "Thành viên", icon: "star", spare: true });
  if (me.isParent) items.push({ href: "/nguoi-tin-cay", label: "Người tin cậy", short: "Tin cậy", icon: "users", spare: true });
  if (me.isTeacher || me.isSchoolAdmin) items.push({ href: "/chia-se", label: "Chia sẻ doanh thu", short: "Chia sẻ", icon: "banknote", spare: me.isTeacher || me.isParent });
  if (me.isPlatformAdmin) items.push({ href: "/quan-tri/chia-se", label: "Quản trị: chuyển chia sẻ", short: "Quản trị", icon: "key", spare: true });
  items.push({ href: "/gioi-thieu", label: "Giới thiệu bạn bè", short: "Giới thiệu", icon: "gift", spare: true });
  // người vừa đăng ký chưa có vai trò: Khu vực là trang chính nên không bỏ khỏi thanh dưới
  items.push({ href: "/khu-vuc", label: "Khu vực của tôi", short: "Khu vực", icon: "mapPin", spare: me.isParent || me.isTeacher || me.isDelegate });
  items.push({ href: "/hop-tin", label: "Hộp tin", short: "Hộp tin", icon: "inbox", count: unread });
  return items;
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Đón Hộ, về trang chính">
      <span className="brand-mark"><Icon name="shield" size={16} /></span>
      Đón Hộ
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const items = me ? navFor(me, await unreadCount(me.id)) : [];
  // Thanh dưới tối đa 5 mục: bỏ bớt mục phụ (vẫn có trong sidebar và lối tắt trên trang), giữ Hộp tin ở cuối
  let bottom = items;
  for (const spare of items.filter((i) => i.spare)) if (bottom.length > 5) bottom = bottom.filter((i) => i !== spare);
  if (bottom.length > 5) bottom = [...bottom.slice(0, 4), bottom[bottom.length - 1]];
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap&subset=vietnamese" rel="stylesheet" />
      </head>
      <body>
        <a href="#main" className="skip-link">Bỏ qua, tới nội dung chính</a>
        {!me ? (
          <main id="main" tabIndex={-1}>{children}</main>
        ) : (
          <>
            <div className="shell">
              <aside className="sidebar">
                <Brand />
                <div className="user-chip"><Avatar name={me.name} size="sm" /><span>{me.name}</span></div>
                {me.area && <Link href="/khu-vuc" className="area-chip"><Icon name="mapPin" size={16} /><span>{me.area.ward}, {me.area.province}</span></Link>}
                <SideNav items={items} />
                <div className="sidebar-foot">
                  <form action={logoutAction}>
                    <button type="submit" className="lock-btn"><Icon name="logout" size={16} />Đăng xuất</button>
                  </form>
                  <div className="mt-10">Bản thử nghiệm. Tin nhắn chưa gửi thật, xem ở Hộp tin.</div>
                </div>
              </aside>
              <div className="shell-main">
                <header className="mobilebar">
                  <Brand />
                  <span className="spacer" />
                  {me.area && <Link href="/khu-vuc" className="area-chip area-chip-bar" aria-label={`Khu vực: ${me.area.ward}, ${me.area.province}`}><Icon name="mapPin" size={16} /><span>{me.area.ward}</span></Link>}
                  <form action={logoutAction}>
                    <button type="submit" className="lock-btn lock-btn-compact" aria-label="Đăng xuất"><Icon name="logout" /></button>
                  </form>
                </header>
                <main id="main" className="container" tabIndex={-1}>{children}</main>
              </div>
            </div>
            <BottomNav items={bottom} />
          </>
        )}
      </body>
    </html>
  );
}
