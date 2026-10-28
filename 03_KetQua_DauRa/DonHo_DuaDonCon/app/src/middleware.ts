// Mọi trang và server action đều cần đăng nhập, trừ trang giới thiệu (/), mở trường, đăng nhập, đăng ký (+ danh mục khu vực),
// hộp tin thử nghiệm, lịch nhắc việc (tự kiểm CRON_SECRET) và tài nguyên tĩnh.
import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC = [/^\/$/, /^\/mo-truong$/, /^\/api\/nhac-viec$/, /^\/dang-nhap(\/|$)/, /^\/dang-ky(\/|$)/, /^\/api\/khu-vuc$/, /^\/thu-nghiem(\/|$)/, /^\/_next\//, /^\/manifest\.webmanifest$/, /^\/icon\.svg$/, /^\/favicon\.ico$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    return new NextResponse("Thiếu APP_SECRET trong .env — chạy lại `npm run setup`.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (await readSession(secret, req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (req.method !== "GET" && req.method !== "HEAD") return new NextResponse("Chưa đăng nhập", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/dang-nhap";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: "/((?!_next/static|_next/image).*)" };
